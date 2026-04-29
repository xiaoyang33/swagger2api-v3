import { SwaggerConfig } from '../types';

const CONFIG_KEYS = [
  '$schema',
  'input',
  'output',
  'generator',
  'groupByTags',
  'overwrite',
  'prefix',
  'requestStyle',
  'tagGrouping',
  'options',
  'comments',
  'importTemplate',
  'lint',
  'methodNameIgnorePrefix',
  'addMethodSuffix',
  'filter',
  'headerComment'
];
const OPTIONS_KEYS = [
  'generateModels',
  'generateApis',
  'generateIndex',
  'useAxios',
  'addComments',
  'prettify'
];
const TAG_GROUPING_KEYS = ['enabled', 'createSubDirectories', 'fileNaming'];
const COMMENT_KEYS = [
  'includeDescription',
  'includeParameters',
  'includeResponses',
  'includeExamples'
];

/**
 * 验证配置对象
 * @param config 配置对象
 * @returns 错误信息数组
 */
export function validateSwaggerConfig(config: SwaggerConfig): string[] {
  const errors: string[] = [];

  validateRequiredString(config.input, 'input', errors);
  validateRequiredString(config.output, 'output', errors);
  validateEnum(
    config.generator,
    'generator',
    ['typescript', 'javascript'],
    errors
  );
  validateBoolean(config.groupByTags, 'groupByTags', errors);
  validateOptionalBoolean(config.overwrite, 'overwrite', errors);
  validateOptionalString(config.prefix, 'prefix', errors);
  validateOptionalString(config.importTemplate, 'importTemplate', errors);
  validateOptionalString(config.lint, 'lint', errors);
  validateOptionalString(config.headerComment, 'headerComment', errors);
  validateOptionalString(config.$schema, '$schema', errors);
  validateOptionalBoolean(config.addMethodSuffix, 'addMethodSuffix', errors);
  validateOptionalEnum(
    config.requestStyle,
    'requestStyle',
    ['method', 'generic'],
    errors
  );
  validateStringArray(
    config.methodNameIgnorePrefix,
    'methodNameIgnorePrefix',
    errors
  );
  validateFilter(config, errors);
  validateOptions(config, errors);
  validateTagGrouping(config, errors);
  validateComments(config, errors);
  validateKnownKeys(config, CONFIG_KEYS, 'config', errors);

  return errors;
}

/**
 * 验证必填字符串
 * @param value 字段值
 * @param field 字段名
 * @param errors 错误信息数组
 */
function validateRequiredString(
  value: unknown,
  field: string,
  errors: string[]
): void {
  if (typeof value !== 'string' || !value) {
    errors.push(`${field} 配置项不能为空，且必须是字符串`);
  }
}

/**
 * 验证可选字符串
 * @param value 字段值
 * @param field 字段名
 * @param errors 错误信息数组
 */
function validateOptionalString(
  value: unknown,
  field: string,
  errors: string[]
): void {
  if (value !== undefined && typeof value !== 'string') {
    errors.push(`${field} 必须是字符串`);
  }
}

/**
 * 验证布尔值
 * @param value 字段值
 * @param field 字段名
 * @param errors 错误信息数组
 */
function validateBoolean(
  value: unknown,
  field: string,
  errors: string[]
): void {
  if (typeof value !== 'boolean') {
    errors.push(`${field} 必须是布尔值`);
  }
}

/**
 * 验证可选布尔值
 * @param value 字段值
 * @param field 字段名
 * @param errors 错误信息数组
 */
function validateOptionalBoolean(
  value: unknown,
  field: string,
  errors: string[]
): void {
  if (value !== undefined && typeof value !== 'boolean') {
    errors.push(`${field} 必须是布尔值`);
  }
}

/**
 * 验证枚举值
 * @param value 字段值
 * @param field 字段名
 * @param values 允许值
 * @param errors 错误信息数组
 */
function validateEnum(
  value: unknown,
  field: string,
  values: string[],
  errors: string[]
): void {
  if (typeof value !== 'string' || !values.includes(value)) {
    errors.push(`${field} 必须是 ${values.join(' 或 ')}`);
  }
}

