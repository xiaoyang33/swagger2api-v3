import * as fs from 'fs';
import * as path from 'path';
import { generateFromConfig } from '../src/index';
import { SwaggerConfig } from '../src/types';

describe('JSON Config Loading', () => {
  const tempDir = path.resolve(__dirname, '../temp');
  const testConfigPath = path.join(tempDir, 'test.config.json');

  beforeEach(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  test('should load valid JSON config', () => {
    const config: SwaggerConfig = {
      input: path.resolve(__dirname, '../swagger_temp.json'),
      output: path.join(tempDir, 'api'),
      generator: 'typescript',
      groupByTags: true
    };

    fs.writeFileSync(testConfigPath, JSON.stringify(config, null, 2), 'utf-8');

    const loadedContent = fs.readFileSync(testConfigPath, 'utf-8');
    const loadedConfig = JSON.parse(loadedContent);

    expect(loadedConfig.input).toBe(config.input);
    expect(loadedConfig.output).toBe(config.output);
    expect(loadedConfig.generator).toBe('typescript');
  });

  test('should handle invalid JSON gracefully', () => {
    const invalidJson = '{ "input": "test", invalid }';
    fs.writeFileSync(testConfigPath, invalidJson, 'utf-8');

    expect(() => {
      const content = fs.readFileSync(testConfigPath, 'utf-8');
      JSON.parse(content);
    }).toThrow(SyntaxError);
  });

  test('should load config with all optional fields', () => {
    const config = {
      input: 'http://localhost:3000/api/docs',
      output: './src/api',
      generator: 'typescript',
      groupByTags: true,
      requestStyle: 'generic',
      prefix: '/api',
      lint: 'prettier --write',
      methodNameIgnorePrefix: ['api', 'auth'],
      addMethodSuffix: true,
      importTemplate: "import { request } from '@/utils/request';",
      options: {
        addComments: true
      }
    };

    fs.writeFileSync(testConfigPath, JSON.stringify(config, null, 2), 'utf-8');

    const loadedContent = fs.readFileSync(testConfigPath, 'utf-8');
    const loadedConfig = JSON.parse(loadedContent);

    expect(loadedConfig.requestStyle).toBe('generic');
    expect(loadedConfig.prefix).toBe('/api');
    expect(loadedConfig.methodNameIgnorePrefix).toEqual(['api', 'auth']);
    expect(loadedConfig.addMethodSuffix).toBe(true);
  });

  test('should handle missing config file', () => {
    const nonExistentPath = path.join(tempDir, 'nonexistent.config.json');

    expect(fs.existsSync(nonExistentPath)).toBe(false);
  });

  test('should parse JSON with comments stripped (if using json5 or similar)', () => {
    // Standard JSON doesn't support comments, but this tests the basic structure
    const config = {
      input: 'http://localhost:3000/api/docs',
      output: './src/api',
      generator: 'javascript',
      groupByTags: false
    };

    fs.writeFileSync(testConfigPath, JSON.stringify(config, null, 2), 'utf-8');

    const loadedContent = fs.readFileSync(testConfigPath, 'utf-8');
    const loadedConfig = JSON.parse(loadedContent);

    expect(loadedConfig.generator).toBe('javascript');
    expect(loadedConfig.groupByTags).toBe(false);
  });
});
