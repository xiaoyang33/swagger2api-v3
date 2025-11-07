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
    expect(typesContent).toContain('export interface ResOp');
    expect(typesContent).toContain('data:');

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
});