/**
 * 验证可选枚举值
 * @param value 字段值
 * @param field 字段名
 * @param values 允许值
 * @param errors 错误信息数组
 */
function validateOptionalEnum(
  value: unknown,
  field: string,
  values: string[],
  errors: string[]
): void {
  if (value !== undefined) {
    validateEnum(value, field, values, errors);
  }
}

/**
 * 验证字符串数组
 * @param value 字段值
 * @param field 字段名
 * @param errors 错误信息数组
 */
function validateStringArray(
  value: unknown,
  field: string,
  errors: string[]
): void {
  if (value === undefined) return;

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    errors.push(`${field} 必须是字符串数组`);
  }
}

/**
 * 验证过滤配置
 * @param config 配置对象
 * @param errors 错误信息数组
 */
function validateFilter(config: SwaggerConfig, errors: string[]): void {
  if (!config.filter) return;

  validateKnownKeys(config.filter, ['include', 'exclude'], 'filter', errors);
  validateKnownKeys(config.filter.include, ['tags'], 'filter.include', errors);
  validateKnownKeys(config.filter.exclude, ['tags'], 'filter.exclude', errors);
  validateStringArray(
    config.filter.include?.tags,
    'filter.include.tags',
    errors
  );
  validateStringArray(
    config.filter.exclude?.tags,
    'filter.exclude.tags',
    errors
  );
}

/**
 * 验证生成选项配置
 * @param config 配置对象
 * @param errors 错误信息数组
 */
function validateOptions(config: SwaggerConfig, errors: string[]): void {
  if (!config.options) return;

  validateKnownKeys(config.options, OPTIONS_KEYS, 'options', errors);
  validateOptionalBoolean(
    config.options.generateModels,
    'options.generateModels',
    errors
  );
  validateOptionalBoolean(
    config.options.generateApis,
    'options.generateApis',
    errors
  );
  validateOptionalBoolean(
    config.options.generateIndex,
    'options.generateIndex',
    errors
  );
  validateOptionalBoolean(config.options.useAxios, 'options.useAxios', errors);
  validateOptionalBoolean(
    config.options.addComments,
    'options.addComments',
    errors
  );
  validateOptionalBoolean(config.options.prettify, 'options.prettify', errors);
}

/**
 * 验证标签分组选项
 * @param config 配置对象
 * @param errors 错误信息数组
 */
function validateTagGrouping(config: SwaggerConfig, errors: string[]): void {
  if (!config.tagGrouping) return;

  validateKnownKeys(
    config.tagGrouping,
    TAG_GROUPING_KEYS,
    'tagGrouping',
    errors
  );
  validateOptionalBoolean(
    config.tagGrouping.enabled,
    'tagGrouping.enabled',
    errors
  );
  validateOptionalBoolean(
    config.tagGrouping.createSubDirectories,
    'tagGrouping.createSubDirectories',
    errors
  );
  validateOptionalEnum(
    config.tagGrouping.fileNaming,
    'tagGrouping.fileNaming',
    ['tag', 'kebab-case', 'camelCase'],
    errors
  );
}

/**
 * 验证注释配置
 * @param config 配置对象
 * @param errors 错误信息数组
 */
function validateComments(config: SwaggerConfig, errors: string[]): void {
  if (!config.comments) return;

  validateKnownKeys(config.comments, COMMENT_KEYS, 'comments', errors);
  validateOptionalBoolean(
    config.comments.includeDescription,
    'comments.includeDescription',
    errors
  );
  validateOptionalBoolean(
    config.comments.includeParameters,
    'comments.includeParameters',
    errors
  );
  validateOptionalBoolean(
    config.comments.includeResponses,
    'comments.includeResponses',
    errors
  );
  validateOptionalBoolean(
    config.comments.includeExamples,
    'comments.includeExamples',
    errors
  );
}

/**
 * 验证未知字段
 * @param value 对象值
 * @param knownKeys 允许字段列表
 * @param path 对象路径
 * @param errors 错误信息数组
 */
function validateKnownKeys(
  value: unknown,
  knownKeys: string[],
  path: string,
  errors: string[]
): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;

  for (const key of Object.keys(value)) {
    if (!knownKeys.includes(key)) {
      errors.push(`${path}.${key} 不是支持的配置项`);
    }
  }
}
