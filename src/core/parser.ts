import {
  SwaggerDocument,
  SwaggerOperation,
  SwaggerParameter,
  SwaggerPathItem,
  SwaggerResponse,
  SwaggerResponses,
  SwaggerSchema,
  ApiInfo,
  TypeInfo,
  SwaggerConfig
} from '../types';
import {
  pathToFunctionName,
  swaggerTypeToTsType,
  getResponseType,
  getSchemaFromContent,
  swaggerParameterToSchema,
  stripMethodNamePrefixes,
  removeMethodSuffix,
  logger
} from '../utils';
import { OpenAPITypeGenerator } from './type-generator';

const HTTP_METHODS = [
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'head',
  'options',
  'trace'
] as const;

const MAX_REF_RESOLVE_DEPTH = 20;

/**
 * OpenAPI 3.0 文档解析器
 */
export class SwaggerParser {
  private document: SwaggerDocument;
  private config: SwaggerConfig;

  /**
   * 创建 OpenAPI 文档解析器
   * @param document OpenAPI 文档
   * @param config 生成配置
   */
  constructor(document: SwaggerDocument, config: SwaggerConfig) {
    this.document = document;
    this.config = config;
  }

  /**
   * 获取 OpenAPI components.schemas
   * @returns schemas 对象
   */
  private getAllSchemas(): Record<string, SwaggerSchema> {
    return this.document.components?.schemas || {};
  }

  /**
   * 解析所有API接口
   * @returns API接口信息数组
   */
  parseApis(): ApiInfo[] {
    const apis: ApiInfo[] = [];
    const paths = this.document.paths;

    for (const [path, rawPathItem] of Object.entries(paths)) {
      const pathItem = this.resolveReference<SwaggerPathItem>(rawPathItem);
      for (const method of HTTP_METHODS) {
        const operation = pathItem[
          method as keyof typeof pathItem
        ] as SwaggerOperation;
        if (!operation) continue;

        const apiInfo = this.parseOperation(
          method,
          path,
          operation,
          pathItem.parameters
        );
        apis.push(apiInfo);
      }
    }

    return apis;
  }

  /**
   * 解析单个操作
   * @param method HTTP方法
   * @param path 路径
   * @param operation 操作对象
   * @param globalParameters 全局参数
   * @returns API接口信息
   */
  private parseOperation(
    method: string,
    path: string,
    operation: SwaggerOperation,
    globalParameters?: SwaggerParameter[]
  ): ApiInfo {
    // 合并全局参数和操作参数
    const allParameters = this.mergeParameters(
      [...(globalParameters || []), ...(operation.parameters || [])].map(
        (parameter) => this.resolveReference<SwaggerParameter>(parameter)
      )
    );

    // 处理 OpenAPI 3.0 requestBody
    if (operation.requestBody) {
      const requestBody = this.resolveReference(operation.requestBody);
      const schema = getSchemaFromContent(requestBody.content);
      if (schema) {
        const bodyParam: SwaggerParameter = {
          name: 'body',
          in: 'body',
          required: requestBody.required || false,
          schema,
          type: 'object'
        };
        allParameters.push(bodyParam);
      }
    }

    // 生成函数名
    let functionName =
      operation.operationId || pathToFunctionName(method, path);

    // 根据配置决定是否添加/保留 HTTP method 后缀
    const shouldAddMethodSuffix = this.config.addMethodSuffix !== false; // 默认为 true

    if (operation.operationId) {
      // 如果使用了 operationId，根据配置决定是否添加 HTTP 方法后缀
      if (shouldAddMethodSuffix) {
        const methodSuffix =
          method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
        functionName = functionName + methodSuffix;
      }
    } else {
      // 如果没有 operationId，pathToFunctionName 已经包含了 method 后缀
      // 如果配置为 false，需要移除后缀
      if (!shouldAddMethodSuffix) {
        functionName = removeMethodSuffix(functionName, method);
      }
    }

    // 应用前缀忽略规则
    functionName = stripMethodNamePrefixes(
      functionName,
      this.config.methodNameIgnorePrefix
    );

    // 获取响应类型
    const responses = this.resolveResponses(operation.responses);
    const responseType = getResponseType(responses, this.getAllSchemas());

    // 获取请求体类型
    const bodyParam = allParameters.find((p) => p.in === 'body');
    const requestBodyType = bodyParam?.schema
      ? swaggerTypeToTsType(bodyParam.schema, this.getAllSchemas(), 'request')
      : undefined;

    // 解析参数信息
    const parameters = allParameters.map((param) => {
      const type = swaggerTypeToTsType(
        swaggerParameterToSchema(param),
        this.getAllSchemas(),
        'request'
      );
      return {
        name: param.name,
        type,
        in: param.in,
        required: param.required || false,
        description: param.description,
        schema: swaggerParameterToSchema(param)
      };
    });

    return {
      name: functionName,
      method: method.toUpperCase(),
      path,
      description: operation.summary || operation.description,
      tags: operation.tags || [],
      deprecated: operation.deprecated,
      parameters,
      responseType,
      requestBodyType
    };
  }

