import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SwaggerConfig, ApiInfo, TypeInfo } from '../types';
import {
  writeFile,
  ensureDirectoryExists,
  removeDirectory,
  generateApiComment,
  sanitizeFilename,
  toKebabCase,
  toCamelCase,
  formatTsPropertyName,
  stripNullFromUnion,
  isValidIdentifier,
  isPathInside,
  logger
} from '../utils';
import {
  collectQueryParameterModelTypes,
  generateQueryParameterTypes
} from './query-parameter-generator';

const execPromise = promisify(exec);

/**
 * 代码生成器
 */
export class CodeGenerator {
  private config: SwaggerConfig;
  private readonly outputRoot: string;

  /**
   * 创建代码生成器
   * @param config 生成配置
   */
  constructor(config: SwaggerConfig) {
    this.config = config;
    this.outputRoot = path.resolve(config.output);
  }

  /**
   * 生成所有文件
   * @param apis API接口数组
   * @param types 类型定义数组
   * @param groupedApis 按标签分组的API
   */
  async generateAll(
    apis: ApiInfo[],
    types: TypeInfo[],
    groupedApis: Map<string, ApiInfo[]>
  ): Promise<void> {
    this.assertSafeOutputDirectory();
    if (
      this.config.options?.generateApis !== false &&
      this.config.groupByTags
    ) {
      this.validateTagFolders(groupedApis);
    }

    // 根据overwrite配置决定是否清空目录
    if (this.config.overwrite !== false) {
      // 默认为true，清空输出目录
      removeDirectory(this.outputRoot);
    }

    // 确保输出目录存在
    ensureDirectoryExists(this.outputRoot);

    // 生成类型文件（仅在 TypeScript 模式下生成）
    if (
      this.config.generator === 'typescript' &&
      this.config.options?.generateModels !== false
    ) {
      const rootTypes = this.config.groupByTags
        ? types
        : this.config.options?.generateApis === false
          ? types
          : this.mergeTypeDefinitions(
              types,
              generateQueryParameterTypes(
                apis,
                types.map((type) => type.name)
              )
            );
      await this.generateTypesFile(rootTypes);
    }

    // 生成API文件
    if (this.config.options?.generateApis !== false) {
      if (this.config.groupByTags) {
        await this.generateApiFilesByTags(groupedApis, types);
      } else {
        await this.generateSingleApiFile(apis, types);
      }
    }

    // 生成入口文件
    if (this.config.options?.generateIndex !== false) {
      await this.generateIndexFile(groupedApis);
    }

    // 在所有文件生成完成后执行lint
    if (this.config.lint) {
      await this.runLintOnAllFiles();
    }
  }

  /**
   * 生成类型定义文件
   * @param types 类型定义数组
   */
  private async generateTypesFile(types: TypeInfo[]): Promise<void> {
    const content = this.generateTypesContent(types);
    const filePath = this.resolveOutputPath('types.ts');
    this.writeGeneratedFile(filePath, content);
  }

  /**
   * 生成类型文件内容
   * @param types 类型定义数组
   * @returns 类型文件内容
   */
  private generateTypesContent(types: TypeInfo[]): string {
    const header = this.generateHeader([
      '/**',
      ' * API 类型定义',
      ' * 此文件由 swagger2api-v3 自动生成，请勿手动修改',
      ' */'
    ]);

    const typeDefinitions = this.renderTypeDefinitions(types);

    return `${header}\n\n${typeDefinitions}\n`;
  }

  /**
   * 渲染类型定义列表
   * @param types 类型定义数组
   * @returns 类型定义内容
   */
  private renderTypeDefinitions(types: TypeInfo[]): string {
    return types
      .map((type) => {
        const comment = type.description
          ? `/**\n * ${type.description}\n */\n`
          : '';

        return `${comment}${type.definition}`;
      })
      .join('\n\n');
  }

  /**
   * 合并类型定义
   * @param modelTypes 组件模型类型
   * @param parameterTypes 查询参数类型
   * @returns 合并后的类型定义
   */
  private mergeTypeDefinitions(
    modelTypes: TypeInfo[],
    parameterTypes: TypeInfo[]
  ): TypeInfo[] {
    return [...modelTypes, ...parameterTypes];
  }

