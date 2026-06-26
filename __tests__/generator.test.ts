import * as fs from 'fs';
import * as path from 'path';
import { SwaggerConfig } from '../src/types';
import {
  createCleanProjectTemp,
  createOpenApiDoc,
  createTsConfig,
  runGenerator
} from './helpers';

/**
 * 创建生成器基础测试配置
 * @param outputDir 输出目录
 * @returns Swagger 配置
 */
function createBaseConfig(outputDir: string): SwaggerConfig {
  return createTsConfig(outputDir);
}

describe('generator', () => {
  /**
   * 创建并清空生成器测试目录
   * @param subdir 子目录名
   * @returns 临时目录路径
   */
  function mkProjectTemp(subdir: string): string {
    return createCleanProjectTemp(subdir);
  }

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
    const tmp = mkProjectTemp('gen-ts');
    const config = createBaseConfig(tmp);

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
    const tmp = mkProjectTemp('gen-js');
    const config = createBaseConfig(tmp);
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
    const tmp = mkProjectTemp('gen-single');
    const config = createBaseConfig(tmp);
    config.groupByTags = false;

    await runGenerator(config);

    const apiFile = path.join(tmp, 'api.ts');
    expect(fs.existsSync(apiFile)).toBe(true);
  });

  test('uses custom headerComment for generated files', async () => {
    const tmp = mkProjectTemp('gen-header');
    const config = createBaseConfig(tmp);
    config.headerComment = '/**\n * Custom generated header\n */';

    await runGenerator(config);

    const indexContent = fs.readFileSync(path.join(tmp, 'index.ts'), 'utf-8');
    const typesContent = fs.readFileSync(path.join(tmp, 'types.ts'), 'utf-8');

    expect(indexContent.startsWith(config.headerComment)).toBe(true);
    expect(typesContent.startsWith(config.headerComment)).toBe(true);
  });

  test('generates method-style request (request.get/post) when requestStyle is method', async () => {
    const tmp = mkProjectTemp('gen-method-style');
    const config = createBaseConfig(tmp);
    config.requestStyle = 'method';

    await runGenerator(config);

    const authDir = path.join(tmp, 'authController');
    const tagContent = fs.readFileSync(path.join(authDir, 'index.ts'), 'utf-8');
    // method style 应使用 request.post(url, ...) 而不是 request({ url, method })
    expect(tagContent).toMatch(/return request\.post</);
    expect(tagContent).not.toMatch(/method: 'POST'/);
  });

  test('generates path parameter template string correctly', async () => {
    const tmp = mkProjectTemp('gen-path-params');
    const config = createBaseConfig(tmp);

    await runGenerator(config);

    const userDir = path.join(tmp, 'userController');
    const tagContent = fs.readFileSync(path.join(userDir, 'index.ts'), 'utf-8');
    // 路径参数应生成模板字符串
    expect(tagContent).toMatch(/url: `.*\$\{params\./);
  });

  test('generates query parameters with params shorthand', async () => {
    const tmp = mkProjectTemp('gen-query-params');
    const config = createBaseConfig(tmp);

    await runGenerator(config);

    const userDir = path.join(tmp, 'userController');
    const tagContent = fs.readFileSync(path.join(userDir, 'index.ts'), 'utf-8');
    // 查询参数应使用 params 传递
    const searchFn = tagContent.match(/export const \w+Search\w+ = [\s\S]*?\}/);
    expect(searchFn).not.toBeNull();
    expect(searchFn![0]).toContain('params');
  });

  test('does not include path parameters in axios query params', async () => {
    const tmp = mkProjectTemp('gen-path-query');
    const doc = createOpenApiDoc({
      paths: {
        '/users/{id}': {
          get: {
            operationId: 'getUser',
            tags: ['User'],
            parameters: [
              {
                name: 'id',
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
    const config = createBaseConfig(tmp);
    config.input = writeDoc(tmp, 'path-query.json', doc);
    config.groupByTags = false;

    await runGenerator(config);

    const apiContent = fs.readFileSync(path.join(tmp, 'api.ts'), 'utf-8');
    expect(apiContent).toContain('url: `/users/${params.id}`');
    expect(apiContent).toContain(
      'params: { "verbose": params.verbose, "x-request-id": params["x-request-id"] }'
    );
    expect(apiContent).toContain('"x-request-id"?: string');
    expect(apiContent).not.toContain('params: { "id": params.id');
  });

  test('generates deprecated comments from operation metadata', async () => {
    const tmp = mkProjectTemp('gen-deprecated');
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
    const config = createBaseConfig(tmp);
    config.input = writeDoc(tmp, 'deprecated.json', doc);

    await runGenerator(config);

    const apiContent = fs.readFileSync(
      path.join(tmp, 'legacy', 'index.ts'),
      'utf-8'
    );
    expect(apiContent).toContain('@deprecated');
  });

  test('generates valid types for invalid schema property names', async () => {
    const tmp = mkProjectTemp('gen-invalid-props');
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
    const config = createBaseConfig(tmp);
    config.input = writeDoc(tmp, 'invalid-props.json', doc);

    await runGenerator(config);

    const typesContent = fs.readFileSync(path.join(tmp, 'types.ts'), 'utf-8');
    expect(typesContent).toContain('"x-request-id"?: string;');
    expect(typesContent).toContain('"user.name"?: string;');
  });

  test('uses kebab-case folder names when tagGrouping.fileNaming is kebab-case', async () => {
    const tmp = mkProjectTemp('gen-kebab');
    const config = createBaseConfig(tmp);
    config.tagGrouping = { fileNaming: 'kebab-case' };

    await runGenerator(config);

    expect(fs.existsSync(path.join(tmp, 'auth-controller'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'user-controller'))).toBe(true);
  });

  test('uses lowercase tag folder names when tagGrouping.fileNaming is tag', async () => {
    const tmp = mkProjectTemp('gen-tag-naming');
    const config = createBaseConfig(tmp);
    config.tagGrouping = { fileNaming: 'tag' };

    await runGenerator(config);

    expect(fs.existsSync(path.join(tmp, 'authcontroller'))).toBe(true);
  });

  test('does not overwrite existing files when overwrite is false', async () => {
    const tmp = mkProjectTemp('gen-no-overwrite');
    const config = createBaseConfig(tmp);
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
    const tmp = mkProjectTemp('gen-no-models');
    const config = createBaseConfig(tmp);
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
    expect(userContent).toMatch(/params: \{ id: string \}/);
  });

  test('does not generate API files when generateApis is false', async () => {
    const tmp = mkProjectTemp('gen-no-apis');
    const config = createBaseConfig(tmp);
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
    const tmp = mkProjectTemp('gen-no-index');
    const config = createBaseConfig(tmp);
    config.options!.generateIndex = false;

    await runGenerator(config);

    expect(fs.existsSync(path.join(tmp, 'index.ts'))).toBe(false);
  });

  test('does not generate comments when addComments is false', async () => {
    const tmp = mkProjectTemp('gen-no-comments');
    const config = createBaseConfig(tmp);
    config.options!.addComments = false;

    await runGenerator(config);

    const authDir = path.join(tmp, 'authController');
    const tagContent = fs.readFileSync(path.join(authDir, 'index.ts'), 'utf-8');
    expect(tagContent).not.toMatch(/\*\s+@param/);
    expect(tagContent).not.toMatch(/\*\s+@deprecated/);
  });

  test('ungrouped single file imports types from ./types', async () => {
    const tmp = mkProjectTemp('gen-single-import');
    const config = createBaseConfig(tmp);
    config.groupByTags = false;

    await runGenerator(config);

    const apiContent = fs.readFileSync(path.join(tmp, 'api.ts'), 'utf-8');
    expect(apiContent).toMatch(/from '\.\/types'/);
  });
});
