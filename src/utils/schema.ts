import { SwaggerSchema } from '../types';
import { sanitizeTypeName } from './naming';

/** Schema 的使用场景 */
export type SchemaUsage = 'neutral' | 'request' | 'response';

/** 对象属性类型覆盖 */
export type SchemaPropertyOverrides = Record<string, string>;

/**
 * 判断字符串是否为合法 TypeScript 标识符
 * @param name 属性名
 * @returns 是否为合法标识符
 */
export function isValidIdentifier(name: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
}

/**
 * 格式化 TypeScript 属性名
 * @param name 属性名
 * @returns 可用于类型声明的属性名
 */
export function formatTsPropertyName(name: string): string {
  return isValidIdentifier(name) ? name : JSON.stringify(name);
}

/**
 * 转义 JSDoc 文本
 * @param text 原始文本
 * @returns 可安全写入单行 JSDoc 的文本
 */
export function escapeJSDocText(text: string): string {
  return text.replace(/\*\//g, '*\\/').replace(/\s+/g, ' ').trim();
}

/**
 * 移除联合类型中的顶层 null 类型
 * @param typeStr 类型字符串
 * @returns 移除 null 后的类型字符串
 */
export function stripNullFromUnion(typeStr: string): string {
  if (!typeStr) return 'any';

  const normalized = Array.from(
    new Set(
      splitTopLevelUnion(typeStr).filter((part) => part && part !== 'null')
    )
  );
  return normalized.length > 0 ? normalized.join(' | ') : 'any';
}

/**
 * 判断 Schema 是否应按对象处理
 * @param schema OpenAPI Schema
 * @returns 是否为对象 Schema
 */
export function isObjectSchema(schema: SwaggerSchema): boolean {
  return (
    schema.type === 'object' ||
    (schema.type === undefined &&
      (schema.properties !== undefined ||
        schema.additionalProperties !== undefined))
  );
}

/**
 * 判断 Schema 是否为项目约定的泛型响应容器
 * @param schema OpenAPI Schema
 * @returns 是否为泛型响应容器
 */
export function isGenericResponseSchema(schema: SwaggerSchema): boolean {
  if (!isObjectSchema(schema) || !schema.properties?.data) return false;

  const hasCommonField = ['code', 'message', 'success', 'status'].some(
    (field) => schema.properties?.[field] !== undefined
  );
  const dataSchema = schema.properties.data;
  const hasGenericData =
    isObjectSchema(dataSchema) &&
    !dataSchema.properties &&
    dataSchema.additionalProperties === undefined;

  return hasCommonField && hasGenericData;
}

/**
 * 获取当前使用场景可见的对象属性
 * @param schema OpenAPI Schema
 * @param usage Schema 使用场景
 * @returns 可见属性数组
 */
export function getVisibleSchemaProperties(
  schema: SwaggerSchema,
  usage: SchemaUsage = 'neutral'
): Array<[string, SwaggerSchema]> {
  return Object.entries(schema.properties || {}).filter(([, property]) => {
    if (usage === 'request' && property.readOnly) return false;
    if (usage === 'response' && property.writeOnly) return false;
    return true;
  });
}

/**
 * 判断 Schema 在指定场景下是否需要独立类型
 * @param schema OpenAPI Schema
 * @param schemas 全部组件 Schema
 * @param usage Schema 使用场景
 * @returns 是否需要独立类型
 */
export function schemaNeedsUsageVariant(
  schema: SwaggerSchema,
  schemas: Record<string, SwaggerSchema>,
  usage: Exclude<SchemaUsage, 'neutral'>
): boolean {
  return detectUsageVariant(schema, schemas, usage, new Set<string>());
}

/**
 * 渲染对象类型成员
 * @param schema OpenAPI Schema
 * @param schemas 全部组件 Schema
 * @param usage Schema 使用场景
 * @param overrides 属性类型覆盖
 * @returns 对象成员代码
 */
export function renderObjectMembers(
  schema: SwaggerSchema,
  schemas: Record<string, SwaggerSchema> = {},
  usage: SchemaUsage = 'neutral',
  overrides: SchemaPropertyOverrides = {}
): string {
  const properties = getVisibleSchemaProperties(schema, usage);
  const propertyTypes: string[] = [];
  let hasOptionalProperty = false;
  const members = properties.map(([key, property]) => {
    const optional = schema.required?.includes(key) ? '' : '?';
    let propertyType =
      overrides[key] || swaggerTypeToTsType(property, schemas, usage);
    if (optional) {
      propertyType = stripNullFromUnion(propertyType);
      hasOptionalProperty = true;
    }
    propertyTypes.push(propertyType);

    const comment = property.description
      ? `  /** ${escapeJSDocText(property.description)} */\n`
      : '';
    const readonly = property.readOnly ? 'readonly ' : '';
    return `${comment}  ${readonly}${formatTsPropertyName(key)}${optional}: ${propertyType};`;
  });

  const indexMember = createAdditionalPropertiesMember(
    schema,
    schemas,
    usage,
    propertyTypes,
    hasOptionalProperty
  );
  if (indexMember) members.push(indexMember);

  return members.join('\n');
}

/**
 * 将 OpenAPI Schema 转换为 TypeScript 类型
 * @param schema OpenAPI Schema
 * @param schemas 全部组件 Schema
 * @param usage Schema 使用场景
 * @returns TypeScript 类型字符串
 */
export function swaggerTypeToTsType(
  schema: SwaggerSchema | undefined | null,
  schemas: Record<string, SwaggerSchema> = {},
  usage: SchemaUsage = 'neutral'
): string {
  if (!schema) return 'any';

  let baseType: string;

  if (schema.enum) {
    baseType = createEnumUnion(schema.enum);
  } else if (schema.allOf) {
    baseType = createAllOfType(schema, schemas, usage);
  } else if (schema.oneOf || schema.anyOf) {
    baseType = createComposedUnionType(schema, schemas, usage);
  } else if (schema.$ref) {
    baseType = createReferenceType(schema.$ref, schemas, usage);
  } else if (Array.isArray(schema.type)) {
    baseType = createTypeArrayType(schema, schemas, usage);
  } else if (schema.type === 'array') {
    const itemType = swaggerTypeToTsType(schema.items, schemas, usage);
    baseType = `${parenthesizeArrayItem(itemType)}[]`;
  } else if (isObjectSchema(schema)) {
    baseType = createObjectType(schema, schemas, usage);
  } else {
    baseType = createPrimitiveType(schema);
  }

  return schema.nullable === true ? addNullableType(baseType) : baseType;
}

/**
 * 创建 OpenAPI 3.1 类型数组对应的联合类型
 * @param schema OpenAPI Schema
 * @param schemas 全部组件 Schema
 * @param usage Schema 使用场景
 * @returns TypeScript 联合类型
 */
function createTypeArrayType(
  schema: SwaggerSchema,
  schemas: Record<string, SwaggerSchema>,
  usage: SchemaUsage
): string {
  const schemaTypes = Array.isArray(schema.type) ? schema.type : [];
  const types = schemaTypes.map((type) =>
    swaggerTypeToTsType({ ...schema, type, nullable: false }, schemas, usage)
  );
  return createUniqueUnion(types);
}

/**
 * 从 $ref 字符串中提取并解码引用名称
 * @param ref OpenAPI $ref 字符串
 * @returns 引用名称
 */
export function getRefName(ref: string): string {
  const segment = ref.split('/').pop() || '';

  try {
    return decodeURIComponent(segment).replace(/~1/g, '/').replace(/~0/g, '~');
  } catch {
    return segment.replace(/~1/g, '/').replace(/~0/g, '~');
  }
}

/**
 * 递归检测指定场景下的访问属性差异
 * @param schema OpenAPI Schema
 * @param schemas 全部组件 Schema
 * @param usage Schema 使用场景
 * @param seenRefs 已访问引用
 * @returns 是否存在差异
 */
function detectUsageVariant(
  schema: SwaggerSchema,
  schemas: Record<string, SwaggerSchema>,
  usage: Exclude<SchemaUsage, 'neutral'>,
  seenRefs: Set<string>
): boolean {
  if (schema.$ref) {
    const refName = getRefName(schema.$ref);
    if (!refName || seenRefs.has(refName)) return false;

    const referencedSchema = schemas[refName];
    if (!referencedSchema) return false;

    seenRefs.add(refName);
    return detectUsageVariant(referencedSchema, schemas, usage, seenRefs);
  }

  for (const property of Object.values(schema.properties || {})) {
    if (usage === 'request' && property.readOnly) return true;
    if (usage === 'response' && property.writeOnly) return true;
    if (detectUsageVariant(property, schemas, usage, new Set(seenRefs))) {
      return true;
    }
  }

  const nestedSchemas = [
    schema.items,
    typeof schema.additionalProperties === 'object'
      ? schema.additionalProperties
      : undefined,
    ...(schema.allOf || []),
    ...(schema.oneOf || []),
    ...(schema.anyOf || [])
  ].filter((item): item is SwaggerSchema => !!item);

  return nestedSchemas.some((item) =>
    detectUsageVariant(item, schemas, usage, new Set(seenRefs))
  );
}

/**
 * 创建枚举字面量联合类型
 * @param values 枚举值
 * @returns 联合类型
 */
function createEnumUnion(values: unknown[]): string {
  if (values.length === 0) return 'never';
  return createUniqueUnion(values.map((value) => toLiteralType(value)));
}

/**
 * 创建 allOf 类型
 * @param schema OpenAPI Schema
 * @param schemas 全部组件 Schema
 * @param usage Schema 使用场景
 * @returns 交叉类型或泛型响应类型
 */
function createAllOfType(
  schema: SwaggerSchema,
  schemas: Record<string, SwaggerSchema>,
  usage: SchemaUsage
): string {
  const genericType = createGenericResponseType(schema, schemas, usage);
  const types = genericType
    ? [genericType]
    : (schema.allOf || [])
        .map((item) => swaggerTypeToTsType(item, schemas, usage))
        .filter((type) => type !== 'any');
  const ownSchema = { ...schema, allOf: undefined, nullable: false };
  if (hasOwnTypeConstraints(ownSchema)) {
    types.push(swaggerTypeToTsType(ownSchema, schemas, usage));
  }

  const uniqueTypes = Array.from(new Set(types));
  return uniqueTypes.length > 0
    ? uniqueTypes.map(parenthesizeIntersectionItem).join(' & ')
    : 'any';
}

/**
 * 创建项目约定的泛型响应类型
 * @param schema OpenAPI Schema
 * @param schemas 全部组件 Schema
 * @param usage Schema 使用场景
 * @returns 泛型响应类型，无法匹配时返回空值
 */
function createGenericResponseType(
  schema: SwaggerSchema,
  schemas: Record<string, SwaggerSchema>,
  usage: SchemaUsage
): string | undefined {
  if (schema.allOf?.length !== 2) return undefined;

  const refSchema = schema.allOf.find((item) => item.$ref);
  const objectSchema = schema.allOf.find((item) => !item.$ref);
  if (!refSchema?.$ref || !objectSchema?.properties) return undefined;

  const propertyEntries = Object.entries(objectSchema.properties);
  if (propertyEntries.length !== 1 || propertyEntries[0][0] !== 'data') {
    return undefined;
  }

  const refName = getRefName(refSchema.$ref);
  const referencedSchema = schemas[refName];
  if (!referencedSchema || !isGenericResponseSchema(referencedSchema)) {
    return undefined;
  }

  const containerType = createReferenceType(refSchema.$ref, schemas, usage);
  const dataType = swaggerTypeToTsType(propertyEntries[0][1], schemas, usage);
  return `${containerType}<${dataType}>`;
}

/**
 * 判断 Schema 是否包含 allOf 之外的类型约束
 * @param schema OpenAPI Schema
 * @returns 是否包含类型约束
 */
function hasOwnTypeConstraints(schema: SwaggerSchema): boolean {
  const hasStructuralConstraint = !!(
    schema.$ref ||
    schema.enum ||
    schema.properties ||
    schema.additionalProperties !== undefined ||
    schema.items ||
    schema.oneOf ||
    schema.anyOf
  );

  return (
    hasStructuralConstraint ||
    (schema.type !== undefined && schema.type !== 'object')
  );
}

/**
 * 创建 oneOf 或 anyOf 组合类型
 * @param schema OpenAPI Schema
 * @param schemas 全部组件 Schema
 * @param usage Schema 使用场景
 * @returns 联合类型及其同级约束
 */
function createComposedUnionType(
  schema: SwaggerSchema,
  schemas: Record<string, SwaggerSchema>,
  usage: SchemaUsage
): string {
  const unionType = createUniqueUnion(
    (schema.oneOf || schema.anyOf || []).map((item) => {
      const itemType = swaggerTypeToTsType(item, schemas, usage);
      return createDiscriminatedUnionMember(schema, item, itemType);
    })
  );
  const ownSchema = {
    ...schema,
    oneOf: undefined,
    anyOf: undefined,
    nullable: false
  };

  if (!hasOwnTypeConstraints(ownSchema)) return unionType;

  const ownType = swaggerTypeToTsType(ownSchema, schemas, usage);
  return `${parenthesizeIntersectionItem(unionType)} & ${ownType}`;
}

/**
 * 为联合成员添加 discriminator 字面量属性
 * @param schema 联合 Schema
 * @param item 联合成员 Schema
 * @param itemType 联合成员类型
 * @returns 可判别的联合成员类型
 */
function createDiscriminatedUnionMember(
  schema: SwaggerSchema,
  item: SwaggerSchema,
  itemType: string
): string {
  const discriminator = schema.discriminator;
  if (!discriminator || !item.$ref) return itemType;

  const refName = getRefName(item.$ref);
  const mappedEntry = Object.entries(discriminator.mapping || {}).find(
    ([, mappedRef]) =>
      mappedRef === item.$ref || getRefName(mappedRef) === refName
  );
  const discriminatorValue = mappedEntry?.[0] || refName;
  if (!discriminatorValue) return itemType;

  const propertyName = formatTsPropertyName(discriminator.propertyName);
  return `${parenthesizeIntersectionItem(itemType)} & { ${propertyName}: ${JSON.stringify(
    discriminatorValue
  )} }`;
}

/**
 * 创建引用类型名称
 * @param ref OpenAPI $ref
 * @param schemas 全部组件 Schema
 * @param usage Schema 使用场景
 * @returns TypeScript 类型名称
 */
function createReferenceType(
  ref: string,
  schemas: Record<string, SwaggerSchema>,
  usage: SchemaUsage
): string {
  const refName = getRefName(ref);
  const baseName = sanitizeTypeName(refName || 'any');
  const referencedSchema = schemas[refName];

  if (
    usage !== 'neutral' &&
    referencedSchema &&
    schemaNeedsUsageVariant(referencedSchema, schemas, usage)
  ) {
    return `${baseName}${usage === 'request' ? 'Input' : 'Output'}`;
  }

  return baseName;
}

/**
 * 创建对象类型
 * @param schema OpenAPI Schema
 * @param schemas 全部组件 Schema
 * @param usage Schema 使用场景
 * @returns TypeScript 对象类型
 */
function createObjectType(
  schema: SwaggerSchema,
  schemas: Record<string, SwaggerSchema>,
  usage: SchemaUsage
): string {
  const properties = getVisibleSchemaProperties(schema, usage);

  if (properties.length === 0) {
    if (
      schema.additionalProperties &&
      typeof schema.additionalProperties === 'object'
    ) {
      return `Record<string, ${swaggerTypeToTsType(
        schema.additionalProperties,
        schemas,
        usage
      )}>`;
    }
    if (schema.additionalProperties === false) {
      return 'Record<string, never>';
    }
    return 'Record<string, any>';
  }

  return `{\n${renderObjectMembers(schema, schemas, usage)}\n}`;
}

/**
 * 创建 additionalProperties 索引签名
 * @param schema OpenAPI Schema
 * @param schemas 全部组件 Schema
 * @param usage Schema 使用场景
 * @param propertyTypes 已知属性类型
 * @param hasOptionalProperty 是否存在可选属性
 * @returns 索引签名
 */
function createAdditionalPropertiesMember(
  schema: SwaggerSchema,
  schemas: Record<string, SwaggerSchema>,
  usage: SchemaUsage,
  propertyTypes: string[],
  hasOptionalProperty: boolean
): string | undefined {
  if (
    schema.additionalProperties === undefined ||
    schema.additionalProperties === false
  ) {
    return undefined;
  }

  const additionalType =
    schema.additionalProperties === true
      ? 'any'
      : swaggerTypeToTsType(schema.additionalProperties, schemas, usage);
  if (additionalType === 'any') return '  [key: string]: any;';

  const indexTypes = [additionalType, ...propertyTypes];
  if (hasOptionalProperty) indexTypes.push('undefined');
  return `  [key: string]: ${createUniqueUnion(indexTypes)};`;
}

/**
 * 创建基础类型
 * @param schema OpenAPI Schema
 * @returns TypeScript 基础类型
 */
function createPrimitiveType(schema: SwaggerSchema): string {
  switch (schema.type) {
    case 'integer':
    case 'number':
      return 'number';
    case 'string':
      return schema.format === 'binary' ? 'Blob' : 'string';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    default:
      return 'any';
  }
}

/**
 * 将枚举值转换为 TypeScript 字面量类型
 * @param value 枚举值
 * @returns 字面量类型字符串
 */
function toLiteralType(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return 'any';
}

/**
 * 创建去重后的联合类型
 * @param types 类型数组
 * @returns 联合类型
 */
function createUniqueUnion(types: string[]): string {
  if (types.includes('any')) return 'any';

  const uniqueTypes = Array.from(new Set(types.filter(Boolean)));
  return uniqueTypes.length > 0 ? uniqueTypes.join(' | ') : 'any';
}

/**
 * 为类型添加 null 联合成员
 * @param type TypeScript 类型
 * @returns 可空类型
 */
function addNullableType(type: string): string {
  if (type === 'any') return 'any';
  if (splitTopLevelUnion(type).includes('null')) return type;
  return `${type} | null`;
}

/**
 * 拆分顶层联合类型
 * @param typeStr 类型字符串
 * @returns 联合类型成员
 */
function splitTopLevelUnion(typeStr: string): string[] {
  const parts: string[] = [];
  let current = '';
  let parenDepth = 0;
  let angleDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;

  for (const char of typeStr) {
    if (char === '(') parenDepth++;
    else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (char === '<') angleDepth++;
    else if (char === '>') angleDepth = Math.max(0, angleDepth - 1);
    else if (char === '{') braceDepth++;
    else if (char === '}') braceDepth = Math.max(0, braceDepth - 1);
    else if (char === '[') bracketDepth++;
    else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);

    if (
      char === '|' &&
      parenDepth === 0 &&
      angleDepth === 0 &&
      braceDepth === 0 &&
      bracketDepth === 0
    ) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * 必要时为数组元素类型添加括号
 * @param type TypeScript 类型
 * @returns 数组元素类型
 */
function parenthesizeArrayItem(type: string): string {
  return splitTopLevelUnion(type).length > 1 || type.includes(' & ')
    ? `(${type})`
    : type;
}

/**
 * 必要时为交叉类型成员添加括号
 * @param type TypeScript 类型
 * @returns 交叉类型成员
 */
function parenthesizeIntersectionItem(type: string): string {
  return splitTopLevelUnion(type).length > 1 ? `(${type})` : type;
}