  /**
   * 判断是否应提取查询参数类型
   * @returns 是否提取查询参数类型
   */
  private shouldExtractQueryParameterTypes(): boolean {
    return (
      this.config.generator === 'typescript' &&
      this.config.options?.generateModels !== false
    );
  }

  /**
   * 生成 tag 内的查询参数类型文件
   * @param folderName tag 目录名
   * @param apis 当前 tag 的 API 接口
   * @param modelTypes 组件模型类型
   */
  private generateTagParameterTypesFile(
    folderName: string,
    apis: ApiInfo[],
    modelTypes: TypeInfo[]
  ): void {
    const parameterTypes = generateQueryParameterTypes(
      apis,
      modelTypes.map((type) => type.name)
    );
    if (parameterTypes.length === 0) return;

    const usedModelTypes = collectQueryParameterModelTypes(apis, modelTypes);
    const content: string[] = [
      this.generateHeader([
        '/**',
        ' * API 查询参数类型',
        ' * 此文件由 swagger2api-v3 自动生成，请勿手动修改',
        ' */'
      ])
    ];
    if (usedModelTypes.length > 0) {
      content.push(
        `import type { ${usedModelTypes.join(', ')} } from '../../types';`
      );
    }
    content.push('', this.renderTypeDefinitions(parameterTypes), '');

    const filePath = this.resolveOutputPath(folderName, 'types', 'index.ts');
    this.writeGeneratedFile(filePath, content.join('\n'));
  }

  /**
   * 按标签生成API文件
   * @param groupedApis 按标签分组的API
   * @param types 类型定义数组
   */
  private async generateApiFilesByTags(
    groupedApis: Map<string, ApiInfo[]>,
    types: TypeInfo[]
  ): Promise<void> {
    for (const [tag, apis] of groupedApis) {
      const folderName = this.getTagFileName(tag);
      const tagFolderPath = this.resolveOutputPath(folderName);

      // 确保tag文件夹存在
      ensureDirectoryExists(tagFolderPath);

      if (this.shouldExtractQueryParameterTypes()) {
        this.generateTagParameterTypesFile(folderName, apis, types);
      }

      const ext = this.config.generator === 'javascript' ? 'js' : 'ts';
      const filePath = path.join(tagFolderPath, `index.${ext}`);
      const content = this.generateApiFileContent(apis, types, tag);

      this.writeGeneratedFile(filePath, content);
    }
  }

  /**
   * 生成单个API文件
   * @param apis API接口数组
   * @param types 类型定义数组
   */
  private async generateSingleApiFile(
    apis: ApiInfo[],
    types: TypeInfo[]
  ): Promise<void> {
    const ext = this.config.generator === 'javascript' ? 'js' : 'ts';
    const filePath = this.resolveOutputPath(`api.${ext}`);
    const content = this.generateApiFileContent(apis, types);

    this.writeGeneratedFile(filePath, content);
  }

