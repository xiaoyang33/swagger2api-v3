import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { SwaggerDocument, SwaggerSchema, SwaggerParameter } from '../types';

/**
 * 工具函数集合
 */

/**
 * 将路径转换为小驼峰命名的函数名
 * @param method HTTP方法
 * @param path 接口路径
 * @returns 小驼峰命名的函数名
 */
export function pathToFunctionName(method: string, path: string): string {
  // 移除路径参数的大括号
  const cleanPath = path.replace(/\{([^}]+)\}/g, '$1');

  // 分割路径并过滤空字符串
  const segments = cleanPath.split('/').filter((segment) => segment.length > 0);

  // 将路径段转换为驼峰命名
  const pathParts = segments.map((part, index) => {
    // 移除特殊字符并转换为小驼峰
    const cleanPart = part.replace(/[^a-zA-Z0-9]/g, '');
    if (index === 0) {
      return cleanPart.toLowerCase();
    }
    return cleanPart.charAt(0).toUpperCase() + cleanPart.slice(1).toLowerCase();
  });

  // 将HTTP方法转换为首字母大写的形式并添加到末尾
  const methodSuffix =
    method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();

  // 组合路径名称和方法名称
  const baseName = pathParts.join('');
  return baseName + methodSuffix;
}

/**
 * 将字符串转换为kebab-case
 * @param str 输入字符串
 * @returns kebab-case字符串
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * 将字符串转换为PascalCase
 * @param str 输入字符串
 * @returns PascalCase字符串
 */
export function toPascalCase(str: string): string {
  return str
    .replace(/[\s-_]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''))
    .replace(/^(.)/, (char) => char.toUpperCase());
}

/**
 * 将字符串转换为camelCase
 * @param str 输入字符串
 * @returns camelCase字符串
 */
export function toCamelCase(str: string): string {
  const pascalCase = toPascalCase(str);
  return pascalCase.charAt(0).toLowerCase() + pascalCase.slice(1);
}

/**
 * 从方法名中移除指定的前缀
 * @param methodName 方法名
 * @param prefixes 需要移除的前缀数组
 * @returns 移除前缀后的方法名
 */
export function stripMethodNamePrefixes(
  methodName: string,
  prefixes?: string[]
): string {
  if (!prefixes || prefixes.length === 0) {
    return methodName;
  }

  let result = methodName;

  // 循环移除所有匹配的前缀，直到没有前缀可以移除
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of prefixes) {
      if (!prefix) continue;

      // 将前缀转换为小驼峰格式进行匹配
      const camelPrefix = toCamelCase(prefix);

      // 检查方法名是否以该前缀开头（不区分大小写）
      const lowerMethodName = result.toLowerCase();
      const lowerPrefix = camelPrefix.toLowerCase();

      if (lowerMethodName.startsWith(lowerPrefix)) {
        // 移除前缀，保持后续字符的大小写
        const remaining = result.substring(camelPrefix.length);

        // 如果移除前缀后还有内容，则更新结果
        if (remaining.length > 0) {
          // 确保首字母小写
          result = remaining.charAt(0).toLowerCase() + remaining.slice(1);
          changed = true;
          break; // 重新开始检查
        }
      }
    }
  }

  return result;
}

/**
 * 从函数名中移除 HTTP method 后缀
 * @param functionName 函数名
 * @param method HTTP 方法
 * @returns 移除后缀后的函数名
 */
export function removeMethodSuffix(
  functionName: string,
  method: string
): string {
  const methodSuffix =
    method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();

  if (functionName.endsWith(methodSuffix)) {
    return functionName.slice(0, -methodSuffix.length);
  }

  return functionName;
}

export function stripNullFromUnion(typeStr: string): string {
  if (!typeStr) return 'any';

  const parts: string[] = [];
  let current = '';
  let parenDepth = 0;
  let angleDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < typeStr.length; i++) {
    const ch = typeStr[i];

    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (ch === '<') angleDepth++;
    else if (ch === '>') angleDepth = Math.max(0, angleDepth - 1);
    else if (ch === '{') braceDepth++;
    else if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);
    else if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);

    const isTopLevel =
      parenDepth === 0 &&
      angleDepth === 0 &&
      braceDepth === 0 &&
      bracketDepth === 0;

    if (ch === '|' && isTopLevel) {
      parts.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.trim()) parts.push(current.trim());

  const normalized = Array.from(
    new Set(parts.filter((p) => p && p !== 'null'))
  );
  return normalized.length > 0 ? normalized.join(' | ') : 'any';
}

