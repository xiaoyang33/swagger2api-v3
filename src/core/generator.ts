import * as path from 'path';
import { SwaggerConfig, ApiInfo, TypeInfo } from '../types';
import {
  writeFile,
  ensureDirectoryExists,
  removeDirectory,
  generateApiComment,
  generateParameterTypes,
  sanitizeFilename,
  toKebabCase,
  toCamelCase,
  swaggerTypeToTsType
} from '../utils';

/**
 * 代码生成器
 */
export class CodeGenerator {
  private config: SwaggerConfig;

  constructor(config: SwaggerConfig) {
    this.config = config;
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
    // 根据overwrite配置决定是否清空目录
    if (this.config.overwrite !== false) {
      // 默认为true，清空输出目录
      removeDirectory(this.config.output);
    }
    
    // 确保输出目录存在
    ensureDirectoryExists(this.config.output);

    // 生成类型文件
    if (this.config.options?.generateModels !== false) {
      await this.generateTypesFile(types);
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
    const filePath = path.join(this.config.output, 'types.ts');
    writeFile(filePath, content);
  }

  /**
   * 生成类型文件内容
   * @param types 类型定义数组
   * @returns 类型文件内容
   */
  private generateTypesContent(types: TypeInfo[]): string {
    const header = [
      '/**',
      ' * API 类型定义',
      ' * 此文件由 swagger2api 自动生成，请勿手动修改',
      ' */',
      ''
    ].join('\n');

    const typeDefinitions = types
      .map(type => {
        const comment = type.description
          ? `/**\n * ${type.description}\n */\n`
          : '';
        return `${comment}${type.definition}`;
      })
      .join('\n\n');

    return `${header}${typeDefinitions}\n`;
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
      const tagFolderPath = path.join(this.config.output, folderName);
      
      // 确保tag文件夹存在
      ensureDirectoryExists(tagFolderPath);
      
      const filePath = path.join(tagFolderPath, 'index.ts');
      const content = this.generateApiFileContent(apis, types, tag);
      
      writeFile(filePath, content);
    }
  }

  /**
   * 生成单个API文件
   * @param apis API接口数组
   * @param types 类型定义数组
   */
  private async generateSingleApiFile(apis: ApiInfo[], types: TypeInfo[]): Promise<void> {
    const filePath = path.join(this.config.output, 'api.ts');
    const content = this.generateApiFileContent(apis, types);
    
    writeFile(filePath, content);
  }

  /**
   * 生成API文件内容
   * @param apis API接口数组
   * @param types 类型定义数组
   * @param tag 标签名称（可选）
   * @returns API文件内容
   */
  private generateApiFileContent(apis: ApiInfo[], types: TypeInfo[], tag?: string): string {
    const importTemplate = this.config.importTemplate || "import { request } from '@/utils'";
    
    const header = [
      '/**',
      ` * ${tag ? `${tag} ` : ''}API 接口`,
      ' * 此文件由 swagger2api 自动生成，请勿手动修改',
      ' */',
      '',
      importTemplate + ';'
    ];

    // 收集当前文件实际使用的类型
    const usedTypes = this.collectUsedTypes(apis);
    
    // 添加类型导入
    if (usedTypes.length > 0) {
      const typeNames = usedTypes.join(', ');
      const typesPath = tag ? '../types' : './types';
      header.push(`import type { ${typeNames} } from '${typesPath}';`);
    }

    header.push('');

    const apiImplementations = apis.map(api => this.generateApiFunction(api)).join('\n\n');

    return `${header.join('\n')}${apiImplementations}\n`;
  }

  /**
   * 生成单个API函数
   * @param api API接口信息
   * @returns API函数代码
   */
  private generateApiFunction(api: ApiInfo): string {
    const parts: string[] = [];

    // 生成注释
    if (this.config.options?.addComments !== false) {
      const swaggerParams = api.parameters.map(p => ({
        name: p.name,
        in: p.in,
        required: p.required,
        type: p.type,
        description: p.description
      }));
      const comment = generateApiComment(
        { summary: api.description, deprecated: false },
        swaggerParams
      );
      parts.push(comment);
    }

    // 生成函数签名
    const swaggerParameters = api.parameters.map(p => ({
      name: p.name,
      in: p.in,
      required: p.required,
      type: p.type,
      schema: p.schema || { type: p.type }
    }));
    
    // 生成直接参数形式
    const functionParams = this.generateDirectParameters(swaggerParameters);
    const responseType = api.responseType || 'any';
    const functionName = toCamelCase(api.name);
    
    parts.push(`export const ${functionName} = (${functionParams}) => {`);

    // 生成请求配置
    const requestConfig = this.generateRequestConfig(api);
    parts.push(`  return request.${api.method.toLowerCase()}<${responseType}>(${requestConfig});`);
    parts.push('}');

    return parts.join('\n');
  }

  /**
   * 生成直接参数形式
   * @param parameters Swagger参数数组
   * @returns 函数参数字符串
   */
  private generateDirectParameters(parameters: any[]): string {
    const params: string[] = [];
    
    const queryParams = parameters.filter(p => p.in === 'query');
    const pathParams = parameters.filter(p => p.in === 'path');
    const bodyParams = parameters.filter(p => p.in === 'body');
    const formParams = parameters.filter(p => p.in === 'formData');
    
    // 合并路径参数和查询参数为一个params对象
    const allParams = [...pathParams, ...queryParams];
    if (allParams.length > 0) {
      const paramType = allParams
        .map(p => {
          const optional = p.required ? '' : '?';
          return `${p.name}${optional}: ${p.type}`;
        })
        .join(', ');
      
      // 检查是否所有参数都是可选的
      const allOptional = allParams.every(p => !p.required);
      const optionalModifier = allOptional ? '?' : '';
      
      params.push(`params${optionalModifier}: { ${paramType} }`);
    }
    
    // 请求体参数
    if (bodyParams.length > 0) {
      const bodyParam = bodyParams[0];
      const bodyType = bodyParam.schema ? this.getTypeFromSchema(bodyParam.schema) : bodyParam.type;
      params.push(`data: ${bodyType}`);
    }
    
    // 表单参数
    if (formParams.length > 0) {
      const formType = formParams
        .map(p => {
          const optional = p.required ? '' : '?';
          return `${p.name}${optional}: ${p.type}`;
        })
        .join(', ');
      params.push(`data: { ${formType} }`);
    }
    
    // 添加可选的config参数
    params.push('config?: any');
    
    return params.join(', ');
  }
  