  /**
   * 生成API文件内容
   * @param apis API接口数组
   * @param types 类型定义数组
   * @param tag 标签名称（可选）
   * @returns API文件内容
   */
  private generateApiFileContent(
    apis: ApiInfo[],
    types: TypeInfo[],
    tag?: string
  ): string {
    const importTemplate =
      this.config.importTemplate || "import { request } from '@/utils'";

    const header = [
      this.generateHeader([
        '/**',
        ` * ${tag ? `${tag} ` : ''}API 接口`,
        ' * 此文件由 swagger2api-v3 自动生成，请勿手动修改',
        ' */'
      ]),
      importTemplate + ';'
    ];
    const extractQueryParameterTypes = this.shouldExtractQueryParameterTypes();
    const queryParameterTypes = extractQueryParameterTypes
      ? generateQueryParameterTypes(
          apis,
          types.map((type) => type.name)
        )
      : [];
    const queryParameterTypeNames = queryParameterTypes.map(
      (type) => type.name
    );

    // 收集当前文件实际使用的类型
    const usedTypes = this.collectUsedTypes(
      apis,
      types,
      extractQueryParameterTypes
    );
    const queryParameterTypeByApi = new Map(
      queryParameterTypes.map((type) => [type.api, type.name])
    );

    // 添加类型导入（仅在 TypeScript 且生成类型文件时）
    if (
      this.config.generator === 'typescript' &&
      this.config.options?.generateModels !== false &&
      (usedTypes.length > 0 || (!tag && queryParameterTypeNames.length > 0))
    ) {
      const typeNames = Array.from(
        new Set([...usedTypes, ...(tag ? [] : queryParameterTypeNames)])
      )
        .sort()
        .join(', ');
      const typesPath = tag ? '../types' : './types';
      header.push(`import type { ${typeNames} } from '${typesPath}';`);
    }

    if (tag && queryParameterTypeNames.length > 0) {
      const typeNames = queryParameterTypeNames.sort().join(', ');
      header.push(`import type { ${typeNames} } from './types';`);
    }

    header.push('');

    const apiImplementations = apis
      .map((api) =>
        this.generateApiFunction(
          api,
          extractQueryParameterTypes
            ? queryParameterTypeByApi.get(api)
            : undefined
        )
      )
      .join('\n\n');

    return `${header.join('\n')}${apiImplementations}\n`;
  }

  /**
   * 生成单个API函数
   * @param api API接口信息
   * @param queryParameterTypeName 查询参数类型名
   * @returns API函数代码
   */
  private generateApiFunction(
    api: ApiInfo,
    queryParameterTypeName?: string
  ): string {
    const parts: string[] = [];

    // 生成注释
    if (this.config.options?.addComments !== false) {
      const pathParameterNames = this.createPathParameterNames(
        api.parameters.filter((parameter) => parameter.in === 'path')
      );
      let pathParameterIndex = 0;
      const swaggerParams = api.parameters.map((p) => ({
        name:
          p.in === 'path' ? pathParameterNames[pathParameterIndex++] : p.name,
        in: p.in,
        required: p.required,
        type: p.type,
        description: p.description
      }));
      const comment = generateApiComment(
        { summary: api.description, deprecated: api.deprecated },
        swaggerParams
      );
      parts.push(comment);
    }

    // 生成函数签名
    const swaggerParameters = api.parameters.map((p) => ({
      name: p.name,
      in: p.in,
      required: p.required,
      type: p.type,
      schema: p.schema || { type: p.type }
    }));

    // 生成直接参数形式
    const functionParams = this.generateDirectParameters(
      swaggerParameters,
      this.config.generator === 'javascript',
      queryParameterTypeName
    );
    const responseType =
      this.config.options?.generateModels === false
        ? 'any'
        : api.responseType || 'any';
    const functionName = toCamelCase(api.name);

    parts.push(`export const ${functionName} = (${functionParams}) => {`);

    // 生成请求配置
    const useGenericRequest = this.config.requestStyle === 'generic';
    const requestConfig = this.generateRequestConfig(api, useGenericRequest);
    const isJS = this.config.generator === 'javascript';
    if (useGenericRequest) {
      parts.push(
        isJS
          ? `  return request(${requestConfig});`
          : `  return request<${responseType}>(${requestConfig});`
      );
    } else {
      const method = api.method.toLowerCase();
      parts.push(
        isJS
          ? `  return request.${method}(${requestConfig});`
          : `  return request.${method}<${responseType}>(${requestConfig});`
      );
    }
    parts.push('}');

    return parts.join('\n');
  }