  /**
   * 解析所有类型定义
   * @returns 类型信息数组
   */
  parseTypes(): TypeInfo[] {
    // Debug log
    logger.debug('解析类型定义...');
    logger.debugKV('components', !!this.document.components);
    if (this.document.components) {
      logger.debugKV('schemas', !!this.document.components.schemas);
      if (this.document.components.schemas) {
        logger.debugKV(
          'schema 列表',
          Object.keys(this.document.components.schemas).join(', ')
        );
      }
    }

    return new OpenAPITypeGenerator(this.getAllSchemas()).generate();
  }

  /**
   * 解析本地 $ref 引用对象
   * @param value 可能带有 $ref 的对象
   * @param seenRefs 已访问的引用
   * @param depth 当前解析深度
   * @returns 引用解析后的对象
   */
  private resolveReference<T>(
    value: T,
    seenRefs = new Set<string>(),
    depth = 0
  ): T {
    if (!value || !(value as any).$ref) {
      return value;
    }

    const ref = (value as any).$ref;
    if (!ref.startsWith('#/')) {
      throw new Error(`外部 $ref 需要先通过 loadSwaggerDocument 打包: ${ref}`);
    }

    if (depth >= MAX_REF_RESOLVE_DEPTH) {
      throw new Error(`$ref 解析超过最大深度: ${ref}`);
    }

    if (seenRefs.has(ref)) {
      throw new Error(`检测到循环 $ref 引用: ${ref}`);
    }

    seenRefs.add(ref);

    const refPath = ref
      .replace(/^#\//, '')
      .split('/')
      .map((segment: string) =>
        decodeURIComponent(segment).replace(/~1/g, '/').replace(/~0/g, '~')
      );
    let current: any = this.document;

    for (const segment of refPath) {
      current = current?.[segment];
      if (current === undefined) {
        throw new Error(`无法解析 $ref 引用: ${ref}`);
      }
    }

    return this.resolveReference(current as T, seenRefs, depth + 1);
  }

  /**
   * 解析响应对象中的本地引用
   * @param responses OpenAPI 响应集合
   * @returns 已解析的响应集合
   */
  private resolveResponses(responses: SwaggerResponses): SwaggerResponses {
    return Object.fromEntries(
      Object.entries(responses).map(([status, response]) => [
        status,
        this.resolveReference<SwaggerResponse>(response as SwaggerResponse)
      ])
    );
  }

  /**
   * 合并同名同位置参数，后出现的 operation 级参数覆盖 path 级参数
   * @param parameters 参数数组
   * @returns 合并后的参数数组
   */
  private mergeParameters(parameters: SwaggerParameter[]): SwaggerParameter[] {
    const merged = new Map<string, SwaggerParameter>();

    for (const parameter of parameters) {
      merged.set(`${parameter.in}:${parameter.name}`, parameter);
    }

    return Array.from(merged.values());
  }

  /**
   * 按标签分组API
   * @param apis API接口数组
   * @returns 按标签分组的API映射
   */
  groupApisByTags(apis: ApiInfo[]): Map<string, ApiInfo[]> {
    const groupedApis = new Map<string, ApiInfo[]>();

    for (const api of apis) {
      const tags = api.tags.length > 0 ? api.tags : ['default'];
      const strategy = this.config.multiTagStrategy ?? 'first';
      const groupTags = strategy === 'all' ? [tags.join('-')] : [tags[0]];

      for (const tag of groupTags) {
        if (!groupedApis.has(tag)) {
          groupedApis.set(tag, []);
        }
        groupedApis.get(tag)!.push(api);
      }
    }

    return groupedApis;
  }

  /**
   * 获取所有标签
   * @returns 标签数组
   */
  getTags(): string[] {
    const tags = new Set<string>();

    // 从文档标签中获取
    if (this.document.tags) {
      this.document.tags.forEach((tag) => tags.add(tag.name));
    }

    // 从路径操作中获取
    for (const rawPathItem of Object.values(this.document.paths)) {
      const pathItem = this.resolveReference<SwaggerPathItem>(rawPathItem);
      for (const method of HTTP_METHODS) {
        const operation = pathItem[
          method as keyof typeof pathItem
        ] as SwaggerOperation;
        if (operation?.tags) {
          operation.tags.forEach((tag) => tags.add(tag));
        }
      }
    }

    return Array.from(tags);
  }

  /**
   * 获取基础URL
   * @returns 基础URL字符串
   */
  getBaseUrl(): string {
    const server = this.document.servers?.[0];
    if (!server) return '';

    return this.resolveServerUrl(server);
  }

  /**
   * 解析 OpenAPI server 地址
   * @param server OpenAPI server 对象
   * @returns 替换默认变量后的 server URL
   */
  private resolveServerUrl(server: { url: string; variables?: any }): string {
    if (!server.variables) return server.url;

    return server.url.replace(/\{([^}]+)\}/g, (match, name) => {
      const variable = server.variables?.[name];
      return variable?.default ?? match;
    });
  }

  /**
   * 获取API文档信息
   * @returns API文档基本信息
   */
  getApiInfo() {
    return {
      title: this.document.info.title,
      description: this.document.info.description,
      version: this.document.info.version,
      baseUrl: this.getBaseUrl()
    };
  }
}
