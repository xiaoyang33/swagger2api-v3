import * as path from 'path';
import { SwaggerParser } from '../src/core/parser';
import { loadSwaggerDocument } from '../src/utils';
import { SwaggerConfig } from '../src/types';
import { createSampleOpenAPIFile } from './helpers';

describe('parser', () => {
  let config: SwaggerConfig;

  beforeAll(() => {
    const inputFile = createSampleOpenAPIFile();
    config = {
      input: inputFile,
      output: path.resolve(__dirname, '../temp', 'parser'),
      generator: 'typescript',
      groupByTags: true,
      requestStyle: 'generic',
      options: {
        generateModels: true,
        generateApis: true,
        generateIndex: true,
        useAxios: true,
        addComments: true,
        prettify: true
      }
    } as any;
  });

  test('parseApis extracts operations with names and types', async () => {
    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const apis = parser.parseApis();
    expect(apis.length).toBeGreaterThan(0);

    const loginApi = apis.find((a) => a.path === '/admin/auth/login');
    expect(loginApi).toBeDefined();
    expect(loginApi!.method).toBe('POST');
    expect(loginApi!.name).toBe('AuthController_loginPost');
    expect(loginApi!.responseType).toMatch(/ResOp<.*>/);
    expect(loginApi!.requestBodyType).toBe('LoginDto');
  });

  test('groupApisByTags groups by tag', async () => {
    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const apis = parser.parseApis();
    const grouped = parser.groupApisByTags(apis);
    expect(grouped.size).toBeGreaterThan(0);
    expect(grouped.has('AuthController')).toBe(true);
  });

  test('getTags collects tags from doc and operations', async () => {
    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const tags = parser.getTags();
    expect(tags).toEqual(
      expect.arrayContaining([
        'AuthController',
        'UserController',
        'RoleController',
        'MenuController'
      ])
    );
  });

  test('getApiInfo returns document info', async () => {
    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const info = parser.getApiInfo();
    expect(info.title).toBe('template-admin');
    expect(info.version).toBe('1.0');
  });

  test('getBaseUrl returns empty string when no servers', () => {
    const parser = new SwaggerParser(
      {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0' },
        paths: {}
      },
      config
    );
    expect(parser.getBaseUrl()).toBe('');
  });

  test('parseApis resolves GET/PUT/DELETE/PATCH methods', async () => {
    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const apis = parser.parseApis();
    const methods = new Set(apis.map((a) => a.method));
    expect(methods.has('GET')).toBe(true);
    expect(methods.has('POST')).toBe(true);
    expect(methods.has('PUT')).toBe(true);
    expect(methods.has('DELETE')).toBe(true);
    expect(methods.has('PATCH')).toBe(true);
  });

  test('parseApis uses pathToFunctionName when no operationId', async () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/users/{id}': {
          get: {
            tags: ['User'],
            parameters: [
              { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
            ],
            responses: { 200: { description: 'ok' } }
          }
        }
      },
      components: { schemas: {} }
    };
    const parser = new SwaggerParser(doc as any, config);
    const [api] = parser.parseApis();
    // 没有 operationId，应从路径生成
    expect(api.name).toContain('users');
    expect(api.name).toContain('Get');
  });

  test('groupApisByTags assigns APIs without tags to default group', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/health': {
          get: {
            responses: { 200: { description: 'ok' } }
          }
        }
      },
      components: { schemas: {} }
    };
    const parser = new SwaggerParser(doc as any, config);
    const apis = parser.parseApis();
    const grouped = parser.groupApisByTags(apis);
    expect(grouped.has('default')).toBe(true);
    expect(grouped.get('default')!.length).toBe(1);
  });

  test('groupApisByTags puts multi-tag API into multiple groups', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/shared': {
          get: {
            tags: ['User', 'Admin'],
            responses: { 200: { description: 'ok' } }
          }
        }
      },
      components: { schemas: {} }
    };
    const parser = new SwaggerParser(doc as any, config);
    const apis = parser.parseApis();
    const grouped = parser.groupApisByTags(apis);
    expect(grouped.has('User')).toBe(true);
    expect(grouped.has('Admin')).toBe(true);
    // 同一个 API 出现在两个组中
    expect(grouped.get('User')![0].name).toBe(grouped.get('Admin')![0].name);
  });

  test('parseApis parses deprecated operation without crashing', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/old-api': {
          get: {
            deprecated: true,
            tags: ['Legacy'],
            summary: '旧接口',
            responses: { 200: { description: 'ok' } }
          }
        }
      },
      components: { schemas: {} }
    };
    const parser = new SwaggerParser(doc as any, config);
    const apis = parser.parseApis();
    expect(apis.length).toBe(1);
    expect(apis[0].path).toBe('/old-api');
    expect(apis[0].method).toBe('GET');
    expect(apis[0].description).toBe('旧接口');
    // 注意：当前 ApiInfo 类型没有 deprecated 字段，
    // 如果需要将 deprecated 传递到生成器，需要在 ApiInfo 中添加该字段
  });

  test('parseApis handles empty paths', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {},
      components: { schemas: {} }
    };
    const parser = new SwaggerParser(doc as any, config);
    const apis = parser.parseApis();
    expect(apis).toEqual([]);
  });

  test('parseApis extracts path parameters', async () => {
    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const apis = parser.parseApis();
    const getUserApi = apis.find(
      (a) => a.path === '/admin/system/user/{id}' && a.method === 'GET'
    );
    expect(getUserApi).toBeDefined();
    const pathParams = getUserApi!.parameters.filter((p) => p.in === 'path');
    expect(pathParams.length).toBeGreaterThan(0);
    expect(pathParams[0].name).toBe('id');
    expect(pathParams[0].type).toBe('string');
  });

  test('parseApis extracts query parameters', async () => {
    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const apis = parser.parseApis();
    const searchApi = apis.find(
      (a) => a.path === '/admin/system/users' && a.method === 'GET'
    );
    expect(searchApi).toBeDefined();
    const queryParams = searchApi!.parameters.filter((p) => p.in === 'query');
    expect(queryParams.length).toBe(3);
    const paramNames = queryParams.map((p) => p.name);
    expect(paramNames).toContain('page');
    expect(paramNames).toContain('pageSize');
    expect(paramNames).toContain('keyword');
  });

  test('parseApis returns void for 204 No Content response', async () => {
    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const apis = parser.parseApis();
    const deleteApi = apis.find((a) => a.method === 'DELETE');
    expect(deleteApi).toBeDefined();
    expect(deleteApi!.responseType).toBe('void');
  });

  test('getApiInfo returns baseUrl from servers', async () => {
    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const info = parser.getApiInfo();
    expect(info.baseUrl).toBe('https://dev.api.example.com/v1');
  });

  test('getBaseUrl returns OpenAPI server url with default variables', () => {
    const parser = new SwaggerParser(
      {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0' },
        servers: [
          {
            url: 'https://{env}.example.com/{basePath}',
            variables: {
              env: { default: 'api' },
              basePath: { default: 'v1' }
            }
          }
        ],
        paths: {}
      },
      config
    );

    expect(parser.getBaseUrl()).toBe('https://api.example.com/v1');
  });

  test('parseTypes strips null from optional properties', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0' },
      paths: {},
      components: {
        schemas: {
          NullRulesDto: {
            type: 'object',
            properties: {
              reqNullable: { type: 'string', nullable: true },
              optNullable: { type: 'string', nullable: true },
              reqAnyOfNull: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              optAnyOfNull: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              reqAnyNull: { anyOf: [{}, { type: 'null' }] }
            },
            required: ['reqNullable', 'reqAnyOfNull', 'reqAnyNull']
          }
        }
      }
    };

    const parser = new SwaggerParser(doc as any, config);
    const types = parser.parseTypes();
    const t = types.find((x) => x.name === 'NullRulesDto');
    expect(t).toBeDefined();
    const def = t!.definition;

    expect(def).toContain('reqNullable: string | null;');
    expect(def).toContain('optNullable?: string;');
    expect(def).toContain('reqAnyOfNull: string | null;');
    expect(def).toContain('optAnyOfNull?: string;');
    expect(def).toContain('reqAnyNull: any;');
    expect(def).not.toContain('reqAnyNull: any | null;');
  });

  test('parseTypes supports numeric enum values', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0' },
      paths: {},
      components: {
        schemas: {
          Status: {
            type: 'integer',
            enum: [0, 1]
          }
        }
      }
    };

    const parser = new SwaggerParser(doc as any, config);
    const types = parser.parseTypes();
    const status = types.find((type) => type.name === 'Status');

    expect(status?.definition).toContain("VALUE_0 = '0'");
    expect(status?.definition).toContain("VALUE_1 = '1'");
  });

  test('parseApis supports OpenAPI refs and non-json requestBody content', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0' },
      paths: {
        '/upload/{id}': {
          post: {
            operationId: 'uploadFile',
            tags: ['Upload'],
            parameters: [
              { $ref: '#/components/parameters/IdParam' },
              {
                name: 'tags',
                in: 'query',
                required: false,
                schema: {
                  type: 'array',
                  items: { type: 'string' }
                }
              }
            ],
            requestBody: {
              $ref: '#/components/requestBodies/UploadBody'
            },
            responses: {
              202: {
                description: 'accepted',
                content: {
                  'application/vnd.api+json': {
                    schema: { $ref: '#/components/schemas/UploadResp' }
                  }
                }
              }
            }
          }
        }
      },
      components: {
        parameters: {
          IdParam: {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        },
        requestBodies: {
          UploadBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: { $ref: '#/components/schemas/UploadDto' }
              }
            }
          }
        },
        schemas: {
          UploadDto: {
            type: 'object',
            properties: {
              file: { type: 'string', format: 'binary' }
            }
          },
          UploadResp: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    };

    const parser = new SwaggerParser(doc as any, config);
    const [api] = parser.parseApis();

    expect(api.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'id', type: 'string', in: 'path' }),
        expect.objectContaining({ name: 'tags', type: 'string[]' }),
        expect.objectContaining({ name: 'body', type: 'UploadDto' })
      ])
    );
    expect(api.responseType).toBe('UploadResp[]');
    expect(api.requestBodyType).toBe('UploadDto');
  });
});
