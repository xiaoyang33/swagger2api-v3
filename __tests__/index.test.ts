import * as fs from 'fs';
import * as path from 'path';
import { Swagger2API, generate, generateFromConfig } from '../src/index';
import { SwaggerConfig } from '../src/types';
import { createCleanProjectTemp, createSampleOpenAPIFile } from './helpers';

/**
 * 创建并清空 index 集成测试目录
 * @param name 子目录名
 * @returns 临时目录路径
 */
function mkTmp(name: string) {
  return createCleanProjectTemp(name);
}

describe('index (integration)', () => {
  test('validateConfig accepts typescript and javascript', () => {
    const base: Omit<SwaggerConfig, 'generator'> = {
      input: createSampleOpenAPIFile(),
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
    const authContent = fs.readFileSync(
      path.join(out, 'authController', 'index.ts'),
      'utf-8'
    );
    expect(authContent).toMatch(/return request<.*>\(/);
    expect(authContent).toMatch(/method: 'POST'/);
    expect(authContent).not.toMatch(/return request\.post</);
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

  test('generate filters APIs by include and exclude tags', async () => {
    const out = mkTmp('s2a-filter-');
    const config: SwaggerConfig = {
      input: createSampleOpenAPIFile(),
      output: out,
      generator: 'typescript',
      groupByTags: true,
      requestStyle: 'generic',
      filter: {
        include: {
          tags: ['AuthController', 'UserController']
        },
        exclude: {
          tags: ['AuthController']
        }
      }
    } as any;

    await generate(config);

    expect(fs.existsSync(path.join(out, 'userController', 'index.ts'))).toBe(
      true
    );
    expect(fs.existsSync(path.join(out, 'authController'))).toBe(false);
    expect(fs.existsSync(path.join(out, 'roleController'))).toBe(false);
  });

  test('generate throws error when config validation fails', async () => {
    const out = mkTmp('s2a-invalid-');
    const config: SwaggerConfig = {
      input: '',
      output: out,
      generator: 'invalid' as any,
      groupByTags: true
    };

    await expect(generate(config)).rejects.toThrow('配置验证失败');
  });

  test('generate with requestStyle method produces method-style code', async () => {
    const out = mkTmp('s2a-method-');
    const config: SwaggerConfig = {
      input: createSampleOpenAPIFile(),
      output: out,
      generator: 'typescript',
      groupByTags: true,
      requestStyle: 'method'
    } as any;

    await generate(config);
    expect(fs.existsSync(path.join(out, 'index.ts'))).toBe(true);
    const authContent = fs.readFileSync(
      path.join(out, 'authController', 'index.ts'),
      'utf-8'
    );
    expect(authContent).toMatch(/return request\.post</);
  });

  test('generate with groupByTags false produces single api file', async () => {
    const out = mkTmp('s2a-ungrouped-');
    const config: SwaggerConfig = {
      input: createSampleOpenAPIFile(),
      output: out,
      generator: 'typescript',
      groupByTags: false,
      requestStyle: 'generic'
    } as any;

    await generate(config);
    expect(fs.existsSync(path.join(out, 'api.ts'))).toBe(true);
    expect(fs.existsSync(path.join(out, 'authController'))).toBe(false);
  });

  test('generate with overwrite false preserves existing files', async () => {
    const out = mkTmp('s2a-no-overwrite-');
    const markerFile = path.join(out, 'marker.txt');
    fs.writeFileSync(markerFile, 'should-keep', 'utf-8');

    const config: SwaggerConfig = {
      input: createSampleOpenAPIFile(),
      output: out,
      generator: 'typescript',
      groupByTags: true,
      overwrite: false,
      requestStyle: 'generic'
    } as any;

    await generate(config);
    expect(fs.readFileSync(markerFile, 'utf-8')).toBe('should-keep');
  });

  test('generate with prefix prepends prefix to URLs', async () => {
    const out = mkTmp('s2a-prefix-');
    const config: SwaggerConfig = {
      input: createSampleOpenAPIFile(),
      output: out,
      generator: 'typescript',
      groupByTags: false,
      prefix: '/api/v1',
      requestStyle: 'generic'
    } as any;

    await generate(config);
    const apiContent = fs.readFileSync(path.join(out, 'api.ts'), 'utf-8');
    expect(apiContent).toMatch(/url:\s*'\/api\/v1\/admin\/auth\/login'/);
  });

  test('generate skips types.ts when generateModels is false', async () => {
    const out = mkTmp('s2a-no-models-');
    const config: SwaggerConfig = {
      input: createSampleOpenAPIFile(),
      output: out,
      generator: 'typescript',
      groupByTags: true,
      requestStyle: 'generic',
      options: { generateModels: false }
    } as any;

    await generate(config);
    expect(fs.existsSync(path.join(out, 'types.ts'))).toBe(false);
  });

  test('generate skips API files when generateApis is false', async () => {
    const out = mkTmp('s2a-no-apis-');
    const config: SwaggerConfig = {
      input: createSampleOpenAPIFile(),
      output: out,
      generator: 'typescript',
      groupByTags: true,
      requestStyle: 'generic',
      options: { generateApis: false }
    } as any;

    await generate(config);
    expect(fs.existsSync(path.join(out, 'authController'))).toBe(false);
    expect(fs.existsSync(path.join(out, 'api.ts'))).toBe(false);
  });

  test('generate skips index file when generateIndex is false', async () => {
    const out = mkTmp('s2a-no-index-');
    const config: SwaggerConfig = {
      input: createSampleOpenAPIFile(),
      output: out,
      generator: 'typescript',
      groupByTags: true,
      requestStyle: 'generic',
      options: { generateIndex: false }
    } as any;

    await generate(config);
    expect(fs.existsSync(path.join(out, 'index.ts'))).toBe(false);
  });

  test('generate uses custom importTemplate', async () => {
    const out = mkTmp('s2a-import-');
    const config: SwaggerConfig = {
      input: createSampleOpenAPIFile(),
      output: out,
      generator: 'typescript',
      groupByTags: true,
      requestStyle: 'generic',
      importTemplate: "import { http } from '@/lib/http'"
    } as any;

    await generate(config);
    const authContent = fs.readFileSync(
      path.join(out, 'authController', 'index.ts'),
      'utf-8'
    );
    expect(authContent).toContain("import { http } from '@/lib/http'");
  });

  describe('generateFromConfig', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((code: number) => {
      throw new Error(`process.exit(${code})`);
    }) as any);
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    afterEach(() => {
      exitSpy.mockClear();
      consoleErrorSpy.mockClear();
    });

    afterAll(() => {
      exitSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    test('calls process.exit when config file does not exist', async () => {
      await expect(generateFromConfig('/non/existent/config.json')).rejects.toThrow('process.exit(1)');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ 找不到配置文件')
      );
    });

    test('calls process.exit when config file has invalid JSON', async () => {
      const configDir = path.resolve(__dirname, '../temp/s2a-bad-json');
      fs.mkdirSync(configDir, { recursive: true });
      const configPath = path.join(configDir, 'bad.config.json');
      fs.writeFileSync(configPath, '{ invalid json }', 'utf-8');

      await expect(generateFromConfig(configPath)).rejects.toThrow('process.exit(1)');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ 配置文件 JSON 格式错误')
      );
    });

    test('calls process.exit when config validation fails', async () => {
      const configDir = path.resolve(__dirname, '../temp/s2a-bad-config');
      fs.mkdirSync(configDir, { recursive: true });
      const configPath = path.join(configDir, 'bad.config.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({ generator: 'bad', groupByTags: true }),
        'utf-8'
      );

      await expect(generateFromConfig(configPath)).rejects.toThrow('process.exit(1)');
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ 配置验证失败:');
    });
  });
});
