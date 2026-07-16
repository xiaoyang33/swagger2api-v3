import { SwaggerSchema, TypeInfo } from '../types';
import {
  escapeJSDocText,
  getVisibleSchemaProperties,
  isGenericResponseSchema,
  isObjectSchema,
  isValidIdentifier,
  renderObjectMembers,
  schemaNeedsUsageVariant,
  SchemaUsage,
  swaggerTypeToTsType
} from '../utils/schema';
import { sanitizeTypeName } from '../utils/naming';

const RESERVED_IDENTIFIERS = new Set([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'null',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield'
]);

/**
 * OpenAPI 组件类型生成器
 */
export class OpenAPITypeGenerator {
  private readonly schemas: Record<string, SwaggerSchema>;

  /**
   * 创建类型生成器
   * @param schemas OpenAPI components.schemas
   */
  constructor(schemas: Record<string, SwaggerSchema>) {
    this.schemas = schemas;
  }

  /**
   * 生成全部组件类型
   * @returns 类型信息数组
   */
  generate(): TypeInfo[] {
    this.validateGeneratedTypeNames();

    const types: TypeInfo[] = [];
    for (const [schemaName, schema] of Object.entries(this.schemas)) {
      const typeName = sanitizeTypeName(schemaName);
      types.push(this.createTypeInfo(typeName, schema, 'neutral'));

      if (schemaNeedsUsageVariant(schema, this.schemas, 'request')) {
        types.push(this.createTypeInfo(`${typeName}Input`, schema, 'request'));
      }
      if (schemaNeedsUsageVariant(schema, this.schemas, 'response')) {
        types.push(
          this.createTypeInfo(`${typeName}Output`, schema, 'response')
        );
      }
    }

    return types;
  }

  /**
   * 创建单个类型信息
   * @param typeName 输出类型名称
   * @param schema OpenAPI Schema
   * @param usage Schema 使用场景
   * @returns 类型信息
   */
  private createTypeInfo(
    typeName: string,
    schema: SwaggerSchema,
    usage: SchemaUsage
  ): TypeInfo {
    return {
      name: typeName,
      definition: this.createDefinition(typeName, schema, usage),
      description: schema.description
        ? escapeJSDocText(schema.description)
        : undefined
    };
  }

  /**
   * 创建类型定义
   * @param typeName 输出类型名称
   * @param schema OpenAPI Schema
   * @param usage Schema 使用场景
   * @returns TypeScript 类型定义
   */
  private createDefinition(
    typeName: string,
    schema: SwaggerSchema,
    usage: SchemaUsage
  ): string {
    if (schema.enum && this.canGenerateEnum(schema)) {
      return this.createEnumDefinition(typeName, schema);
    }

    if (
      isObjectSchema(schema) &&
      !schema.allOf &&
      !schema.oneOf &&
      !schema.anyOf &&
      !schema.$ref &&
      schema.nullable !== true &&
      getVisibleSchemaProperties(schema, usage).length > 0
    ) {
      const isGeneric = isGenericResponseSchema(schema);
      const genericDeclaration = isGeneric ? '<T = Record<string, any>>' : '';
      const members = renderObjectMembers(
        schema,
        this.schemas,
        usage,
        isGeneric ? { data: 'T' } : {}
      );
      return `export interface ${typeName}${genericDeclaration} {\n${members}\n}`;
    }

    const type = swaggerTypeToTsType(schema, this.schemas, usage);
    return `export type ${typeName} = ${type};`;
  }

  /**
   * 判断 Schema 是否可以生成 TypeScript enum
   * @param schema OpenAPI Schema
   * @returns 是否可以生成 enum
   */
  private canGenerateEnum(schema: SwaggerSchema): boolean {
    return (
      schema.nullable !== true &&
      !!schema.enum?.length &&
      schema.enum.every(
        (value) => typeof value === 'string' || typeof value === 'number'
      )
    );
  }

  /**
   * 创建枚举定义
   * @param typeName 枚举名称
   * @param schema 枚举 Schema
   * @returns TypeScript 枚举定义
   */
  private createEnumDefinition(
    typeName: string,
    schema: SwaggerSchema
  ): string {
    const usedNames = new Set<string>();
    const members = (schema.enum || []).map((value, index) => {
      const memberName = this.createEnumMemberName(
        schema,
        value,
        index,
        usedNames
      );
      return `  ${memberName} = ${JSON.stringify(value)}`;
    });

    return `export enum ${typeName} {\n${members.join(',\n')}\n}`;
  }

  /**
   * 创建合法且唯一的枚举成员名称
   * @param schema 枚举 Schema
   * @param value 枚举值
   * @param index 枚举索引
   * @param usedNames 已使用名称
   * @returns 枚举成员名称
   */
  private createEnumMemberName(
    schema: SwaggerSchema,
    value: unknown,
    index: number,
    usedNames: Set<string>
  ): string {
    const extensionName =
      schema['x-enum-varnames']?.[index] || schema['x-enumNames']?.[index];
    const sourceName = extensionName || this.createEnumValueName(value, index);
    let memberName = sourceName.replace(/[^A-Za-z0-9_$]+/g, '_');

    if (!memberName) memberName = `VALUE_${index}`;
    if (/^\d/.test(memberName)) memberName = `VALUE_${memberName}`;
    if (RESERVED_IDENTIFIERS.has(memberName)) memberName = `_${memberName}`;
    if (!isValidIdentifier(memberName)) memberName = `VALUE_${index}`;

    const baseName = memberName;
    let suffix = 2;
    while (usedNames.has(memberName)) {
      memberName = `${baseName}_${suffix}`;
      suffix++;
    }
    usedNames.add(memberName);

    return memberName;
  }

  /**
   * 从枚举值创建默认成员名称
   * @param value 枚举值
   * @param index 枚举索引
   * @returns 默认成员名称
   */
  private createEnumValueName(value: unknown, index: number): string {
    if (typeof value === 'number') {
      return `VALUE_${String(value)
        .replace(/^-/, 'NEGATIVE_')
        .replace(/\./g, '_')}`;
    }

    const text = String(value).trim();
    return text ? text.toUpperCase() : `VALUE_${index}`;
  }

  /**
   * 校验基础类型和请求/响应变体不会重名
   */
  private validateGeneratedTypeNames(): void {
    const owners = new Map<string, string>();

    for (const [schemaName, schema] of Object.entries(this.schemas)) {
      const typeName = sanitizeTypeName(schemaName);
      this.registerTypeName(owners, typeName, schemaName);

      if (schemaNeedsUsageVariant(schema, this.schemas, 'request')) {
        this.registerTypeName(
          owners,
          `${typeName}Input`,
          `${schemaName} 的请求类型`
        );
      }
      if (schemaNeedsUsageVariant(schema, this.schemas, 'response')) {
        this.registerTypeName(
          owners,
          `${typeName}Output`,
          `${schemaName} 的响应类型`
        );
      }
    }
  }

  /**
   * 注册生成类型名称并检测冲突
   * @param owners 类型名称归属映射
   * @param typeName 生成类型名称
   * @param owner 原始 Schema 描述
   */
  private registerTypeName(
    owners: Map<string, string>,
    typeName: string,
    owner: string
  ): void {
    const existingOwner = owners.get(typeName);
    if (existingOwner && existingOwner !== owner) {
      throw new Error(
        `Schema 类型名称冲突: ${existingOwner} 和 ${owner} 都会生成 ${typeName}`
      );
    }
    owners.set(typeName, owner);
  }
}
