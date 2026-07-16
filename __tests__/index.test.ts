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
function mkTmp(name: string): string {
  return createCleanProjectTemp(name);
}

/**
 * 创建公共入口集成测试配置
 * @param output 输出目录
 * @param overrides 配置覆盖项
 * @returns Swagger 配置
 */
function createIntegrationConfig(
  output: string,
  overrides: Partial<SwaggerConfig> = {}
): SwaggerConfig {
  return {
    input: createSampleOpenAPIFile(),
    output,
    generator: 'typescript',
    groupByTags: true,
    ...overrides
  };
}

describe('index (integration)', () => {
  test('validateConfig accepts typescript and javascript', () => {
    const base = createIntegrationConfig(mkTmp('s2a-index-'));

    const s1 = new Swagger2API(base);
    expect(s1.validateConfig()).toBe(true);
    const s2 = new Swagger2API({ ...base, generator: 'javascript' });
    expect(s2.validateConfig()).toBe(true);

    const s3 = new Swagger2API({ ...base, generator: 'foo' } as any);
    expect(s3.validateConfig()).toBe(false);
  });

  test('generate produces files (TS default generic)', async () => {
    const out = mkTmp('s2a-generate-');
    const config = createIntegrationConfig(out, {
      requestStyle: undefined as any // should default to 'generic'
    });

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
    const config = createIntegrationConfig(out, {
      generator: 'javascript',
      requestStyle: 'generic'
    });

    await generate(config);
    expect(fs.existsSync(path.join(out, 'index.js'))).toBe(true);
  });

  test('generate filters APIs by include and exclude tags', async () => {
    const out = mkTmp('s2a-filter-');
    const config = createIntegrationConfig(out, {
      requestStyle: 'generic',
      filter: {
        include: {
          tags: ['AuthController', 'UserController']
        },
        exclude: {
          tags: ['AuthController']
        }
      }
    });

    await generate(config);

    expect(fs.existsSync(path.join(out, 'userController', 'index.ts'))).toBe(
      true
    );
    expect(fs.existsSync(path.join(out, 'authController'))).toBe(false);
    expect(fs.existsSync(path.join(out, 'roleController'))).toBe(false);
  });

  test('generate throws error when config validation fails', async () => {
    const out = mkTmp('s2a-invalid-');
    const config = createIntegrationConfig(out, {
      input: '',
      generator: 'invalid' as any
    });

    await expect(generate(config)).rejects.toThrow('配置验证失败');
  });

  test('generate with requestStyle method produces method-style code', async () => {
    const out = mkTmp('s2a-method-');
    const config = createIntegrationConfig(out, {
      requestStyle: 'method'
    });

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
    const config = createIntegrationConfig(out, {
      groupByTags: false,
      requestStyle: 'generic'
    });

    await generate(config);
    expect(fs.existsSync(path.join(out, 'api.ts'))).toBe(true);
    expect(fs.existsSync(path.join(out, 'authController'))).toBe(false);
  });

  test('generate with overwrite false preserves existing files', async () => {
    const out = mkTmp('s2a-no-overwrite-');
    const markerFile = path.join(out, 'marker.txt');
    fs.writeFileSync(markerFile, 'should-keep', 'utf-8');

    const config = createIntegrationConfig(out, {
      overwrite: false,
      requestStyle: 'generic'
    });

    await generate(config);
    expect(fs.readFileSync(markerFile, 'utf-8')).toBe('should-keep');
  });

  test('generate with prefix prepends prefix to URLs', async () => {
    const out = mkTmp('s2a-prefix-');
    const config = createIntegrationConfig(out, {
      groupByTags: false,
      prefix: '/api/v1',
      requestStyle: 'generic'
    });

    await generate(config);
    const apiContent = fs.readFileSync(path.join(out, 'api.ts'), 'utf-8');
    expect(apiContent).toMatch(/url:\s*'\/api\/v1\/admin\/auth\/login'/);
  });

  test('generate skips types.ts when generateModels is false', async () => {
    const out = mkTmp('s2a-no-models-');
    const config = createIntegrationConfig(out, {
      requestStyle: 'generic',
      options: { generateModels: false }
    });

    await generate(config);
    expect(fs.existsSync(path.join(out, 'types.ts'))).toBe(false);
  });

  test('generate skips API files when generateApis is false', async () => {
    const out = mkTmp('s2a-no-apis-');
    const config = createIntegrationConfig(out, {
      requestStyle: 'generic',
      options: { generateApis: false }
    });

    await generate(config);
    expect(fs.existsSync(path.join(out, 'authController'))).toBe(false);
    expect(fs.existsSync(path.join(out, 'api.ts'))).toBe(false);
  });

  test('generate skips index file when generateIndex is false', async () => {
    const out = mkTmp('s2a-no-index-');
    const config = createIntegrationConfig(out, {
      requestStyle: 'generic',
      options: { generateIndex: false }
    });

    await generate(config);
    expect(fs.existsSync(path.join(out, 'index.ts'))).toBe(false);
  });

  test('generate uses custom importTemplate', async () => {
    const out = mkTmp('s2a-import-');
    const config = createIntegrationConfig(out, {
      requestStyle: 'generic',
      importTemplate: "import { http } from '@/lib/http'"
    });

    await generate(config);
    const authContent = fs.readFileSync(
      path.join(out, 'authController', 'index.ts'),
      'utf-8'
    );
    expect(authContent).toContain("import { http } from '@/lib/http'");
  });

  describe('generateFromConfig', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(((
      code: number
    ) => {
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
      await expect(
        generateFromConfig('/non/existent/config.json')
      ).rejects.toThrow('process.exit(1)');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ 找不到配置文件')
      );
    });

    test('calls process.exit when config file has invalid JSON', async () => {
      const configDir = mkTmp('s2a-bad-json');
      const configPath = path.join(configDir, 'bad.config.json');
      fs.writeFileSync(configPath, '{ invalid json }', 'utf-8');

      await expect(generateFromConfig(configPath)).rejects.toThrow(
        'process.exit(1)'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ 配置文件 JSON 格式错误')
      );
    });

    test('calls process.exit when config validation fails', async () => {
      const configDir = mkTmp('s2a-bad-config');
      const configPath = path.join(configDir, 'bad.config.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({ generator: 'bad', groupByTags: true }),
        'utf-8'
      );

      await expect(generateFromConfig(configPath)).rejects.toThrow(
        'process.exit(1)'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ 配置验证失败:');
    });
  });
});
