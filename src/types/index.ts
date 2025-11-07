/**
 * Swagger2API 类型定义
 */

/**
 * Swagger配置接口
 */
export interface SwaggerConfig {
  /** Swagger JSON 文件路径或 URL */
  input: string;
  /** 输出目录 */
  output: string;
  /** 生成器类型 */
  generator: 'typescript' | 'javascript';
  /** 按 tags 分组生成文件 */
  groupByTags: boolean;
  /** 是否覆盖更新，默认为true。为true时会先删除输出目录下的所有文件 */
  overwrite?: boolean;
  /** 接口路径公共前缀，默认为空字符串 */
  prefix?: string;
  /** 请求调用风格：'method' 使用 request.get/post；'generic' 使用 request({ method }) */
  requestStyle?: 'method' | 'generic';
  /** 标签分组配置 */
  tagGrouping?: TagGroupingConfig;
  /** 生成选项 */
  options?: GenerationOptions;
  /** 接口注释配置 */
  comments?: CommentConfig;
  /** request 导入路径模板 */
  importTemplate?: string;
  /** 格式化代码命令 */
  lint?: string;
}

/**
 * 标签分组配置
 */
export interface TagGroupingConfig {
  /** 启用标签分组 */
  enabled: boolean;
  /** 为每个标签创建子目录 */
  createSubDirectories: boolean;
  /** 文件命名方式 */
  fileNaming: 'tag' | 'kebab-case' | 'camelCase';
}

/**
 * 生成选项
 */
export interface GenerationOptions {
  /** 是否生成数据模型 */
  generateModels: boolean;
  /** 是否生成 API 接口 */
  generateApis: boolean;
  /** 是否生成入口文件 */
  generateIndex: boolean;
  /** 是否使用 Axios */
  useAxios: boolean;
  /** 是否添加详细注释 */
  addComments: boolean;
  /** 是否格式化代码 */
  prettify: boolean;
}

/**
 * 注释配置
 */
export interface CommentConfig {
  /** 包含接口描述 */
  includeDescription: boolean;
  /** 包含参数信息 */
  includeParameters: boolean;
  /** 包含返回值信息 */
  includeResponses: boolean;
  /** 包含示例 */
  includeExamples: boolean;
}

/**
 * Swagger文档结构
 */
export interface SwaggerDocument {
  swagger?: string;
  openapi?: string;
  info: SwaggerInfo;
  host?: string;
  basePath?: string;
  schemes?: string[];
  consumes?: string[];
  produces?: string[];
  paths: SwaggerPaths;
  definitions?: SwaggerDefinitions;
  components?: SwaggerComponents;
  tags?: SwaggerTag[];
}

/**
 * Swagger信息
 */
export interface SwaggerInfo {
  title: string;
  description?: string;
  version: string;
  termsOfService?: string;
  contact?: SwaggerContact;
  license?: SwaggerLicense;
}

/**
 * Swagger联系信息
 */
export interface SwaggerContact {
  name?: string;
  url?: string;
  email?: string;
}

/**
 * Swagger许可证信息
 */
export interface SwaggerLicense {
  name: string;
  url?: string;
}

/**
 * Swagger路径定义
 */
export interface SwaggerPaths {
  [path: string]: SwaggerPathItem;
}

/**
 * Swagger路径项
 */
export interface SwaggerPathItem {
  get?: SwaggerOperation;
  post?: SwaggerOperation;
  put?: SwaggerOperation;
  delete?: SwaggerOperation;
  patch?: SwaggerOperation;
  head?: SwaggerOperation;
  options?: SwaggerOperation;
  parameters?: SwaggerParameter[];
}

/**
 * Swagger操作
 */
export interface SwaggerOperation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  consumes?: string[];
  produces?: string[];
  parameters?: SwaggerParameter[];
  requestBody?: SwaggerRequestBody;
  responses: SwaggerResponses;
  deprecated?: boolean;
}

/**
 * Swagger请求体 (OpenAPI 3.0)
 */
export interface SwaggerRequestBody {
  description?: string;
  content: {
    [mediaType: string]: {
      schema?: SwaggerSchema;
      example?: any;
      examples?: { [name: string]: any };
    };
  };
  required?: boolean;
}