/**
 * 将Swagger类型转换为TypeScript类型
 * @param schema Swagger模式
 * @param schemas 可选的 schemas 上下文,用于查找被引用的类型定义
 * @returns TypeScript类型字符串
 */
export function swaggerTypeToTsType(schema: any, schemas?: any): string {
  if (!schema) return 'any';

  let baseType = 'any';

  // 处理 allOf (通常用于继承或泛型)
  if (schema.allOf) {
    // 简单处理：如果是引用 + 对象定义，可能是泛型包装
    const refSchema = schema.allOf.find((s: any) => s.$ref);
    const secondSchema = schema.allOf.find((s: any) => !s.$ref);

    if (refSchema && secondSchema) {
      const refName = refSchema.$ref.split('/').pop();
      const sanitizedRefName = sanitizeTypeName(refName || '');

      // 检查是否是泛型容器 (如 ResOp)
      // 注意：secondSchema 可能没有显式声明 type: 'object'，但如果有 properties，则视为对象
      if (secondSchema.properties) {
        // 尝试提取泛型参数类型
        // 这里假设泛型参数是 properties 中的第一个属性
        const propertyTypes: string[] = [];

        for (const [propName, propSchema] of Object.entries(
          secondSchema.properties
        )) {
          const propType = swaggerTypeToTsType(propSchema as any, schemas);
          propertyTypes.push(propType);
        }

        // 如果只有一个属性，直接作为泛型参数
        if (propertyTypes.length === 1) {
          baseType = `${sanitizedRefName}<${propertyTypes[0]}>`;
        }
        // 如果有多个属性，组合成联合类型或对象类型
        else if (propertyTypes.length > 1) {
          const combinedType = `{ ${Object.entries(secondSchema.properties)
            .map(([key, value]: [string, any]) => {
              const optional = secondSchema.required?.includes(key) ? '' : '?';
              let type = swaggerTypeToTsType(value as any, schemas);
              if (optional === '?') type = stripNullFromUnion(type);
              return `${key}${optional}: ${type}`;
            })
            .join('; ')} }`;
          baseType = `${sanitizedRefName}<${combinedType}>`;
        } else {
          baseType = sanitizedRefName || 'any';
        }
      } else {
        baseType = sanitizedRefName || 'any';
      }
    } else {
      // 如果不是引用，尝试合并所有类型
      const types = schema.allOf
        .map((s: any) => swaggerTypeToTsType(s))
        .filter((t: string) => t !== 'any');
      baseType = types.length > 0 ? types[0] : 'any';
    }
  }
  // 处理 anyOf 或 oneOf
  else if (schema.anyOf || schema.oneOf) {
    const types = (schema.anyOf || schema.oneOf).map((s: any) => {
      // 特殊处理 type: 'null'
      if (s.type === 'null') return 'null';
      return swaggerTypeToTsType(s, schemas);
    });

    // 如果包含 any，则直接返回 any
    if (types.includes('any')) {
      baseType = 'any';
    } else {
      // 去重
      const uniqueTypes = Array.from(new Set(types));

      if (uniqueTypes.length > 0) {
        baseType = uniqueTypes.join(' | ');
      } else {
        baseType = 'any';
      }
    }
  }
  // 处理引用类型
  else if (schema.$ref) {
    const refName = schema.$ref.split('/').pop();
    baseType = sanitizeTypeName(refName || 'any');

    // 如果提供了 schemas 上下文,检查被引用的 schema 是否是数组类型
    if (
      schemas &&
      refName &&
      typeof schema.$ref === 'string' &&
      schema.$ref.startsWith('#/')
    ) {
      const referencedSchema = schemas[refName];
      if (referencedSchema && referencedSchema.type === 'array') {
        // 被引用的 schema 是数组类型,添加 []
        baseType = `${baseType}[]`;
      }
    }
  }
  // 处理数组类型
  else if (schema.type === 'array') {
    const itemSchema = schema.items;
    const itemType = swaggerTypeToTsType(itemSchema, schemas);

    if (
      itemSchema?.$ref &&
      schemas &&
      typeof itemSchema.$ref === 'string' &&
      itemSchema.$ref.startsWith('#/')
    ) {
      const refName = itemSchema.$ref.split('/').pop();
      const referencedSchema = refName ? schemas[refName] : undefined;
      if (referencedSchema?.type === 'array') {
        baseType = itemType;
      } else {
        baseType = `${itemType}[]`;
      }
    } else {
      baseType = `${itemType}[]`;
    }
  }
  // 处理对象类型
  else if (schema.type === 'object') {
    if (schema.properties) {
      const properties = Object.entries(schema.properties)
        .map(([key, value]: [string, any]) => {
          const optional = schema.required?.includes(key) ? '' : '?';
          let type = swaggerTypeToTsType(value, schemas);
          if (optional === '?') type = stripNullFromUnion(type);
          return `  ${key}${optional}: ${type};`;
        })
        .join('\n');
      baseType = `{\n${properties}\n}`;
    } else {
      baseType = 'Record<string, any>';
    }
  }
  // 处理基本类型
  else {
    switch (schema.type) {
      case 'integer':
      case 'number':
        baseType = 'number';
        break;
      case 'string':
        if (schema.enum) {
          baseType = schema.enum.map((value: any) => `'${value}'`).join(' | ');
        } else {
          baseType = 'string';
        }
        break;
      case 'boolean':
        baseType = 'boolean';
        break;
      case 'file':
        baseType = 'File';
        break;
      case 'null': // Add this
        baseType = 'null';
        break;
      default:
        baseType = 'any';
        break;
    }
  }

  // 处理 nullable 属性
  if (schema.nullable === true) {
    if (baseType === 'any') return 'any';
    if (baseType.includes('null')) return baseType;
    return `${baseType} | null`;
  }

  return baseType;
}

