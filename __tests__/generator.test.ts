import * as fs from 'fs';
import * as path from 'path';
import { SwaggerParser } from '../src/core/parser';
import { CodeGenerator } from '../src/core/generator';
import { loadSwaggerDocument } from '../src/utils';
import { SwaggerConfig } from '../src/types';
import { createSampleOpenAPIFile } from './helpers';

function createBaseConfig(outputDir: string): SwaggerConfig {
  return {
    input: createSampleOpenAPIFile(),
    output: outputDir,
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
    },
    importTemplate: "import { request } from '@/utils/request'"
  } as any;
}

describe('generator', () => {
  function mkProjectTemp(subdir: string): string {
    const base = path.resolve(__dirname, '../temp', subdir);
    fs.rmSync(base, { recursive: true, force: true });
    fs.mkdirSync(base, { recursive: true });
    return base;
  }
  test('generates TS grouped files including types and index', async () => {
    const tmp = mkProjectTemp('gen-ts');
    const config = createBaseConfig(tmp);

    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const apis = parser.parseApis();
    const types = parser.parseTypes();
    const grouped = parser.groupApisByTags(apis);

    const gen = new CodeGenerator(config);
    await gen.generateAll(apis, types, grouped);

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

    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const apis = parser.parseApis();
    const types = parser.parseTypes();
    const grouped = parser.groupApisByTags(apis);

    const gen = new CodeGenerator(config);
    await gen.generateAll(apis, types, grouped);

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

    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const apis = parser.parseApis();
    const types = parser.parseTypes();
    const grouped = parser.groupApisByTags(apis);

    const gen = new CodeGenerator(config);
    await gen.generateAll(apis, types, grouped);

    const apiFile = path.join(tmp, 'api.ts');
    expect(fs.existsSync(apiFile)).toBe(true);
  });

  test('uses custom headerComment for generated files', async () => {
    const tmp = mkProjectTemp('gen-header');
    const config = createBaseConfig(tmp);
    config.headerComment = '/**\n * Custom generated header\n */';

    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const apis = parser.parseApis();
    const types = parser.parseTypes();
    const grouped = parser.groupApisByTags(apis);

    const gen = new CodeGenerator(config);
    await gen.generateAll(apis, types, grouped);

    const indexContent = fs.readFileSync(path.join(tmp, 'index.ts'), 'utf-8');
    const typesContent = fs.readFileSync(path.join(tmp, 'types.ts'), 'utf-8');

    expect(indexContent.startsWith(config.headerComment)).toBe(true);
    expect(typesContent.startsWith(config.headerComment)).toBe(true);
  });

  test('generates method-style request (request.get/post) when requestStyle is method', async () => {
    const tmp = mkProjectTemp('gen-method-style');
    const config = createBaseConfig(tmp);
    config.requestStyle = 'method';

    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const apis = parser.parseApis();
    const types = parser.parseTypes();
    const grouped = parser.groupApisByTags(apis);

    const gen = new CodeGenerator(config);
    await gen.generateAll(apis, types, grouped);

    const authDir = path.join(tmp, 'authController');
    const tagContent = fs.readFileSync(path.join(authDir, 'index.ts'), 'utf-8');
    // method style 应使用 request.post(url, ...) 而不是 request({ url, method })
    expect(tagContent).toMatch(/return request\.post</);
    expect(tagContent).not.toMatch(/method: 'POST'/);
  });

  test('generates path parameter template string correctly', async () => {
    const tmp = mkProjectTemp('gen-path-params');
    const config = createBaseConfig(tmp);

    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const apis = parser.parseApis();
    const types = parser.parseTypes();
    const grouped = parser.groupApisByTags(apis);

    const gen = new CodeGenerator(config);
    await gen.generateAll(apis, types, grouped);

    const userDir = path.join(tmp, 'userController');
    const tagContent = fs.readFileSync(path.join(userDir, 'index.ts'), 'utf-8');
    // 路径参数应生成模板字符串
    expect(tagContent).toMatch(/url: `.*\$\{params\./);
  });

  test('generates query parameters with params shorthand', async () => {
    const tmp = mkProjectTemp('gen-query-params');
    const config = createBaseConfig(tmp);

    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const apis = parser.parseApis();
    const types = parser.parseTypes();
    const grouped = parser.groupApisByTags(apis);

    const gen = new CodeGenerator(config);
    await gen.generateAll(apis, types, grouped);

    const userDir = path.join(tmp, 'userController');
    const tagContent = fs.readFileSync(path.join(userDir, 'index.ts'), 'utf-8');
    // 查询参数应使用 params 传递
    const searchFn = tagContent.match(/export const \w+Search\w+ = [\s\S]*?\}/);
    expect(searchFn).not.toBeNull();
    expect(searchFn![0]).toContain('params');
  });

  test('uses kebab-case folder names when tagGrouping.fileNaming is kebab-case', async () => {
    const tmp = mkProjectTemp('gen-kebab');
    const config = createBaseConfig(tmp);
    config.tagGrouping = { fileNaming: 'kebab-case' };

    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const apis = parser.parseApis();
    const types = parser.parseTypes();
    const grouped = parser.groupApisByTags(apis);

    const gen = new CodeGenerator(config);
    await gen.generateAll(apis, types, grouped);

    expect(fs.existsSync(path.join(tmp, 'auth-controller'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'user-controller'))).toBe(true);
  });

  test('uses lowercase tag folder names when tagGrouping.fileNaming is tag', async () => {
    const tmp = mkProjectTemp('gen-tag-naming');
    const config = createBaseConfig(tmp);
    config.tagGrouping = { fileNaming: 'tag' };

    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const apis = parser.parseApis();
    const types = parser.parseTypes();
    const grouped = parser.groupApisByTags(apis);

    const gen = new CodeGenerator(config);
    await gen.generateAll(apis, types, grouped);

    expect(fs.existsSync(path.join(tmp, 'authcontroller'))).toBe(true);
  });

  test('does not overwrite existing files when overwrite is false', async () => {
    const tmp = mkProjectTemp('gen-no-overwrite');
    const config = createBaseConfig(tmp);
    config.overwrite = false;

    // 先创建一个标记文件
    const markerFile = path.join(tmp, 'marker.txt');
    fs.writeFileSync(markerFile, 'should-keep', 'utf-8');

    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const apis = parser.parseApis();
    const types = parser.parseTypes();
    const grouped = parser.groupApisByTags(apis);

    const gen = new CodeGenerator(config);
    await gen.generateAll(apis, types, grouped);

    expect(fs.existsSync(markerFile)).toBe(true);
    expect(fs.readFileSync(markerFile, 'utf-8')).toBe('should-keep');
  });

  test('does not generate types.ts when generateModels is false', async () => {
    const tmp = mkProjectTemp('gen-no-models');
    const config = createBaseConfig(tmp);
    config.options!.generateModels = false;

    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const apis = parser.parseApis();
    const types = parser.parseTypes();
    const grouped = parser.groupApisByTags(apis);

    const gen = new CodeGenerator(config);
    await gen.generateAll(apis, types, grouped);

    expect(fs.existsSync(path.join(tmp, 'types.ts'))).toBe(false);
  });

  test('does not generate API files when generateApis is false', async () => {
    const tmp = mkProjectTemp('gen-no-apis');
    const config = createBaseConfig(tmp);
    config.options!.generateApis = false;

    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const apis = parser.parseApis();
    const types = parser.parseTypes();
    const grouped = parser.groupApisByTags(apis);

    const gen = new CodeGenerator(config);
    await gen.generateAll(apis, types, grouped);

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

    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const apis = parser.parseApis();
    const types = parser.parseTypes();
    const grouped = parser.groupApisByTags(apis);

    const gen = new CodeGenerator(config);
    await gen.generateAll(apis, types, grouped);

    expect(fs.existsSync(path.join(tmp, 'index.ts'))).toBe(false);
  });

  test('does not generate comments when addComments is false', async () => {
    const tmp = mkProjectTemp('gen-no-comments');
    const config = createBaseConfig(tmp);
    config.options!.addComments = false;

    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const apis = parser.parseApis();
    const types = parser.parseTypes();
    const grouped = parser.groupApisByTags(apis);

    const gen = new CodeGenerator(config);
    await gen.generateAll(apis, types, grouped);

    const authDir = path.join(tmp, 'authController');
    const tagContent = fs.readFileSync(path.join(authDir, 'index.ts'), 'utf-8');
    expect(tagContent).not.toMatch(/\*\s+@param/);
    expect(tagContent).not.toMatch(/\*\s+@deprecated/);
  });

  test('ungrouped single file imports types from ./types', async () => {
    const tmp = mkProjectTemp('gen-single-import');
    const config = createBaseConfig(tmp);
    config.groupByTags = false;

    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const apis = parser.parseApis();
    const types = parser.parseTypes();
    const grouped = parser.groupApisByTags(apis);

    const gen = new CodeGenerator(config);
    await gen.generateAll(apis, types, grouped);

    const apiContent = fs.readFileSync(path.join(tmp, 'api.ts'), 'utf-8');
    expect(apiContent).toMatch(/from '\.\/types'/);
  });
});
