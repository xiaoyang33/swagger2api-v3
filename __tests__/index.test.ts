import * as fs from 'fs';
import * as path from 'path';
import { Swagger2API, generate } from '../src/index';
import { SwaggerConfig } from '../src/types';
import { createSampleOpenAPIFile } from './helpers';

function mkTmp(name: string) {
  const dir = path.resolve(__dirname, '../temp', name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

describe('index (integration)', () => {
  test('validateConfig accepts typescript and javascript', () => {
    const base: Omit<SwaggerConfig, 'generator'> = {
      input: path.resolve(__dirname, '../swagger_temp.json'),
      output: mkTmp('s2a-index-'),
      groupByTags: true
    } as any;

    const s1 = new Swagger2API({ ...base, generator: 'typescript' });
    expect(s1.validateConfig()).toBe(true);
    const s2 = new Swagger2API({ ...base, generator: 'javascript' });
    expect(s2.validateConfig()).toBe(true);

    const s3 = new Swagger2API({ ...base, generator: 'foo' } as any);
    expect(s3.validateConfig()).toBe(false);
  });

  test('generate produces files (TS default generic)', async () => {
    const out = mkTmp('s2a-generate-');
    const config: SwaggerConfig = {
      input: createSampleOpenAPIFile(),
      output: out,
      generator: 'typescript',
      groupByTags: true,
      requestStyle: undefined as any // should default to 'generic'
    } as any;

    await generate(config);
    expect(fs.existsSync(path.join(out, 'index.ts'))).toBe(true);
  });

  test('generate produces JS files when generator is javascript', async () => {
    const out = mkTmp('s2a-generate-js-');
    const config: SwaggerConfig = {
      input: createSampleOpenAPIFile(),
      output: out,
      generator: 'javascript',
      groupByTags: true,
      requestStyle: 'generic'
    } as any;

    await generate(config);
    expect(fs.existsSync(path.join(out, 'index.js'))).toBe(true);
  });
});