/**
 * 从Swagger参数生成TypeScript参数类型
 * @param parameters Swagger参数数组
 * @returns TypeScript参数类型定义
 */
export function generateParameterTypes(parameters: SwaggerParameter[]): string {
  if (!parameters || parameters.length === 0) {
    return '';
  }

  const queryParams = parameters.filter((p) => p.in === 'query');
  const pathParams = parameters.filter((p) => p.in === 'path');
  const bodyParams = parameters.filter((p) => p.in === 'body');
  const formParams = parameters.filter((p) => p.in === 'formData');

  const types: string[] = [];

  // 路径参数
  if (pathParams.length > 0) {
    const pathType = pathParams
      .map(
        (p) => `${p.name}: ${swaggerTypeToTsType({ type: p.type || 'string' })}`
      )
      .join(', ');
    types.push(`pathParams: { ${pathType} }`);
  }

  // 查询参数
  if (queryParams.length > 0) {
    const queryType = queryParams
      .map((p) => {
        const optional = p.required ? '' : '?';
        return `${p.name}${optional}: ${swaggerTypeToTsType({ type: p.type || 'string' })}`;
      })
      .join(', ');
    types.push(
      `queryParams${queryParams.every((p) => !p.required) ? '?' : ''}: { ${queryType} }`
    );
  }

  // 请求体参数
  if (bodyParams.length > 0) {
    const bodyParam = bodyParams[0];
    const bodyType = swaggerTypeToTsType(bodyParam.schema);
    types.push(`data: ${bodyType}`);
  }

  // 表单参数
  if (formParams.length > 0) {
    const formType = formParams
      .map((p) => {
        const optional = p.required ? '' : '?';
        return `${p.name}${optional}: ${swaggerTypeToTsType({ type: p.type || 'string' })}`;
      })
      .join(', ');
    types.push(`data: { ${formType} }`);
  }

  return types.join(', ');
}