/**
 * Swagger参数
 */
export interface SwaggerParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'formData' | 'body';
  description?: string;
  required?: boolean;
  type?: string;
  format?: string;
  schema?: SwaggerSchema;
  items?: SwaggerItems;
  enum?: any[];
  default?: any;
}

/**
 * Swagger响应
 */
export interface SwaggerResponses {
  [statusCode: string]: SwaggerResponse;
}

/**
 * Swagger响应项
 */
export interface SwaggerResponse {
  description: string;
  schema?: SwaggerSchema;
  headers?: { [name: string]: SwaggerHeader };
  examples?: { [mediaType: string]: any };
}

/**
 * Swagger头部
 */
export interface SwaggerHeader {
  description?: string;
  type: string;
  format?: string;
  items?: SwaggerItems;
  enum?: any[];
  default?: any;
}

/**
 * Swagger模式
 */
export interface SwaggerSchema {
  type?: string;
  format?: string;
  title?: string;
  description?: string;
  default?: any;
  enum?: any[];
  items?: SwaggerSchema;
  properties?: { [name: string]: SwaggerSchema };
  additionalProperties?: boolean | SwaggerSchema;
  required?: string[];
  allOf?: SwaggerSchema[];
  oneOf?: SwaggerSchema[];
  anyOf?: SwaggerSchema[];
  not?: SwaggerSchema;
  $ref?: string;
  example?: any;
  examples?: any[];
  discriminator?: string;
  readOnly?: boolean;
  writeOnly?: boolean;
  xml?: SwaggerXml;
  externalDocs?: SwaggerExternalDocs;
  nullable?: boolean;
  deprecated?: boolean;
}

/**
 * Swagger项目
 */
export interface SwaggerItems {
  type?: string;
  format?: string;
  items?: SwaggerItems;
  enum?: any[];
  default?: any;
  $ref?: string;
}

/**
 * Swagger定义
 */
export interface SwaggerDefinitions {
  [name: string]: SwaggerSchema;
}

/**
 * Swagger组件 (OpenAPI 3.0)
 */
export interface SwaggerComponents {
  schemas?: { [name: string]: SwaggerSchema };
  responses?: { [name: string]: SwaggerResponse };
  parameters?: { [name: string]: SwaggerParameter };
  examples?: { [name: string]: any };
  requestBodies?: { [name: string]: any };
  headers?: { [name: string]: SwaggerHeader };
  securitySchemes?: { [name: string]: any };
  links?: { [name: string]: any };
  callbacks?: { [name: string]: any };
}

/**
 * Swagger标签
 */
export interface SwaggerTag {
  name: string;
  description?: string;
  externalDocs?: SwaggerExternalDocs;
}

/**
 * Swagger外部文档
 */
export interface SwaggerExternalDocs {
  description?: string;
  url: string;
}

/**
 * Swagger XML
 */
export interface SwaggerXml {
  name?: string;
  namespace?: string;
  prefix?: string;
  attribute?: boolean;
  wrapped?: boolean;
}

/**
 * 生成的API接口信息
 */
export interface ApiInfo {
  /** 接口名称 */
  name: string;
  /** HTTP方法 */
  method: string;
  /** 接口路径 */
  path: string;
  /** 接口描述 */
  description?: string;
  /** 标签 */
  tags: string[];
  /** 参数 */
  parameters: ParameterInfo[];
  /** 响应类型 */
  responseType: string;
  /** 请求体类型 */
  requestBodyType?: string;
}

/**
 * 参数信息
 */
export interface ParameterInfo {
  /** 参数名 */
  name: string;
  /** 参数类型 */
  type: string;
  /** 参数位置 */
  in: 'query' | 'header' | 'path' | 'formData' | 'body';
  /** 是否必需 */
  required: boolean;
  /** 参数描述 */
  description?: string;
  /** 参数模式 */
  schema?: SwaggerSchema;
}

/**
 * 生成的类型信息
 */
export interface TypeInfo {
  /** 类型名称 */
  name: string;
  /** 类型定义 */
  definition: string;
  /** 类型描述 */
  description?: string;
}