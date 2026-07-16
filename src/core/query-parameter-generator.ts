import { ApiInfo, TypeInfo } from '../types';
import {
  escapeJSDocText,
  formatTsPropertyName,
  sanitizeTypeName,
  stripNullFromUnion
} from '../utils';

const PRIMITIVE_TYPES = new Set([
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
]);

/** API 查询参数类型及其所属接口 */
export interface QueryParameterTypeInfo extends TypeInfo {
  /** 所属 API */
  api: ApiInfo;
}

/**
 * 获取 API 查询参数类型名称
 * @param api API 接口信息
 * @returns 查询参数类型名称
 */
export function getQueryParameterTypeName(api: ApiInfo): string {
  return `${sanitizeTypeName(api.name)}Params`;
}

/**
 * 创建 API 查询参数类型
 * @param apis API 接口数组
 * @param reservedTypeNames 已占用的类型名称
 * @returns 查询参数类型定义
 */
export function generateQueryParameterTypes(
  apis: ApiInfo[],
  reservedTypeNames: Iterable<string> = []
): QueryParameterTypeInfo[] {
  const parameterTypes: QueryParameterTypeInfo[] = [];
  const usedTypeNames = new Set(reservedTypeNames);

  for (const api of apis) {
    const queryParameters = api.parameters.filter(
      (parameter) => parameter.in === 'query'
    );
    if (queryParameters.length === 0) continue;

    const typeName = createAvailableTypeName(
      getQueryParameterTypeName(api),
      usedTypeNames
    );
    usedTypeNames.add(typeName);

    const members = renderQueryParameterMembers(queryParameters);
    parameterTypes.push({
      api,
      name: typeName,
      definition: `export interface ${typeName} {\n${members}\n}`
    });
  }

  return parameterTypes;
}

/**
 * 创建未被占用的类型名称
 * @param baseName 基础类型名称
 * @param usedTypeNames 已占用的类型名称
 * @returns 可用类型名称
 */
function createAvailableTypeName(
  baseName: string,
  usedTypeNames: Set<string>
): string {
  if (!usedTypeNames.has(baseName)) return baseName;

  let suffix = 1;
  while (usedTypeNames.has(`${baseName}${suffix}`)) suffix++;
  return `${baseName}${suffix}`;
}

/**
 * 收集查询参数类型依赖的组件模型
 * @param apis API 接口数组
 * @param modelTypes 组件模型类型
 * @returns 组件模型名称
 */
export function collectQueryParameterModelTypes(
  apis: ApiInfo[],
  modelTypes: TypeInfo[]
): string[] {
  const modelTypeNames = new Set(modelTypes.map((type) => type.name));
  const usedTypeNames = new Set<string>();

  for (const api of apis) {
    for (const parameter of api.parameters) {
      if (parameter.in !== 'query') continue;
      extractTypeNames(parameter.type).forEach((name) => {
        if (modelTypeNames.has(name)) usedTypeNames.add(name);
      });
    }
  }

  return Array.from(usedTypeNames).sort();
}

/**
 * 渲染查询参数类型成员
 * @param parameters 查询参数数组
 * @returns 查询参数类型成员
 */
function renderQueryParameterMembers(
  parameters: ApiInfo['parameters']
): string {
  return parameters
    .map((parameter) => {
      const optional = parameter.required ? '' : '?';
      const type = optional
        ? stripNullFromUnion(parameter.type)
        : parameter.type;
      const comment = parameter.description
        ? `  /** ${escapeJSDocText(parameter.description)} */\n`
        : '';
      const member = `${formatTsPropertyName(parameter.name)}${optional}: ${type}`;
      return `${comment}  ${member};`;
    })
    .join('\n');
}

/**
 * 从类型字符串中提取非基础类型名称
 * @param type 类型字符串
 * @returns 类型名称
 */
function extractTypeNames(type: string): string[] {
  const matches = type.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
  return Array.from(
    new Set(matches.filter((name) => !PRIMITIVE_TYPES.has(name.toLowerCase())))
  );
}