/**
 * 确保目录存在，如果不存在则创建
 * @param dirPath 目录路径
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 删除目录及其所有内容
 * @param dirPath 目录路径
 */
export function removeDirectory(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * 读取Swagger文档
 * @param input 文件路径或URL
 * @returns Swagger文档对象
 */
export async function loadSwaggerDocument(
  input: string
): Promise<SwaggerDocument> {
  try {
    if (input.startsWith('http://') || input.startsWith('https://')) {
      const { data } = await axios.get(input);
      console.log('Loaded from URL:', input);
      if (data.components?.schemas) {
        console.log(
          'Schemas count:',
          Object.keys(data.components.schemas).length
        );
      } else {
        console.log('No schemas in loaded data');
      }
      return data;
    } else {
      // 从文件加载
      const content = fs.readFileSync(input, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    throw new Error(`Failed to load Swagger document from ${input}: ${error}`);
  }
}

/**
 * 写入文件
 * @param filePath 文件路径
 * @param content 文件内容
 */
export function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  ensureDirectoryExists(dir);
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * 生成接口注释
 * @param operation Swagger操作对象
 * @param parameters 参数列表
 * @returns 注释字符串
 */
export function generateApiComment(
  operation: any,
  parameters: SwaggerParameter[]
): string {
  const comments: string[] = ['/**'];

  if (operation.summary) {
    comments.push(` * ${operation.summary}`);
  }

  if (operation.description && operation.description !== operation.summary) {
    comments.push(` * ${operation.description}`);
  }

  if (parameters && parameters.length > 0) {
    // 收集不同类型的参数
    const queryParams = parameters.filter((p) => p.in === 'query');
    const pathParams = parameters.filter((p) => p.in === 'path');
    const bodyParams = parameters.filter((p) => p.in === 'body');
    const formParams = parameters.filter((p) => p.in === 'formData');

    const hasParams = queryParams.length > 0 || pathParams.length > 0;
    const hasData = bodyParams.length > 0 || formParams.length > 0;

    if (hasParams || hasData) {
      comments.push(' *');

      // 如果有查询参数或路径参数，添加params注释
      if (hasParams) {
        const paramDescriptions = [...pathParams, ...queryParams]
          .map((p) => p.description || '')
          .filter((desc) => desc)
          .join(', ');
        const description = paramDescriptions || '请求参数';
        comments.push(` * @param params ${description}`);
      }

      // 如果有请求体参数，添加data注释
      if (hasData) {
        const dataParam = bodyParams[0] || formParams[0];
        const description = dataParam?.description || '请求数据';
        comments.push(` * @param data ${description}`);
      }

      // 添加config参数注释
      comments.push(` * @param config 可选的请求配置`);
    }
  }

  if (operation.deprecated) {
    comments.push(' * @deprecated');
  }

  comments.push(' */');

  return comments.join('\n');
}

/**
 * 清理文件名，移除非法字符
 * @param filename 文件名
 * @returns 清理后的文件名
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, '-');
}

/**
 * 获取响应类型
 * @param responses Swagger响应对象
 * @returns TypeScript类型字符串
 */
export function getResponseType(responses: any): string {
  if (!responses) {
    return 'any';
  }

  // 优先获取200响应
  const successResponse =
    responses['200'] || responses['201'] || responses['default'];

  if (!successResponse) {
    return 'any';
  }

  // 支持OpenAPI 3.0格式 (content.application/json.schema)
  if (
    successResponse.content &&
    successResponse.content['application/json'] &&
    successResponse.content['application/json'].schema
  ) {
    return swaggerTypeToTsType(
      successResponse.content['application/json'].schema
    );
  }

  // 支持Swagger 2.0格式 (直接schema)
  if (successResponse.schema) {
    return swaggerTypeToTsType(successResponse.schema);
  }

  return 'any';
}

export function sanitizeTypeName(name: string): string {
  if (!name) return name;
  // 1. 替换非法字符（包括点号）为下划线
  const replaced = name.replace(/[^a-zA-Z0-9_]/g, '_');
  // 2. 转换为 PascalCase
  // 使用现有的 toPascalCase，它能处理下划线
  return toPascalCase(replaced);
}
