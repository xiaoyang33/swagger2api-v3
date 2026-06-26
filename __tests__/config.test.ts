import * as fs from 'fs';
import * as path from 'path';
import { SwaggerConfig } from '../src/types';
import { validateSwaggerConfig } from '../src/config/validator';
import { createCleanProjectTemp, createSampleOpenAPIFile } from './helpers';

describe('JSON Config Loading', () => {
  const tempDir = createCleanProjectTemp('config');
  const testConfigPath = path.join(tempDir, 'test.config.json');

  beforeEach(() => {
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  test('should load valid JSON config', () => {
    const config: SwaggerConfig = {
      input: createSampleOpenAPIFile(),
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

  test('should throw SyntaxError when config JSON is invalid', () => {
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

  test('should parse plain JSON config', () => {
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

  test('should provide local JSON schema for editor hints', () => {
    const schemaPath = path.resolve(
      __dirname,
      '../build/.swagger2api.schema.json'
    );
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

    expect(schema.properties.filter.properties.include.properties.tags).toEqual(
      {
        type: 'array',
        items: { type: 'string' }
      }
    );
    expect(schema.properties.headerComment.type).toBe('string');
  });

  test.each([
    ['input', { output: './src/api', generator: 'typescript', groupByTags: true }],
    ['output', { input: './api.json', generator: 'typescript', groupByTags: true }],
    ['generator', { input: './api.json', output: './src/api', groupByTags: true }],
    ['groupByTags', { input: './api.json', output: './src/api', generator: 'typescript' }]
  ])('should validate missing required field %s', (field, config) => {
    const errors = validateSwaggerConfig(config as any);

    expect(errors.some((error) => error.includes(field))).toBe(true);
  });

  test('should roundtrip config with filter and tagGrouping', () => {
    const config = {
      input: './api.json',
      output: './src/api',
      generator: 'typescript' as const,
      groupByTags: true,
      filter: {
        include: { tags: ['User', 'Admin'] },
        exclude: { tags: ['Internal'] }
      },
      tagGrouping: { enabled: true, fileNaming: 'kebab-case' as const }
    };

    fs.writeFileSync(testConfigPath, JSON.stringify(config, null, 2), 'utf-8');
    const loaded = JSON.parse(fs.readFileSync(testConfigPath, 'utf-8'));

    expect(loaded.filter.include.tags).toEqual(['User', 'Admin']);
    expect(loaded.filter.exclude.tags).toEqual(['Internal']);
    expect(loaded.tagGrouping.fileNaming).toBe('kebab-case');
  });
});
