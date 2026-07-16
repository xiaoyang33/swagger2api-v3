import { validateSwaggerConfig } from '../src/config/validator';
import { SwaggerConfig } from '../src/types';

describe('validateSwaggerConfig', () => {
  /** 生成一个合法的基础配置 */
  function validConfig(): SwaggerConfig {
    return {
      input: './api.json',
      output: './src/api',
      generator: 'typescript',
      groupByTags: true
    };
  }

  test('合法配置返回空错误数组', () => {
    const errors = validateSwaggerConfig(validConfig());
    expect(errors).toEqual([]);
  });

  test('缺少必填字段 input 时报错', () => {
    const config = {
      output: './src/api',
      generator: 'typescript' as const,
      groupByTags: true
    };
    const errors = validateSwaggerConfig(config as any);
    expect(errors.some((e) => e.includes('input'))).toBe(true);
  });

  test('缺少必填字段 output 时报错', () => {
    const config = {
      input: './api.json',
      generator: 'typescript' as const,
      groupByTags: true
    };
    const errors = validateSwaggerConfig(config as any);
    expect(errors.some((e) => e.includes('output'))).toBe(true);
  });

  test('output 为当前目录或父目录时报错', () => {
    const currentErrors = validateSwaggerConfig({
      ...validConfig(),
      output: '.'
    });
    const parentErrors = validateSwaggerConfig({
      ...validConfig(),
      output: '..'
    });

    expect(currentErrors).toContain('output 不能是当前工作目录或其父目录');
    expect(parentErrors).toContain('output 不能是当前工作目录或其父目录');
  });

  test('空白必填字符串时报错', () => {
    const errors = validateSwaggerConfig({
      ...validConfig(),
      input: '   ',
      output: '   '
    });

    expect(errors.some((error) => error.includes('input'))).toBe(true);
    expect(errors.some((error) => error.includes('output'))).toBe(true);
  });

  test('generator 为非法值时报错', () => {
    const config = { ...validConfig(), generator: 'python' as any };
    const errors = validateSwaggerConfig(config);
    expect(errors.some((e) => e.includes('generator'))).toBe(true);
  });

  test('groupByTags 为非布尔值时报错', () => {
    const config = { ...validConfig(), groupByTags: 'yes' as any };
    const errors = validateSwaggerConfig(config);
    expect(errors.some((e) => e.includes('groupByTags'))).toBe(true);
  });

  test('requestStyle 为非法值时报错', () => {
    const config = { ...validConfig(), requestStyle: 'invalid' as any };
    const errors = validateSwaggerConfig(config);
    expect(errors.some((e) => e.includes('requestStyle'))).toBe(true);
  });

  test('requestStyle 为合法值时不报错', () => {
    const errors1 = validateSwaggerConfig({
      ...validConfig(),
      requestStyle: 'method'
    });
    const errors2 = validateSwaggerConfig({
      ...validConfig(),
      requestStyle: 'generic'
    });
    expect(errors1.every((e) => !e.includes('requestStyle'))).toBe(true);
    expect(errors2.every((e) => !e.includes('requestStyle'))).toBe(true);
  });

  test('multiTagStrategy 为非法值时报错', () => {
    const config = { ...validConfig(), multiTagStrategy: 'duplicate' as any };
    const errors = validateSwaggerConfig(config);
    expect(errors.some((e) => e.includes('multiTagStrategy'))).toBe(true);
  });

  test('multiTagStrategy 为合法值时不报错', () => {
    const errors1 = validateSwaggerConfig({
      ...validConfig(),
      multiTagStrategy: 'first'
    });
    const errors2 = validateSwaggerConfig({
      ...validConfig(),
      multiTagStrategy: 'all'
    });
    expect(errors1.every((e) => !e.includes('multiTagStrategy'))).toBe(true);
    expect(errors2.every((e) => !e.includes('multiTagStrategy'))).toBe(true);
  });

  test('filter.include.tags 为非字符串数组时报错', () => {
    const config = {
      ...validConfig(),
      filter: { include: { tags: 'not-array' as any } }
    };
    const errors = validateSwaggerConfig(config);
    expect(errors.some((e) => e.includes('filter.include.tags'))).toBe(true);
  });

  test('filter.exclude.tags 为非字符串数组时报错', () => {
    const config = {
      ...validConfig(),
      filter: { exclude: { tags: [123] as any } }
    };
    const errors = validateSwaggerConfig(config);
    expect(errors.some((e) => e.includes('filter.exclude.tags'))).toBe(true);
  });

  test('methodNameIgnorePrefix 为非字符串数组时报错', () => {
    const config = { ...validConfig(), methodNameIgnorePrefix: 'api' as any };
    const errors = validateSwaggerConfig(config);
    expect(errors.some((e) => e.includes('methodNameIgnorePrefix'))).toBe(true);
  });

  test('options 字段类型错误时报错', () => {
    const config = {
      ...validConfig(),
      options: { generateModels: 'yes' as any }
    };
    const errors = validateSwaggerConfig(config);
    expect(errors.some((e) => e.includes('options.generateModels'))).toBe(true);
  });

  test('tagGrouping 字段类型错误时报错', () => {
    const config = {
      ...validConfig(),
      tagGrouping: { fileNaming: 'invalid' as any }
    };
    const errors = validateSwaggerConfig(config);
    expect(errors.some((e) => e.includes('tagGrouping.fileNaming'))).toBe(true);
  });

  test('comments 字段类型错误时报错', () => {
    const config = {
      ...validConfig(),
      comments: { includeDescription: 'yes' as any }
    };
    const errors = validateSwaggerConfig(config);
    expect(errors.some((e) => e.includes('comments.includeDescription'))).toBe(
      true
    );
  });

  test.each([
    ['filter', 'invalid'],
    ['options', 'invalid'],
    ['tagGrouping', []],
    ['comments', 42]
  ])('%s 不是对象时报错', (field, value) => {
    const errors = validateSwaggerConfig({
      ...validConfig(),
      [field]: value
    } as SwaggerConfig);

    expect(errors).toContain(`${field} 必须是对象`);
  });

  test('filter 的 include 和 exclude 不是对象时报错', () => {
    const errors = validateSwaggerConfig({
      ...validConfig(),
      filter: {
        include: 'invalid',
        exclude: []
      }
    } as unknown as SwaggerConfig);

    expect(errors).toContain('filter.include 必须是对象');
    expect(errors).toContain('filter.exclude 必须是对象');
  });

  test('根配置不是对象时报错', () => {
    expect(validateSwaggerConfig(null as unknown as SwaggerConfig)).toEqual([
      'config 必须是对象'
    ]);
  });

  test('未知配置字段时报错', () => {
    const config = { ...validConfig(), unknownField: 'value' as any };
    const errors = validateSwaggerConfig(config);
    expect(errors.some((e) => e.includes('unknownField'))).toBe(true);
  });

  test('filter 中的未知字段时报错', () => {
    const config = { ...validConfig(), filter: { unknownSub: 'value' } as any };
    const errors = validateSwaggerConfig(config);
    expect(errors.some((e) => e.includes('filter.unknownSub'))).toBe(true);
  });

  test('包含所有可选字段的合法配置不报错', () => {
    const config: SwaggerConfig = {
      ...validConfig(),
      requestStyle: 'generic',
      overwrite: true,
      prefix: '/api',
      importTemplate: "import { request } from '@/utils/request'",
      lint: 'prettier --write',
      methodNameIgnorePrefix: ['api', 'auth'],
      addMethodSuffix: true,
      multiTagStrategy: 'first',
      headerComment: '/** custom */',
      filter: { include: { tags: ['User'] }, exclude: { tags: [] } },
      tagGrouping: { enabled: true, fileNaming: 'camelCase' },
      options: {
        generateModels: true,
        generateApis: true,
        generateIndex: true,
        addComments: true
      },
      comments: { includeDescription: true, includeParameters: true }
    };
    const errors = validateSwaggerConfig(config);
    expect(errors).toEqual([]);
  });

  test('addMethodSuffix 为非布尔值时报错', () => {
    const config = { ...validConfig(), addMethodSuffix: 'yes' as any };
    const errors = validateSwaggerConfig(config);
    expect(errors.some((e) => e.includes('addMethodSuffix'))).toBe(true);
  });

  test('headerComment 为非字符串时报错', () => {
    const config = { ...validConfig(), headerComment: 123 as any };
    const errors = validateSwaggerConfig(config);
    expect(errors.some((e) => e.includes('headerComment'))).toBe(true);
  });

  test('prefix 为非字符串时报错', () => {
    const config = { ...validConfig(), prefix: true as any };
    const errors = validateSwaggerConfig(config);
    expect(errors.some((e) => e.includes('prefix'))).toBe(true);
  });
});
