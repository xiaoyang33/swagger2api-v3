import { SwaggerParameter } from '../types';
import { sanitizeTypeName } from './naming';

/**
 * 移除联合类型中的顶层 null 类型
 * @param typeStr 类型字符串
 * @returns 移除 null 后的类型字符串
 */
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
    new Set(parts.filter((part) => part && part !== 'null'))
  );
  return normalized.length > 0 ? normalized.join(' | ') : 'any';
}

/**
 * 将 OpenAPI schema 转换为 TypeScript 类型
 * @param schema OpenAPI schema
 * @param schemas 可选的 schemas 上下文，用于查找被引用的类型定义
 * @returns TypeScript类型字符串
 */
export function swaggerTypeToTsType(schema: any, schemas?: any): string {
  if (!schema) return 'any';

  let baseType = 'any';

  if (Array.isArray(schema.type)) {
    const types = schema.type.map((type: string) =>
      swaggerTypeToTsType({ ...schema, type, nullable: false }, schemas)
    );
    const uniqueTypes = Array.from(new Set(types));
    baseType = uniqueTypes.includes('any') ? 'any' : uniqueTypes.join(' | ');
  } else if (schema.enum) {
    baseType = schema.enum
      .map((value: any) => toLiteralType(value))
      .join(' | ');
  } else if (schema.allOf) {
    const refSchema = schema.allOf.find((item: any) => item.$ref);
    const secondSchema = schema.allOf.find((item: any) => !item.$ref);

    if (refSchema && secondSchema) {
      const refName = refSchema.$ref.split('/').pop();
      const sanitizedRefName = sanitizeTypeName(refName || '');

      if (secondSchema.properties) {
        const propertyTypes: string[] = [];

        for (const propSchema of Object.values(secondSchema.properties)) {
          const propType = swaggerTypeToTsType(propSchema as any, schemas);
          propertyTypes.push(propType);
        }

        if (propertyTypes.length === 1) {
          baseType = `${sanitizedRefName}<${propertyTypes[0]}>`;
        } else if (propertyTypes.length > 1) {
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
      const types = schema.allOf
        .map((item: any) => swaggerTypeToTsType(item))
        .filter((type: string) => type !== 'any');
      baseType = types.length > 0 ? types[0] : 'any';
    }
  } else if (schema.anyOf || schema.oneOf) {
    const types = (schema.anyOf || schema.oneOf).map((item: any) => {
      if (item.type === 'null') return 'null';
      return swaggerTypeToTsType(item, schemas);
    });

    if (types.includes('any')) {
      baseType = 'any';
    } else {
      const uniqueTypes = Array.from(new Set(types));
      baseType = uniqueTypes.length > 0 ? uniqueTypes.join(' | ') : 'any';
    }
  } else if (schema.$ref) {
    const refName = schema.$ref.split('/').pop();
    baseType = sanitizeTypeName(refName || 'any');

    if (schemas && refName) {
      const referencedSchema = schemas[refName];
      if (referencedSchema && referencedSchema.type === 'array') {
        baseType = `${baseType}[]`;
      }
    }
  } else if (schema.type === 'array') {
    const itemSchema = schema.items;
    const itemType = swaggerTypeToTsType(itemSchema, schemas);

    if (itemSchema?.$ref && schemas) {
      const refName = itemSchema.$ref.split('/').pop();
      const referencedSchema = refName ? schemas[refName] : undefined;
      baseType =
        referencedSchema?.type === 'array' ? itemType : `${itemType}[]`;
    } else {
      baseType = `${itemType}[]`;
    }
  } else if (schema.type === 'object') {
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
    } else if (
      schema.additionalProperties &&
      typeof schema.additionalProperties === 'object'
    ) {
      const valueType = swaggerTypeToTsType(
        schema.additionalProperties,
        schemas
      );
      baseType = `Record<string, ${valueType}>`;
    } else if (schema.additionalProperties === false) {
      baseType = 'Record<string, never>';
    } else {
      baseType = 'Record<string, any>';
    }
  } else {
    switch (schema.type) {
      case 'integer':
      case 'number':
        baseType = 'number';
        break;
      case 'string':
        baseType = 'string';
        break;
      case 'boolean':
        baseType = 'boolean';
        break;
      case 'file':
        baseType = 'File';
        break;
      case 'null':
        baseType = 'null';
        break;
      default:
        baseType = 'any';
        break;
    }
  }

  if (schema.nullable === true) {
    if (baseType === 'any') return 'any';
    if (baseType.includes('null')) return baseType;
    return `${baseType} | null`;
  }

  return baseType;
}

/**
 * 将枚举值转换为 TypeScript 字面量类型
 * @param value 枚举值
 * @returns 字面量类型字符串
 */
function toLiteralType(value: any): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return `'${value}'`;
  return String(value);
}

