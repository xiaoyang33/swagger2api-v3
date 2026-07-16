import {
  SwaggerParameter,
  SwaggerResponse,
  SwaggerResponses,
  SwaggerSchema
} from '../types';
import { swaggerTypeToTsType } from './schema';

export * from './schema';

/**
 * 将 OpenAPI 参数转换为 Schema 对象
 * @param parameter OpenAPI 参数
 * @returns 参数对应的 Schema
 */
export function swaggerParameterToSchema(
  parameter: SwaggerParameter
): SwaggerSchema {
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
 * 获取响应类型
 * @param responses OpenAPI 响应对象
 * @param schemas OpenAPI components.schemas
 * @returns TypeScript 类型字符串
 */
export function getResponseType(
  responses: SwaggerResponses,
  schemas: Record<string, SwaggerSchema> = {}
): string {
  if (!responses) return 'any';

  const successResponse = getSuccessResponse(responses);
  if (!successResponse) return 'any';

  const contentSchema = getSchemaFromContent(successResponse.content);
  if (contentSchema) {
    return swaggerTypeToTsType(contentSchema, schemas, 'response');
  }

  return successResponse.description === 'No Content' ? 'void' : 'any';
}

/**
 * 从响应集合中获取优先成功响应
 * @param responses OpenAPI 响应对象
 * @returns 成功响应对象
 */
function getSuccessResponse(
  responses: SwaggerResponses
): SwaggerResponse | undefined {
  if (responses['200']) return responses['200'] as SwaggerResponse;
  if (responses['201']) return responses['201'] as SwaggerResponse;

  const successStatus = Object.keys(responses)
    .filter((status) => /^2\d\d$/.test(status))
    .sort()[0];

  return successStatus
    ? (responses[successStatus] as SwaggerResponse)
    : (responses.default as SwaggerResponse | undefined);
}

/**
 * 从 OpenAPI content 对象中获取最合适的 Schema
 * @param content OpenAPI content 对象
 * @returns 匹配到的 Schema
 */
export function getSchemaFromContent(
  content: Record<string, { schema?: SwaggerSchema }> | undefined
): SwaggerSchema | undefined {
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