  /**
   * 生成直接参数形式
   * @param parameters OpenAPI 参数数组
   * @param isJavaScript 是否生成 JavaScript 参数
   * @param queryParameterTypeName 查询参数类型名
   * @returns 函数参数字符串
   */
  private generateDirectParameters(
    parameters: any[],
    isJavaScript: boolean = false,
    queryParameterTypeName?: string
  ): string {
    const params: string[] = [];

    const queryParams = parameters.filter((p) => p.in === 'query');
    const pathParams = parameters.filter((p) => p.in === 'path');
    const bodyParams = parameters.filter((p) => p.in === 'body');
    const bodyParam = bodyParams[0];
    const hasRequiredBody = bodyParam?.required === true;
    const pathParameterNames = this.createPathParameterNames(pathParams);

    pathParams.forEach((parameter, index) => {
      const parameterName = pathParameterNames[index];
      if (isJavaScript) {
        params.push(parameterName);
      } else {
        params.push(
          `${parameterName}: ${this.getSafeGeneratedType(parameter.type)}`
        );
      }
    });

    if (queryParams.length > 0) {
      if (isJavaScript) {
        params.push('params');
      } else {
        const allOptional = queryParams.every((p) => !p.required);
        const optionalModifier = allOptional && !hasRequiredBody ? '?' : '';
        if (queryParameterTypeName) {
          params.push(`params${optionalModifier}: ${queryParameterTypeName}`);
        } else {
          const paramType = this.renderInlineQueryParameterMembers(queryParams);
          params.push(`params${optionalModifier}: { ${paramType} }`);
        }
      }
    }

    // 请求体参数
    if (bodyParams.length > 0) {
      if (isJavaScript) {
        params.push('data');
      } else {
        const bodyType = bodyParam.type;
        const optionalModifier = bodyParam.required ? '' : '?';
        params.push(
          `data${optionalModifier}: ${this.getSafeGeneratedType(bodyType)}`
        );
      }
    }

    // 添加可选的config参数
    params.push(isJavaScript ? 'config' : 'config?: any');

    return params.join(', ');
  }

  /**
   * 获取当前配置下可安全输出的类型
   * @param type 类型字符串
   * @returns 安全类型字符串
   */
  private getSafeGeneratedType(type: string | undefined): string {
    if (!type) return 'any';
    if (this.config.options?.generateModels !== false) return type;
    return this.isPrimitiveType(type) ? type : 'any';
  }

  /**
   * 渲染内联查询参数类型成员
   * @param parameters 查询参数数组
   * @returns 内联类型成员
   */
  private renderInlineQueryParameterMembers(
    parameters: ApiInfo['parameters']
  ): string {
    return parameters
      .map((parameter) => {
        const optional = parameter.required ? '' : '?';
        let type = this.getSafeGeneratedType(parameter.type);
        if (optional) type = stripNullFromUnion(type);
        return `${formatTsPropertyName(parameter.name)}${optional}: ${type}`;
      })
      .join(', ');
  }

  /**
   * 收集API数组中实际使用的类型
   * @param apis API接口数组
   * @param definedTypes 已定义的类型数组
   * @param excludeQueryParameters 是否排除查询参数
   * @returns 使用的类型名称数组
   */
  private collectUsedTypes(
    apis: ApiInfo[],
    definedTypes?: TypeInfo[],
    excludeQueryParameters: boolean = false
  ): string[] {
    const usedTypes = new Set<string>();

    apis.forEach((api) => {
      // 收集响应类型
      if (api.responseType && api.responseType !== 'any') {
        // 提取泛型类型中的所有类型名称
        this.extractTypeNames(api.responseType).forEach((typeName) => {
          usedTypes.add(typeName);
        });
      }

      // 收集参数类型
      api.parameters.forEach((param) => {
        if (excludeQueryParameters && param.in === 'query') return;
        if (param.type && param.type !== 'any') {
          if (!this.isPrimitiveType(param.type)) {
            this.extractTypeNames(param.type).forEach((typeName) => {
              usedTypes.add(typeName);
            });
          }
        }
      });
    });

    // 如果提供了 definedTypes，则只保留已定义的类型
    if (definedTypes) {
      const definedTypeNames = new Set(definedTypes.map((t) => t.name));
      return Array.from(usedTypes)
        .filter((name) => definedTypeNames.has(name))
        .sort();
    }

    return Array.from(usedTypes).sort();
  }

  /**
   * 从类型字符串中提取所有类型名称（包括泛型参数）
   * @param typeStr 类型字符串，如 "ResOp<UserListRespDto>"
   * @returns 类型名称数组，如 ["ResOp", "UserListRespDto"]
   */
  private extractTypeNames(typeStr: string): string[] {
    const typeNames = new Set<string>();

    // 匹配所有标识符（类型名称）
    const matches = typeStr.match(/[A-Za-z_][A-Za-z0-9_]*/g);
    if (matches) {
      matches.forEach((match) => {
        if (!this.isPrimitiveType(match)) {
          typeNames.add(match);
        }
      });
    }

    return Array.from(typeNames);
  }