  /**
   * 从schema获取类型
   * @param schema Swagger schema
   * @returns 类型字符串
   */
  private getTypeFromSchema(schema: any): string {
    if (schema.$ref) {
      return schema.$ref.split('/').pop() || 'any';
    }
    return swaggerTypeToTsType(schema);
  }

  /**
   * 收集API数组中实际使用的类型
   * @param apis API接口数组
   * @returns 使用的类型名称数组
   */
  private collectUsedTypes(apis: ApiInfo[]): string[] {
    const usedTypes = new Set<string>();

    apis.forEach(api => {
      // 收集响应类型
      if (api.responseType && api.responseType !== 'any') {
        usedTypes.add(api.responseType);
      }

      // 收集参数类型
      api.parameters.forEach(param => {
        if (param.schema) {
          const type = this.getTypeFromSchema(param.schema);
          if (type && type !== 'any' && !this.isPrimitiveType(type)) {
            usedTypes.add(type);
          }
        } else if (param.type && !this.isPrimitiveType(param.type)) {
          usedTypes.add(param.type);
        }
      });
    });

    return Array.from(usedTypes).sort();
  }

  /**
   * 判断是否为基础类型
   * @param type 类型名称
   * @returns 是否为基础类型
   */
  private isPrimitiveType(type: string): boolean {
    const primitiveTypes = ['string', 'number', 'boolean', 'object', 'array', 'any', 'void', 'null', 'undefined'];
    return primitiveTypes.includes(type.toLowerCase());
  }

  /**
   * 生成请求配置
   * @param api API接口信息
   * @returns 请求配置代码
   */
  private generateRequestConfig(api: ApiInfo): string {
    const config: string[] = [];
    
    // URL处理
    let url = api.path;
    
    // 添加prefix前缀
    if (this.config.prefix) {
      url = this.config.prefix + url;
    }
    
    const pathParams = api.parameters.filter(p => p.in === 'path');
    const queryParams = api.parameters.filter(p => p.in === 'query');
    
    if (pathParams.length > 0) {
      // 替换路径参数，从params对象中获取
      pathParams.forEach(param => {
        url = url.replace(`{${param.name}}`, `\${params.${param.name}}`);
      });
      config.push(`url: \`${url}\``);
    } else {
      config.push(`url: '${url}'`);
    }

    // 查询参数和路径参数都从params对象中获取
    if (queryParams.length > 0) {
      // 直接传递params对象，让axios自动过滤undefined值
      config.push('params');
    }

    // 请求体数据
    const bodyParams = api.parameters.filter(p => p.in === 'body');
    const formParams = api.parameters.filter(p => p.in === 'formData');
    
    if (bodyParams.length > 0) {
      config.push('data');
    } else if (formParams.length > 0) {
      config.push('data');
    }
    
    // 添加config参数合并
    config.push('...config');

    return `{\n    ${config.join(',\n    ')}\n  }`;
  }

  /**
   * 生成入口文件
   * @param groupedApis 按标签分组的API
   */
  private async generateIndexFile(groupedApis: Map<string, ApiInfo[]>): Promise<void> {
    const exports: string[] = [];
    
    // 导出类型
    exports.push("export * from './types';");
    
    if (this.config.groupByTags) {
      // 按标签导出
      for (const tag of groupedApis.keys()) {
        const folderName = this.getTagFileName(tag);
        exports.push(`export * from './${folderName}';`);
      }
    } else {
      // 导出单个API文件
      exports.push("export * from './api';");
    }

    const content = [
      '/**',
      ' * API 入口文件',
      ' * 此文件由 swagger2api 自动生成，请勿手动修改',
      ' */',
      '',
      ...exports,
      ''
    ].join('\n');

    const filePath = path.join(this.config.output, 'index.ts');
    writeFile(filePath, content);
  }

  /**
   * 获取标签对应的文件名
   * @param tag 标签名
   * @returns 文件名
   */
  private getTagFileName(tag: string): string {
    const cleanTag = sanitizeFilename(tag);
    
    switch (this.config.tagGrouping?.fileNaming) {
      case 'camelCase':
        return toCamelCase(cleanTag);
      case 'kebab-case':
        return toKebabCase(cleanTag);
      case 'tag':
      default:
        return cleanTag.toLowerCase();
    }
  }

  /**
   * 在所有文件生成完成后运行lint命令
   */
  private async runLintOnAllFiles(): Promise<void> {
    if (!this.config.lint) return;
    
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);
      
      console.log(`🎨 Running lint command: ${this.config.lint} ${this.config.output}`);
      const result = await execPromise(`${this.config.lint} ${this.config.output}`);
      if (result.stdout) {
        console.log(result.stdout);
      }
      console.log('✅ Lint completed successfully');
    } catch (error: any) {
      console.warn(`⚠️  Failed to run lint command:`, error.message);
    }
  }
}