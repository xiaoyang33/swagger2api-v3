import * as path from 'path';
import { SwaggerParser } from '../src/core/parser';
import { loadSwaggerDocument } from '../src/utils';
import { ApiInfo, SwaggerConfig } from '../src/types';
import { createOpenApiDoc, createSampleOpenAPIFile } from './helpers';

describe('parser', () => {
  let config: SwaggerConfig;
  let sampleParser: SwaggerParser;
  let sampleApis: ApiInfo[];

  beforeAll(async () => {
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
    const document = await loadSwaggerDocument(inputFile);
    sampleParser = new SwaggerParser(document, config);
    sampleApis = sampleParser.parseApis();
  });

  test('parseApis extracts operations with names and types', () => {
    expect(sampleApis.length).toBeGreaterThan(0);

    const loginApi = sampleApis.find((a) => a.path === '/admin/auth/login');
    expect(loginApi).toBeDefined();
    expect(loginApi!.method).toBe('POST');
    expect(loginApi!.name).toBe('AuthController_loginPost');
    expect(loginApi!.responseType).toMatch(/ResOp<.*>/);
    expect(loginApi!.requestBodyType).toBe('LoginDto');
  });

  test('groupApisByTags groups by tag', () => {
    const grouped = sampleParser.groupApisByTags(sampleApis);
    expect(grouped.size).toBeGreaterThan(0);
    expect(grouped.has('AuthController')).toBe(true);
  });

  test('getTags collects tags from doc and operations', () => {
    const tags = sampleParser.getTags();
    expect(tags).toEqual(
      expect.arrayContaining([
        'AuthController',
        'UserController',
        'RoleController',
        'MenuController'
      ])
    );
  });

  test('getApiInfo returns document info', () => {
    const info = sampleParser.getApiInfo();
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

  test('parseApis resolves GET/PUT/DELETE/PATCH methods', () => {
    const methods = new Set(sampleApis.map((a) => a.method));
    expect(methods.has('GET')).toBe(true);
    expect(methods.has('POST')).toBe(true);
    expect(methods.has('PUT')).toBe(true);
    expect(methods.has('DELETE')).toBe(true);
    expect(methods.has('PATCH')).toBe(true);
  });

  test('parseApis supports OpenAPI TRACE operations', () => {
    const doc = createOpenApiDoc({
      paths: {
        '/trace': {
          trace: {
            responses: { 200: { description: 'ok' } }
          }
        }
      }
    });
    const parser = new SwaggerParser(doc, config);

    expect(parser.parseApis()[0]).toEqual(
      expect.objectContaining({ method: 'TRACE', path: '/trace' })
    );
  });

  test('parseApis uses pathToFunctionName when no operationId', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/users/{id}': {
          get: {
            tags: ['User'],
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string' }
              }
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

  test('groupApisByTags puts multi-tag API into first group by default', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/shared': {
          get: {
            tags: ['User', 'Admin', 'Audit'],
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
    expect(grouped.has('Admin')).toBe(false);
    expect(grouped.has('Audit')).toBe(false);
    expect(grouped.get('User')![0].name).toBe(apis[0].name);
  });

  test('groupApisByTags combines tags when multiTagStrategy is all', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0' },
      paths: {
        '/shared': {
          get: {
            tags: ['User', 'Admin', 'Audit'],
            responses: { 200: { description: 'ok' } }
          }
        }
      },
      components: { schemas: {} }
    };
    const parser = new SwaggerParser(doc as any, {
      ...config,
      multiTagStrategy: 'all'
    });
    const apis = parser.parseApis();
    const grouped = parser.groupApisByTags(apis);
    expect(grouped.has('User')).toBe(false);
    expect(grouped.has('Admin')).toBe(false);
    expect(grouped.has('Audit')).toBe(false);
    expect(grouped.has('User-Admin-Audit')).toBe(true);
    expect(grouped.get('User-Admin-Audit')![0].name).toBe(apis[0].name);
  });

  test('groupApisByTags keeps single tag when multiTagStrategy is all', () => {
    const doc = createOpenApiDoc({
      paths: {
        '/single': {
          get: {
            tags: ['Only'],
            responses: { 200: { description: 'ok' } }
          }
        }
      }
    });
    const parser = new SwaggerParser(doc as any, {
      ...config,
      multiTagStrategy: 'all'
    });
    const apis = parser.parseApis();
    const grouped = parser.groupApisByTags(apis);

    expect(grouped.has('Only')).toBe(true);
    expect(grouped.get('Only')![0].name).toBe(apis[0].name);
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
    expect(apis[0].deprecated).toBe(true);
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

  test('parseApis extracts path parameters', () => {
    const getUserApi = sampleApis.find(
      (a) => a.path === '/admin/system/user/{id}' && a.method === 'GET'
    );
    expect(getUserApi).toBeDefined();
    const pathParams = getUserApi!.parameters.filter((p) => p.in === 'path');
    expect(pathParams.length).toBeGreaterThan(0);
    expect(pathParams[0].name).toBe('id');
    expect(pathParams[0].type).toBe('string');
  });

  test('parseApis extracts query parameters', () => {
    const searchApi = sampleApis.find(
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

  test('parseApis returns void for 204 No Content response', () => {
    const deleteApi = sampleApis.find((a) => a.method === 'DELETE');
    expect(deleteApi).toBeDefined();
    expect(deleteApi!.responseType).toBe('void');
  });

  test('getApiInfo returns baseUrl from servers', () => {
    const info = sampleParser.getApiInfo();
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

    expect(status?.definition).toContain('VALUE_0 = 0');
    expect(status?.definition).toContain('VALUE_1 = 1');
  });

  test('parseTypes infers objects and creates safe type and enum names', () => {
    const doc = createOpenApiDoc({
      schemas: {
        '123-model': {
          properties: {
            id: { type: 'string' }
          }
        },
        State: {
          type: 'string',
          enum: ['in-progress', '', 'in progress']
        }
      }
    });
    const parser = new SwaggerParser(doc, config);
    const types = parser.parseTypes();

    expect(
      types.find((type) => type.name === '_123Model')?.definition
    ).toContain('export interface _123Model');
    const state = types.find((type) => type.name === 'State')?.definition || '';
    expect(state).toContain('IN_PROGRESS = "in-progress"');
    expect(state).toContain('VALUE_1 = ""');
    expect(state).toContain('IN_PROGRESS_2 = "in progress"');
  });

  test('parseTypes rejects generated type name collisions', () => {
    const doc = createOpenApiDoc({
      schemas: {
        'Foo.Bar': { type: 'object', properties: {} },
        'Foo-Bar': { type: 'object', properties: {} }
      }
    });
    const parser = new SwaggerParser(doc, config);

    expect(() => parser.parseTypes()).toThrow('Schema 类型名称冲突');
  });

  test('parseTypes creates request and response variants for access properties', () => {
    const doc = createOpenApiDoc({
      paths: {
        '/users': {
          post: {
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/User' }
                }
              }
            },
            responses: {
              200: {
                description: 'ok',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/User' }
                  }
                }
              }
            }
          }
        }
      },
      schemas: {
        User: {
          type: 'object',
          required: ['id', 'password', 'createdAt'],
          properties: {
            id: { type: 'string' },
            password: { type: 'string', writeOnly: true },
            createdAt: { type: 'string', readOnly: true }
          }
        }
      }
    });
    const parser = new SwaggerParser(doc, config);
    const types = parser.parseTypes();
    const [api] = parser.parseApis();

    expect(types.find((type) => type.name === 'User')?.definition).toContain(
      'readonly createdAt: string;'
    );
    expect(
      types.find((type) => type.name === 'UserInput')?.definition
    ).not.toContain('createdAt');
    expect(
      types.find((type) => type.name === 'UserOutput')?.definition
    ).not.toContain('password');
    expect(api.requestBodyType).toBe('UserInput');
    expect(api.responseType).toBe('UserOutput');
  });

  test('parseTypes preserves nullable object components', () => {
    const doc = createOpenApiDoc({
      schemas: {
        MaybeUser: {
          type: 'object',
          nullable: true,
          properties: { id: { type: 'string' } }
        }
      }
    });
    const parser = new SwaggerParser(doc, config);
    const definition = parser
      .parseTypes()
      .find((type) => type.name === 'MaybeUser')?.definition;

    expect(definition).toBe(
      'export type MaybeUser = {\n  id?: string;\n} | null;'
    );
  });

  test('parseTypes keeps generic response access variants generic', () => {
    const doc = createOpenApiDoc({
      schemas: {
        ResOp: {
          type: 'object',
          required: ['data'],
          properties: {
            code: { type: 'integer', readOnly: true },
            secret: { type: 'string', writeOnly: true },
            data: { type: 'object' }
          }
        },
        User: {
          type: 'object',
          properties: { id: { type: 'string' } }
        },
        UserResult: {
          allOf: [
            { $ref: '#/components/schemas/ResOp' },
            {
              properties: {
                data: { $ref: '#/components/schemas/User' }
              }
            }
          ]
        }
      }
    });
    const parser = new SwaggerParser(doc, config);
    const types = parser.parseTypes();

    expect(
      types.find((type) => type.name === 'ResOpInput')?.definition
    ).toContain('export interface ResOpInput<T = Record<string, any>>');
    expect(
      types.find((type) => type.name === 'ResOpOutput')?.definition
    ).toContain('export interface ResOpOutput<T = Record<string, any>>');
    expect(
      types.find((type) => type.name === 'UserResultInput')?.definition
    ).toBe('export type UserResultInput = ResOpInput<User>;');
    expect(
      types.find((type) => type.name === 'UserResultOutput')?.definition
    ).toBe('export type UserResultOutput = ResOpOutput<User>;');
  });

  test('parseTypes keeps discriminator oneOf schemas as a union', () => {
    const doc = createOpenApiDoc({
      schemas: {
        Cat: {
          type: 'object',
          properties: { kind: { type: 'string', enum: ['cat'] } }
        },
        Dog: {
          type: 'object',
          properties: { kind: { type: 'string', enum: ['dog'] } }
        },
        Pet: {
          oneOf: [
            { $ref: '#/components/schemas/Cat' },
            { $ref: '#/components/schemas/Dog' }
          ],
          discriminator: {
            propertyName: 'kind',
            mapping: {
              cat: '#/components/schemas/Cat',
              dog: '#/components/schemas/Dog'
            }
          }
        }
      }
    });
    const parser = new SwaggerParser(doc, config);

    expect(
      parser.parseTypes().find((type) => type.name === 'Pet')?.definition
    ).toBe('export type Pet = Cat & { kind: "cat" } | Dog & { kind: "dog" };');
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
    expect(api.responseType).toBe('UploadResp');
    expect(api.requestBodyType).toBe('UploadDto');
  });

  test('parseApis resolves nested local refs', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0' },
      paths: {
        '/nested/{id}': {
          get: {
            parameters: [{ $ref: '#/components/parameters/AliasIdParam' }],
            responses: { 200: { description: 'ok' } }
          }
        }
      },
      components: {
        parameters: {
          AliasIdParam: { $ref: '#/components/parameters/IdParam' },
          IdParam: {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        },
        schemas: {}
      }
    };

    const parser = new SwaggerParser(doc as any, config);
    const [api] = parser.parseApis();

    expect(api.parameters).toEqual([
      expect.objectContaining({ name: 'id', in: 'path', type: 'string' })
    ]);
  });

  test('parseApis resolves path item and response refs', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0' },
      paths: {
        '/referenced': { $ref: '#/x-path-items/ReferencedPath' }
      },
      components: {
        schemas: {},
        responses: {
          Ok: {
            description: 'ok',
            content: {
              'application/json': { schema: { type: 'string' } }
            }
          }
        }
      },
      'x-path-items': {
        ReferencedPath: {
          get: {
            tags: ['Referenced'],
            responses: {
              200: { $ref: '#/components/responses/Ok' }
            }
          }
        }
      }
    };
    const parser = new SwaggerParser(doc as any, config);
    const [api] = parser.parseApis();

    expect(api).toEqual(
      expect.objectContaining({
        path: '/referenced',
        method: 'GET',
        responseType: 'string'
      })
    );
    expect(parser.getTags()).toContain('Referenced');
  });

  test('parseApis throws clear error for invalid local refs', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0' },
      paths: {
        '/invalid': {
          get: {
            parameters: [{ $ref: '#/components/parameters/MissingParam' }],
            responses: { 200: { description: 'ok' } }
          }
        }
      },
      components: { parameters: {}, schemas: {} }
    };

    const parser = new SwaggerParser(doc as any, config);

    expect(() => parser.parseApis()).toThrow(
      '无法解析 $ref 引用: #/components/parameters/MissingParam'
    );
  });

  test('parseApis throws clear error for external refs', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0' },
      paths: {
        '/external': {
          get: {
            parameters: [{ $ref: './common.json#/components/parameters/Id' }],
            responses: { 200: { description: 'ok' } }
          }
        }
      },
      components: { schemas: {} }
    };

    const parser = new SwaggerParser(doc as any, config);

    expect(() => parser.parseApis()).toThrow(
      '外部 $ref 需要先通过 loadSwaggerDocument 打包: ./common.json#/components/parameters/Id'
    );
  });

  test('parseApis lets operation parameters override path parameters', () => {
    const doc = createOpenApiDoc({
      paths: {
        '/users/{id}': {
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          get: {
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'integer' }
              }
            ],
            responses: { 200: { description: 'ok' } }
          }
        }
      }
    });

    const parser = new SwaggerParser(doc as any, config);
    const [api] = parser.parseApis();

    expect(api.parameters).toEqual([
      expect.objectContaining({ name: 'id', in: 'path', type: 'number' })
    ]);
  });

  test('parseApis throws clear error for circular refs', () => {
    const doc = createOpenApiDoc({
      paths: {
        '/loop/{id}': {
          get: {
            parameters: [{ $ref: '#/components/parameters/LoopParam' } as any],
            responses: { 200: { description: 'ok' } }
          }
        }
      },
      parameters: {
        LoopParam: { $ref: '#/components/parameters/LoopParam' }
      } as any
    });

    const parser = new SwaggerParser(doc as any, config);

    expect(() => parser.parseApis()).toThrow(
      '检测到循环 $ref 引用: #/components/parameters/LoopParam'
    );
  });

  test('parseApis throws clear error when local ref depth is too deep', () => {
    const parameters: Record<string, any> = {};
    for (let i = 0; i <= 21; i++) {
      parameters[`P${i}`] =
        i === 21
          ? {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          : { $ref: `#/components/parameters/P${i + 1}` };
    }

    const doc = createOpenApiDoc({
      paths: {
        '/deep/{id}': {
          get: {
            parameters: [{ $ref: '#/components/parameters/P0' } as any],
            responses: { 200: { description: 'ok' } }
          }
        }
      },
      parameters
    });

    const parser = new SwaggerParser(doc as any, config);

    expect(() => parser.parseApis()).toThrow('$ref 解析超过最大深度');
  });

  test('parseApis decodes JSON Pointer escaped ref segments', () => {
    const doc = createOpenApiDoc({
      paths: {
        '/escaped/{id}': {
          get: {
            parameters: [{ $ref: '#/components/parameters/Foo~1Bar' } as any],
            responses: { 200: { description: 'ok' } }
          }
        }
      },
      parameters: {
        'Foo/Bar': {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' }
        }
      } as any
    });

    const parser = new SwaggerParser(doc as any, config);
    const [api] = parser.parseApis();

    expect(api.parameters[0]).toEqual(
      expect.objectContaining({ name: 'id', in: 'path', type: 'string' })
    );
  });
});