  /**
   * 判断是否为基础类型
   * @param type 类型名称
   * @returns 是否为基础类型
   */
  private isPrimitiveType(type: string): boolean {
    const primitiveTypes = [
      'string',
      'number',
      'boolean',
      'object',
      'array',
      'any',
      'blob',
      'void',
      'null',
      'undefined'
    ];
    return primitiveTypes.includes(type.toLowerCase());
  }

  /**
   * 生成请求配置
   * @param api API接口信息
   * @returns 请求配置代码
   */
  private generateRequestConfig(
    api: ApiInfo,
    includeMethod: boolean = false
  ): string {
    const config: string[] = [];

    // URL处理
    let url = api.path;

    // 添加prefix前缀
    if (this.config.prefix) {
      url = this.config.prefix + url;
    }

    const pathParams = api.parameters.filter((p) => p.in === 'path');
    const queryParams = api.parameters.filter((p) => p.in === 'query');
    const pathParameterNames = this.createPathParameterNames(pathParams);

    if (pathParams.length > 0) {
      url = this.escapeTemplateLiteral(url);
      pathParams.forEach((param, index) => {
        const placeholder = this.escapeTemplateLiteral(`{${param.name}}`);
        const replacement = `\${${pathParameterNames[index]}}`;
        url = url.split(placeholder).join(replacement);
      });
      config.push(`url: \`${url}\``);
    } else {
      config.push(`url: ${this.toSingleQuotedString(url)}`);
    }

    if (queryParams.length > 0) {
      config.push('params');
    }

    // 请求体数据
    const bodyParams = api.parameters.filter((p) => p.in === 'body');

    if (bodyParams.length > 0) {
      config.push('data');
    }

    // 在通用请求风格下添加 method 字段
    if (includeMethod) {
      config.push(`method: '${api.method}'`);
    }

    // 添加config参数合并
    config.push('...config');

    return `{\n    ${config.join(',\n    ')}\n  }`;
  }

  /**
   * 创建不重复的路径参数变量名
   * @param parameters OpenAPI 路径参数
   * @returns 路径参数变量名
   */
  private createPathParameterNames(
    parameters: ApiInfo['parameters']
  ): string[] {
    const usedNames = new Set(['params', 'data', 'config']);

    return parameters.map((parameter, index) => {
      const normalizedName = parameter.name.replace(/[^A-Za-z0-9_$]/g, '_');
      const baseName = isValidIdentifier(normalizedName)
        ? normalizedName
        : `pathParam${index + 1}`;
      let parameterName = baseName;
      let suffix = 2;

      while (usedNames.has(parameterName)) {
        parameterName = `${baseName}_${suffix}`;
        suffix++;
      }
      usedNames.add(parameterName);

      return parameterName;
    });
  }

  /**
   * 生成入口文件
   * @param groupedApis 按标签分组的API
   */
  private async generateIndexFile(
    groupedApis: Map<string, ApiInfo[]>
  ): Promise<void> {
    const exports: string[] = [];

    // 导出类型（仅在 TypeScript 且生成类型文件时）
    if (
      this.config.generator === 'typescript' &&
      this.config.options?.generateModels !== false
    ) {
      exports.push("export * from './types';");
    }

    if (this.config.options?.generateApis !== false) {
      if (this.config.groupByTags) {
        // 按标签导出
        for (const tag of groupedApis.keys()) {
          const folderName = this.getTagFileName(tag);
          exports.push(
            `export * from ${this.toSingleQuotedString(`./${folderName}`)};`
          );
        }
      } else {
        // 导出单个API文件
        exports.push("export * from './api';");
      }
    }

    const content = [this.generateHeader(), '', ...exports, ''].join('\n');

    const ext = this.config.generator === 'javascript' ? 'js' : 'ts';
    const filePath = this.resolveOutputPath(`index.${ext}`);
    this.writeGeneratedFile(filePath, content);
  }

