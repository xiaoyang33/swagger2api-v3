import * as fs from 'fs';
import * as path from 'path';
import { CodeGenerator } from '../src/core/generator';
import {
  createCleanProjectTemp,
  createOpenApiDoc,
  createTsConfig,
  runGenerator
} from './helpers';

describe('generator', () => {
  /**
   * 写入 OpenAPI 文档到项目 temp 目录
   * @param outputDir 输出目录
   * @param name 文件名
   * @param doc OpenAPI 文档
   * @returns 文档路径
   */
  function writeDoc(outputDir: string, name: string, doc: unknown): string {
    const file = path.join(outputDir, name);
    fs.writeFileSync(file, JSON.stringify(doc, null, 2), 'utf-8');
    return file;
  }

  test('generates TS grouped files including types and index', async () => {
    const tmp = createCleanProjectTemp('gen-ts');
    const config = createTsConfig(tmp);

    await runGenerator(config);

    // types.ts exists and contains ResOp definition
    const typesFile = path.join(tmp, 'types.ts');
    expect(fs.existsSync(typesFile)).toBe(true);
    const typesContent = fs.readFileSync(typesFile, 'utf-8');
    expect(typesContent).toContain(
      'export interface ResOp<T = Record<string, any>>'
    );
    expect(typesContent).toContain('data: T;');

    // grouped tag directories with index.ts
    const authDir = path.join(tmp, 'authController');
    expect(fs.existsSync(authDir)).toBe(true);
    const tagIndex = path.join(authDir, 'index.ts');
    expect(fs.existsSync(tagIndex)).toBe(true);
    const tagContent = fs.readFileSync(tagIndex, 'utf-8');
    // TS imports types and uses generic request style
    expect(tagContent).toMatch(/import type \{ .*\} from '..\/types';/);
    expect(tagContent).toMatch(/return request<ResOp<.*>>\(/);

    // index.ts exports types and tag exports
    const indexFile = path.join(tmp, 'index.ts');
    expect(fs.existsSync(indexFile)).toBe(true);
    const indexContent = fs.readFileSync(indexFile, 'utf-8');
    expect(indexContent).toContain("export * from './types';");
    expect(indexContent).toContain("export * from './authController';");
  });

  test('generates JS files without types and uses method in config', async () => {
    const tmp = createCleanProjectTemp('gen-js');
    const config = createTsConfig(tmp);
    config.generator = 'javascript';

    await runGenerator(config);

    // types.ts should NOT exist
    expect(fs.existsSync(path.join(tmp, 'types.ts'))).toBe(false);

    const authDir = path.join(tmp, 'authController');
    const tagIndex = path.join(authDir, 'index.js');
    expect(fs.existsSync(tagIndex)).toBe(true);
    const tagContent = fs.readFileSync(tagIndex, 'utf-8');
    // JS should not import types
    expect(tagContent).not.toMatch(/import type/);
    // generic style includes method in config
    expect(tagContent).toMatch(/method: 'POST'/);

    // index.js exists
    const indexFile = path.join(tmp, 'index.js');
    expect(fs.existsSync(indexFile)).toBe(true);
  });

  test('generates single api file when not grouped', async () => {
    const tmp = createCleanProjectTemp('gen-single');
    const config = createTsConfig(tmp);
    config.groupByTags = false;

    await runGenerator(config);

    const apiFile = path.join(tmp, 'api.ts');
    expect(fs.existsSync(apiFile)).toBe(true);
  });

  test('uses custom headerComment for generated files', async () => {
    const tmp = createCleanProjectTemp('gen-header');
    const config = createTsConfig(tmp);
    config.headerComment = '/**\n * Custom generated header\n */';

    await runGenerator(config);

    const indexContent = fs.readFileSync(path.join(tmp, 'index.ts'), 'utf-8');
    const typesContent = fs.readFileSync(path.join(tmp, 'types.ts'), 'utf-8');

    expect(indexContent.startsWith(config.headerComment)).toBe(true);
    expect(typesContent.startsWith(config.headerComment)).toBe(true);
  });

  test('generates method-style request (request.get/post) when requestStyle is method', async () => {
    const tmp = createCleanProjectTemp('gen-method-style');
    const config = createTsConfig(tmp);
    config.requestStyle = 'method';

    await runGenerator(config);

    const authDir = path.join(tmp, 'authController');
    const tagContent = fs.readFileSync(path.join(authDir, 'index.ts'), 'utf-8');
    // method style 应使用 request.post(url, ...) 而不是 request({ url, method })
    expect(tagContent).toMatch(/return request\.post</);
    expect(tagContent).not.toMatch(/method: 'POST'/);
  });

  test('generates path parameter template string correctly', async () => {
    const tmp = createCleanProjectTemp('gen-path-params');
    const config = createTsConfig(tmp);

    await runGenerator(config);

    const userDir = path.join(tmp, 'userController');
    const tagContent = fs.readFileSync(path.join(userDir, 'index.ts'), 'utf-8');
    // 路径参数应生成模板字符串
    expect(tagContent).toMatch(/url: `.*\$\{[A-Za-z_$][A-Za-z0-9_$]*\}/);
  });

  test('generates multiple path parameters as independent arguments', async () => {
    const tmp = createCleanProjectTemp('gen-multiple-path-params');
    const doc = createOpenApiDoc({
      paths: {
        '/organizations/{organization_id}/users/{user_id}': {
          get: {
            operationId: 'getOrganizationUser',
            parameters: [
              {
                name: 'organization_id',
                in: 'path',
                required: true,
                schema: { type: 'string' }
              },
              {
                name: 'user_id',
                in: 'path',
                required: true,
                schema: { type: 'string' }
              },
              {
                name: 'include_roles',
                in: 'query',
                schema: { type: 'boolean' }
              }
            ],
            responses: { 200: { description: 'ok' } }
          }
        }
      }
    });
    const config = createTsConfig(tmp);
    config.input = writeDoc(tmp, 'multiple-path-params.json', doc);
    config.groupByTags = false;

    await runGenerator(config);

    const apiContent = fs.readFileSync(path.join(tmp, 'api.ts'), 'utf-8');
    expect(apiContent).toContain(
      'getOrganizationUserGet = (organization_id: string, user_id: string, params?: GetOrganizationUserGetParams, config?: any)'
    );
    expect(apiContent).toContain(
      'url: `/organizations/${organization_id}/users/${user_id}`'
    );
    expect(apiContent).toContain('\n    params,\n');
    const typesContent = fs.readFileSync(path.join(tmp, 'types.ts'), 'utf-8');
    expect(typesContent).toContain(
      'export interface GetOrganizationUserGetParams'
    );
    expect(typesContent).toContain('include_roles?: boolean;');
  });

  test('adds a numeric suffix when a query parameter type name is occupied', async () => {
    const tmp = createCleanProjectTemp('gen-parameter-type-collision');
    const doc = createOpenApiDoc({
      paths: {
        '/search': {
          get: {
            operationId: 'search',
            parameters: [
              {
                name: 'keyword',
                in: 'query',
                schema: { type: 'string' }
              }
            ],
            responses: { 200: { description: 'ok' } }
          }
        }
      },
      schemas: {
        SearchGetParams: { type: 'object', properties: {} },
        SearchGetParams1: { type: 'object', properties: {} }
      }
    });
    const config = createTsConfig(tmp);
    config.input = writeDoc(tmp, 'parameter-type-collision.json', doc);
    config.groupByTags = false;

    await runGenerator(config);

    const apiContent = fs.readFileSync(path.join(tmp, 'api.ts'), 'utf-8');
    const typesContent = fs.readFileSync(path.join(tmp, 'types.ts'), 'utf-8');
    expect(apiContent).toContain('params?: SearchGetParams2');
    expect(typesContent).toContain('export interface SearchGetParams2');
    expect(typesContent).toContain('keyword?: string;');
  });

  test('generates query parameters with params shorthand', async () => {
    const tmp = createCleanProjectTemp('gen-query-params');
    const config = createTsConfig(tmp);

    await runGenerator(config);

    const userDir = path.join(tmp, 'userController');
    const tagContent = fs.readFileSync(path.join(userDir, 'index.ts'), 'utf-8');
    // 查询参数应使用 params 传递
    const searchFn = tagContent.match(/export const \w+Search\w+ = [\s\S]*?\}/);
    expect(searchFn).not.toBeNull();
    expect(searchFn![0]).toContain('params');
    const parameterTypes = fs.readFileSync(
      path.join(userDir, 'types', 'index.ts'),
      'utf-8'
    );
    expect(tagContent).toContain(
      "import type { UserControllerSearchGetParams } from './types';"
    );
    expect(parameterTypes).toContain(
      'export interface UserControllerSearchGetParams'
    );
  });

  test('does not include path parameters in axios query params', async () => {
    const tmp = createCleanProjectTemp('gen-path-query');
    const doc = createOpenApiDoc({
      paths: {
        '/users/{user-id}': {
          get: {
            operationId: 'getUser',
            tags: ['User'],
            parameters: [
              {
                name: 'user-id',
                in: 'path',
                required: true,
                schema: { type: 'string' }
              },
              {
                name: 'verbose',
                in: 'query',
                schema: { type: 'boolean' }
              },
              {
                name: 'x-request-id',
                in: 'query',
                schema: { type: 'string' }
              }
            ],
            responses: { 200: { description: 'ok' } }
          }
        }
      }
    });
    const config = createTsConfig(tmp);
    config.input = writeDoc(tmp, 'path-query.json', doc);
    config.groupByTags = false;

    await runGenerator(config);

    const apiContent = fs.readFileSync(path.join(tmp, 'api.ts'), 'utf-8');
    expect(apiContent).toContain(
      'getUserGet = (user_id: string, params?: GetUserGetParams, config?: any)'
    );
    expect(apiContent).toContain('url: `/users/${user_id}`');
    expect(apiContent).toContain('@param user_id 路径参数');
    expect(apiContent).toContain('\n    params,\n');
    expect(apiContent).not.toContain('"verbose": params.verbose');
    const typesContent = fs.readFileSync(path.join(tmp, 'types.ts'), 'utf-8');
    expect(typesContent).toContain('export interface GetUserGetParams');
    expect(typesContent).toContain('"x-request-id"?: string;');
  });

  test('generates valid parameter order and optional request body', async () => {
    const tmp = createCleanProjectTemp('gen-parameter-order');
    const doc = createOpenApiDoc({
      paths: {
        '/required-body': {
          post: {
            operationId: 'createRequired',
            parameters: [
              {
                name: 'verbose',
                in: 'query',
                required: false,
                schema: { type: 'boolean' }
              }
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Payload' }
                }
              }
            },
            responses: { 204: { description: 'No Content' } }
          }
        },
        '/optional-body': {
          post: {
            operationId: 'createOptional',
            requestBody: {
              required: false,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Payload' }
                }
              }
            },
            responses: { 204: { description: 'No Content' } }
          }
        }
      },
      schemas: {
        Payload: {
          type: 'object',
          properties: { name: { type: 'string' } }
        }
      }
    });
    const config = createTsConfig(tmp);
    config.input = writeDoc(tmp, 'parameter-order.json', doc);
    config.groupByTags = false;

    await runGenerator(config);

    const apiContent = fs.readFileSync(path.join(tmp, 'api.ts'), 'utf-8');
    expect(apiContent).toContain(
      'createRequiredPost = (params: CreateRequiredPostParams, data: Payload, config?: any)'
    );
    expect(apiContent).toContain(
      'createOptionalPost = (data?: Payload, config?: any)'
    );
    const typesContent = fs.readFileSync(path.join(tmp, 'types.ts'), 'utf-8');
    expect(typesContent).toContain('export interface CreateRequiredPostParams');
    expect(typesContent).toContain('verbose?: boolean;');
  });

  test('generates request and response models for access properties', async () => {
    const tmp = createCleanProjectTemp('gen-access-models');
    const doc = createOpenApiDoc({
      paths: {
        '/users': {
          post: {
            operationId: 'saveUser',
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
    const config = createTsConfig(tmp);
    config.input = writeDoc(tmp, 'access-models.json', doc);
    config.groupByTags = false;

    await runGenerator(config);

    const typesContent = fs.readFileSync(path.join(tmp, 'types.ts'), 'utf-8');
    const apiContent = fs.readFileSync(path.join(tmp, 'api.ts'), 'utf-8');
    expect(typesContent).toContain('export interface UserInput');
    expect(typesContent).toContain('export interface UserOutput');
    expect(apiContent).toContain('data: UserInput');
    expect(apiContent).toContain('return request<UserOutput>');
    expect(apiContent).toContain('import type { UserInput, UserOutput }');
  });

  test('rejects tags that escape the output directory', async () => {
    const tmp = createCleanProjectTemp('gen-tag-escape');
    const output = path.join(tmp, 'api');
    const doc = createOpenApiDoc({
      paths: {
        '/unsafe': {
          get: {
            tags: ['..'],
            responses: { 200: { description: 'ok' } }
          }
        }
      }
    });
    const config = createTsConfig(output);
    config.input = writeDoc(tmp, 'unsafe-tag.json', doc);
    fs.mkdirSync(output, { recursive: true });
    const sentinelFile = path.join(output, 'keep.txt');
    fs.writeFileSync(sentinelFile, 'keep', 'utf-8');

    await expect(runGenerator(config)).rejects.toThrow('无效的标签名称');
    expect(fs.existsSync(path.join(tmp, 'index.ts'))).toBe(false);
    expect(fs.readFileSync(sentinelFile, 'utf-8')).toBe('keep');
  });

  test('rejects tags that map to the same output directory', async () => {
    const tmp = createCleanProjectTemp('gen-tag-collision');
    const doc = createOpenApiDoc({
      paths: {
        '/first': {
          get: {
            tags: ['User Admin'],
            responses: { 200: { description: 'ok' } }
          }
        },
        '/second': {
          get: {
            tags: ['User-Admin'],
            responses: { 200: { description: 'ok' } }
          }
        }
      }
    });
    const config = createTsConfig(tmp);
    config.input = writeDoc(tmp, 'colliding-tags.json', doc);

    await expect(runGenerator(config)).rejects.toThrow('标签目录名称冲突');
  });

  test('rejects the current working directory as output', async () => {
    const tmp = createCleanProjectTemp('gen-unsafe-output');
    const originalDirectory = process.cwd();

    process.chdir(tmp);
    try {
      const generator = new CodeGenerator({
        input: './openapi.json',
        output: '.',
        generator: 'typescript',
        groupByTags: false,
        overwrite: false,
        options: {
          generateModels: false,
          generateApis: false,
          generateIndex: false
        }
      });

      await expect(generator.generateAll([], [], new Map())).rejects.toThrow(
        '输出目录不能是当前工作目录或其父目录'
      );
    } finally {
      process.chdir(originalDirectory);
    }
  });

  test('generates deprecated comments from operation metadata', async () => {
    const tmp = createCleanProjectTemp('gen-deprecated');
    const doc = createOpenApiDoc({
      paths: {
        '/legacy': {
          get: {
            operationId: 'getLegacy',
            tags: ['Legacy'],
            summary: '旧接口',
            deprecated: true,
            responses: { 200: { description: 'ok' } }
          }
        }
      }
    });
    const config = createTsConfig(tmp);
    config.input = writeDoc(tmp, 'deprecated.json', doc);

    await runGenerator(config);

    const apiContent = fs.readFileSync(
      path.join(tmp, 'legacy', 'index.ts'),
      'utf-8'
    );
    expect(apiContent).toContain('@deprecated');
  });

  test('generates valid types for invalid schema property names', async () => {
    const tmp = createCleanProjectTemp('gen-invalid-props');
    const doc = createOpenApiDoc({
      schemas: {
        WeirdDto: {
          type: 'object',
          properties: {
            'x-request-id': { type: 'string' },
            'user.name': { type: 'string' }
          }
        }
      }
    });
    const config = createTsConfig(tmp);
    config.input = writeDoc(tmp, 'invalid-props.json', doc);

    await runGenerator(config);

    const typesContent = fs.readFileSync(path.join(tmp, 'types.ts'), 'utf-8');
    expect(typesContent).toContain('"x-request-id"?: string;');
    expect(typesContent).toContain('"user.name"?: string;');
  });

  test('uses kebab-case folder names when tagGrouping.fileNaming is kebab-case', async () => {
    const tmp = createCleanProjectTemp('gen-kebab');
    const config = createTsConfig(tmp);
    config.tagGrouping = { fileNaming: 'kebab-case' };

    await runGenerator(config);

    expect(fs.existsSync(path.join(tmp, 'auth-controller'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'user-controller'))).toBe(true);
  });

  test('uses lowercase tag folder names when tagGrouping.fileNaming is tag', async () => {
    const tmp = createCleanProjectTemp('gen-tag-naming');
    const config = createTsConfig(tmp);
    config.tagGrouping = { fileNaming: 'tag' };

    await runGenerator(config);

    expect(fs.existsSync(path.join(tmp, 'authcontroller'))).toBe(true);
  });

  test('does not overwrite existing files when overwrite is false', async () => {
    const tmp = createCleanProjectTemp('gen-no-overwrite');
    const config = createTsConfig(tmp);
    config.overwrite = false;

    const existingTypesFile = path.join(tmp, 'types.ts');
    const existingIndexFile = path.join(tmp, 'index.ts');
    const existingTagDir = path.join(tmp, 'authController');
    const existingTagFile = path.join(existingTagDir, 'index.ts');
    fs.mkdirSync(existingTagDir, { recursive: true });
    fs.writeFileSync(existingTypesFile, '// SENTINEL_TYPES', 'utf-8');
    fs.writeFileSync(existingIndexFile, '// SENTINEL_INDEX', 'utf-8');
    fs.writeFileSync(existingTagFile, '// SENTINEL_API', 'utf-8');

    await runGenerator(config);

    expect(fs.readFileSync(existingTypesFile, 'utf-8')).toBe(
      '// SENTINEL_TYPES'
    );
    expect(fs.readFileSync(existingIndexFile, 'utf-8')).toBe(
      '// SENTINEL_INDEX'
    );
    expect(fs.readFileSync(existingTagFile, 'utf-8')).toBe('// SENTINEL_API');
  });

  test('does not generate types.ts when generateModels is false', async () => {
    const tmp = createCleanProjectTemp('gen-no-models');
    const config = createTsConfig(tmp);
    config.options!.generateModels = false;

    await runGenerator(config);

    expect(fs.existsSync(path.join(tmp, 'types.ts'))).toBe(false);
    const authContent = fs.readFileSync(
      path.join(tmp, 'authController', 'index.ts'),
      'utf-8'
    );
    expect(authContent).not.toMatch(/\bLoginDto\b/);
    expect(authContent).not.toMatch(/\bResOp\b/);
    expect(authContent).toMatch(/return request<any>\(/);

    const userContent = fs.readFileSync(
      path.join(tmp, 'userController', 'index.ts'),
      'utf-8'
    );
    expect(userContent).toContain(
      'adminSystemUserIdGet = (id: string, config?: any)'
    );
    expect(userContent).toContain(
      'params: { page?: number, pageSize: number, keyword?: string }'
    );
    expect(fs.existsSync(path.join(tmp, 'userController', 'types'))).toBe(
      false
    );
  });

  test('does not generate API files when generateApis is false', async () => {
    const tmp = createCleanProjectTemp('gen-no-apis');
    const config = createTsConfig(tmp);
    config.options!.generateApis = false;

    await runGenerator(config);

    expect(fs.existsSync(path.join(tmp, 'authController'))).toBe(false);
    expect(fs.existsSync(path.join(tmp, 'api.ts'))).toBe(false);
    const indexContent = fs.readFileSync(path.join(tmp, 'index.ts'), 'utf-8');
    expect(indexContent).toContain("export * from './types';");
    expect(indexContent).not.toContain("export * from './authController';");
    expect(indexContent).not.toContain("export * from './userController';");
    expect(indexContent).not.toContain("export * from './api';");
  });

  test('does not generate index file when generateIndex is false', async () => {
    const tmp = createCleanProjectTemp('gen-no-index');
    const config = createTsConfig(tmp);
    config.options!.generateIndex = false;

    await runGenerator(config);

    expect(fs.existsSync(path.join(tmp, 'index.ts'))).toBe(false);
  });

  test('does not generate comments when addComments is false', async () => {
    const tmp = createCleanProjectTemp('gen-no-comments');
    const config = createTsConfig(tmp);
    config.options!.addComments = false;

    await runGenerator(config);

    const authDir = path.join(tmp, 'authController');
    const tagContent = fs.readFileSync(path.join(authDir, 'index.ts'), 'utf-8');
    expect(tagContent).not.toMatch(/\*\s+@param/);
    expect(tagContent).not.toMatch(/\*\s+@deprecated/);
  });

  test('ungrouped single file imports types from ./types', async () => {
    const tmp = createCleanProjectTemp('gen-single-import');
    const config = createTsConfig(tmp);
    config.groupByTags = false;

    await runGenerator(config);

    const apiContent = fs.readFileSync(path.join(tmp, 'api.ts'), 'utf-8');
    expect(apiContent).toMatch(/from '\.\/types'/);
  });
});
