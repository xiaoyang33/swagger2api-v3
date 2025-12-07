import {
  SwaggerDocument,
  SwaggerOperation,
  SwaggerParameter,
  ApiInfo,
  TypeInfo,
  SwaggerConfig
} from '../types';
import {
  pathToFunctionName,
  swaggerTypeToTsType,
  generateParameterTypes,
  getResponseType,
  toPascalCase,
  stripMethodNamePrefixes
} from '../utils';

/**
 * Swagger文档解析器
 */
export class SwaggerParser {
  private document: SwaggerDocument;
  private config: SwaggerConfig;

  constructor(document: SwaggerDocument, config: SwaggerConfig) {
    this.document = document;
    this.config = config;
  }

  /**
   * 解析所有API接口
   * @returns API接口信息数组
   */
  parseApis(): ApiInfo[] {
    const apis: ApiInfo[] = [];
    const paths = this.document.paths;

    for (const [path, pathItem] of Object.entries(paths)) {
      const methods = [
        'get',
        'post',
        'put',
        'delete',
        'patch',
        'head',
        'options'
      ];

      for (const method of methods) {
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
    const allParameters = [
      ...(globalParameters || []),
      ...(operation.parameters || [])
    ];

    // 处理 OpenAPI 3.0 requestBody
    if (operation.requestBody) {
      const requestBody = operation.requestBody;
      if (requestBody.content && requestBody.content['application/json']) {
        const schema = requestBody.content['application/json'].schema;
        if (schema) {
          const bodyParam: SwaggerParameter = {
            name: 'body',
            in: 'body',
            required: requestBody.required || false,
            schema: schema,
            type: 'object'
          };
          allParameters.push(bodyParam);
        }
      }
    }

    // 生成函数名
    let functionName =
      operation.operationId || pathToFunctionName(method, path);

    // 如果使用了operationId，需要手动添加HTTP方法后缀
    if (operation.operationId) {
      // 将HTTP方法转换为首字母大写的形式并添加到末尾
      const methodSuffix =
        method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
      functionName = functionName + methodSuffix;
    }

    // 应用前缀忽略规则
    functionName = stripMethodNamePrefixes(
      functionName,
      this.config.methodNameIgnorePrefix
    );

    // 获取响应类型
    const responseType = getResponseType(operation.responses);

    // 获取请求体类型
    const bodyParam = allParameters.find((p) => p.in === 'body');
    const requestBodyType = bodyParam
      ? swaggerTypeToTsType(bodyParam.schema)
      : undefined;

    // 解析参数信息
    const parameters = allParameters.map((param) => {
      const type = param.schema
        ? swaggerTypeToTsType(param.schema)
        : swaggerTypeToTsType({ type: param.type || 'string' });
      return {
        name: param.name,
        type,
        in: param.in,
        required: param.required || false,
        description: param.description,
        schema: param.schema
      };
    });

    return {
      name: functionName,
      method: method.toUpperCase(),
      path,
      description: operation.summary || operation.description,
      tags: operation.tags || [],
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
    const types: TypeInfo[] = [];
    
    // Debug log
    console.log('解析类型定义...');
    console.log('Has definitions:', !!this.document.definitions);
    console.log('Has components:', !!this.document.components);
    if (this.document.components) {
        console.log('Has schemas:', !!this.document.components.schemas);
        if (this.document.components.schemas) {
            console.log('Schema keys:', Object.keys(this.document.components.schemas));
        }
    }

    // 解析 Swagger 2.0 definitions
    if (this.document.definitions) {
      for (const [name, schema] of Object.entries(this.document.definitions)) {
        const typeInfo = this.parseTypeDefinition(name, schema);
        types.push(typeInfo);
      }
    }

    // 解析 OpenAPI 3.0 components.schemas
    if (this.document.components?.schemas) {
      for (const [name, schema] of Object.entries(
        this.document.components.schemas
      )) {
        const typeInfo = this.parseTypeDefinition(name, schema);
        types.push(typeInfo);
      }
    }

    return types;
  }

  /**
   * 解析单个类型定义
   * @param name 类型名称
   * @param schema 模式对象
   * @returns 类型信息
   */
  private parseTypeDefinition(name: string, schema: any): TypeInfo {
    const typeName = toPascalCase(name);
    let definition: string;

    if (schema.type === 'object' && schema.properties) {
      // 对象类型
      const properties = Object.entries(schema.properties)
        .map(([key, value]: [string, any]) => {
          const optional = schema.required?.includes(key) ? '' : '?';
          const type = swaggerTypeToTsType(value);
          const comment = value.description
            ? ` /** ${value.description} */`
            : '';
          return `${comment}\n  ${key}${optional}: ${type};`;
        })
        .join('\n');

      definition = `export interface ${typeName} {\n${properties}\n}`;
    } else if (schema.type === 'array') {
      // 数组类型
      const itemType = swaggerTypeToTsType(schema.items);
      definition = `export type ${typeName} = ${itemType}[];`;
    } else if (schema.enum) {
      // 枚举类型
      const enumValues = schema.enum
        .map((value: any, index: number) => {
          let key = value;
          
          // 优先使用 x-enum-varnames 或 x-enumNames 扩展字段
          if ((schema['x-enum-varnames'] && schema['x-enum-varnames'][index]) || 
              (schema['x-enumNames'] && schema['x-enumNames'][index])) {
            key = schema['x-enum-varnames']?.[index] || schema['x-enumNames']?.[index];
          } else if (/^\d+$/.test(value)) {
            // 对于数字枚举，使用 VALUE_ 前缀
            key = `VALUE_${value}`;
          } else {
            key = value.toUpperCase();
          }
          return `  ${key} = '${value}'`;
        })
        .join(',\n');
      definition = `export enum ${typeName} {\n${enumValues}\n}`;
    } else {
      // 其他类型
      const type = swaggerTypeToTsType(schema);
      definition = `export type ${typeName} = ${type};`;
    }

    return {
      name: typeName,
      definition,
      description: schema.description
    };
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

      for (const tag of tags) {
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
    for (const pathItem of Object.values(this.document.paths)) {
      const methods = [
        'get',
        'post',
        'put',
        'delete',
        'patch',
        'head',
        'options'
      ];

      for (const method of methods) {
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
    if (this.document.host) {
      const scheme = this.document.schemes?.[0] || 'https';
      const basePath = this.document.basePath || '';
      return `${scheme}://${this.document.host}${basePath}`;
    }
    return '';
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