  /**
   * 校验输出目录不会覆盖当前工作目录或其父目录
   */
  private assertSafeOutputDirectory(): void {
    const currentDirectory = path.resolve(process.cwd());

    if (
      this.outputRoot === currentDirectory ||
      isPathInside(this.outputRoot, currentDirectory)
    ) {
      throw new Error('输出目录不能是当前工作目录或其父目录');
    }
  }

  /**
   * 解析并校验输出目录内的文件路径
   * @param segments 输出目录下的路径片段
   * @returns 安全的绝对路径
   */
  private resolveOutputPath(...segments: string[]): string {
    const targetPath = path.resolve(this.outputRoot, ...segments);

    if (!isPathInside(this.outputRoot, targetPath)) {
      throw new Error(`生成路径超出输出目录: ${targetPath}`);
    }

    return targetPath;
  }

  /**
   * 写入生成文件，overwrite=false 时保留已存在文件
   * @param filePath 文件路径
   * @param content 文件内容
   */
  private writeGeneratedFile(filePath: string, content: string): void {
    if (this.config.overwrite === false && fs.existsSync(filePath)) {
      return;
    }

    writeFile(filePath, content);
  }

  /**
   * 获取标签对应的文件名
   * @param tag 标签名
   * @returns 文件名
   */
  private getTagFileName(tag: string): string {
    const cleanTag = sanitizeFilename(tag);
    let folderName: string;

    switch (this.config.tagGrouping?.fileNaming) {
      case 'camelCase':
        folderName = toCamelCase(cleanTag);
        break;
      case 'kebab-case':
        folderName = toKebabCase(cleanTag);
        break;
      case 'tag':
        folderName = cleanTag.toLowerCase();
        break;
      default:
        folderName = toCamelCase(cleanTag);
        break;
    }

    if (!folderName || folderName === '.' || folderName === '..') {
      throw new Error(`无效的标签名称: ${JSON.stringify(tag)}`);
    }

    return folderName;
  }

  /**
   * 校验所有标签生成的目录名称安全且不重复
   * @param groupedApis 按标签分组的 API
   */
  private validateTagFolders(groupedApis: Map<string, ApiInfo[]>): void {
    const folderOwners = new Map<string, string>();

    for (const tag of groupedApis.keys()) {
      const folderName = this.getTagFileName(tag);
      const normalizedFolderName = folderName.toLowerCase();
      const existingTag = folderOwners.get(normalizedFolderName);

      if (existingTag !== undefined && existingTag !== tag) {
        throw new Error(
          `标签目录名称冲突: ${existingTag} 和 ${tag} 都会生成 ${folderName}`
        );
      }

      folderOwners.set(normalizedFolderName, tag);
    }
  }

  /**
   * 转义模板字符串中的特殊字符
   * @param value 原始字符串
   * @returns 可安全写入模板字符串的内容
   */
  private escapeTemplateLiteral(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$\{/g, '\\${');
  }

  /**
   * 将字符串转换为安全的单引号字面量
   * @param value 原始字符串
   * @returns 单引号字符串字面量
   */
  private toSingleQuotedString(value: string): string {
    const escapedValue = value
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');

    return `'${escapedValue}'`;
  }

  /**
   * 生成文件头部注释
   * @param defaultHeader 默认头部注释
   * @returns 文件头部注释内容
   */
  private generateHeader(
    defaultHeader: string[] = [
      '/**',
      ' * API 入口文件',
      ' * 此文件由 swagger2api-v3 自动生成，请勿手动修改',
      ' */'
    ]
  ): string {
    return this.config.headerComment?.trim() || defaultHeader.join('\n');
  }

  /**
   * 在所有文件生成完成后运行lint命令
   */
  private async runLintOnAllFiles(): Promise<void> {
    if (!this.config.lint) return;

    try {
      logger.info(`执行 Lint 命令: ${this.config.lint} ${this.config.output}`);
      const result = await execPromise(
        `${this.config.lint} ${this.config.output}`
      );
      if (result.stdout) {
        logger.info(result.stdout.trim());
      }
      logger.success('Lint 执行完成');
    } catch (error: any) {
      logger.warn(`Lint 命令执行失败: ${error.message}`);
    }
  }
}