/**
 * 将 OpenAPI 参数转换为 schema 对象
 * @param parameter OpenAPI 参数
 * @returns 参数对应的 schema
 */
export function swaggerParameterToSchema(parameter: SwaggerParameter): any {
  if (parameter.schema) {
    return parameter.schema;
  }

  return {
    type: parameter.type || (parameter.items ? 'array' : 'string'),
    format: parameter.format,
    items: parameter.items,
    enum: parameter.enum
  };
}

/**
 * 从 OpenAPI 参数生成 TypeScript 参数类型
 * @param parameters OpenAPI 参数数组
 * @returns TypeScript参数类型定义
 */
export function generateParameterTypes(parameters: SwaggerParameter[]): string {
  if (!parameters || parameters.length === 0) {
    return '';
  }

  const queryParams = parameters.filter((param) => param.in === 'query');
  const pathParams = parameters.filter((param) => param.in === 'path');
  const bodyParams = parameters.filter((param) => param.in === 'body');
  const types: string[] = [];

  if (pathParams.length > 0) {
    const pathType = pathParams
      .map(
        (param) =>
          `${param.name}: ${swaggerTypeToTsType(swaggerParameterToSchema(param))}`
      )
      .join(', ');
    types.push(`pathParams: { ${pathType} }`);
  }

  if (queryParams.length > 0) {
    const queryType = queryParams
      .map((param) => {
        const optional = param.required ? '' : '?';
        return `${param.name}${optional}: ${swaggerTypeToTsType(swaggerParameterToSchema(param))}`;
      })
      .join(', ');
    types.push(
      `queryParams${queryParams.every((param) => !param.required) ? '?' : ''}: { ${queryType} }`
    );
  }

  if (bodyParams.length > 0) {
    const bodyParam = bodyParams[0];
    const bodyType = swaggerTypeToTsType(bodyParam.schema);
    types.push(`data: ${bodyType}`);
  }

  return types.join(', ');
}

/**
 * 获取响应类型
 * @param responses OpenAPI 响应对象
 * @param schemas OpenAPI components.schemas
 * @returns TypeScript类型字符串
 */
export function getResponseType(responses: any, schemas?: any): string {
  if (!responses) {
    return 'any';
  }

  const successResponse = getSuccessResponse(responses);

  if (!successResponse) {
    return 'any';
  }

  const contentSchema = getSchemaFromContent(successResponse.content);
  if (contentSchema) {
    return swaggerTypeToTsType(contentSchema, schemas);
  }

  return successResponse.description === 'No Content' ? 'void' : 'any';
}

/**
 * 从响应集合中获取优先成功响应
 * @param responses OpenAPI响应对象
 * @returns 成功响应对象
 */
function getSuccessResponse(responses: any): any {
  if (responses['200']) return responses['200'];
  if (responses['201']) return responses['201'];

  const successStatus = Object.keys(responses)
    .filter((status) => /^2\d\d$/.test(status))
    .sort()[0];

  return successStatus ? responses[successStatus] : responses.default;
}

/**
 * 从 OpenAPI content 对象中获取最合适的 schema
 * @param content OpenAPI content 对象
 * @returns 匹配到的 schema
 */
export function getSchemaFromContent(content: any): any {
  if (!content) return undefined;

  const exactJson = content['application/json']?.schema;
  if (exactJson) return exactJson;

  const jsonLikeMediaType = Object.keys(content).find(
    (mediaType) => mediaType.endsWith('+json') || mediaType.includes('/json')
  );
  if (jsonLikeMediaType && content[jsonLikeMediaType]?.schema) {
    return content[jsonLikeMediaType].schema;
  }

  const firstMediaTypeWithSchema = Object.keys(content).find(
    (mediaType) => content[mediaType]?.schema
  );
  return firstMediaTypeWithSchema
    ? content[firstMediaTypeWithSchema].schema
    : undefined;
}
