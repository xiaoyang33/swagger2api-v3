import * as path from 'path';
import { SwaggerParser } from '../src/core/parser';
import { loadSwaggerDocument } from '../src/utils';
import { SwaggerConfig } from '../src/types';
import { createSampleOpenAPIFile } from './helpers';

describe('parser', () => {
  let config: SwaggerConfig;

  beforeAll(() => {
    const inputFile = createSampleOpenAPIFile();
    config = {
      input: inputFile,
      output: path.resolve(__dirname, '../temp', 'parser'),
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
      }
    } as any;
  });

  test('parseApis extracts operations with names and types', async () => {
    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const apis = parser.parseApis();
    expect(apis.length).toBeGreaterThan(0);

    const loginApi = apis.find((a) => a.path === '/admin/auth/login');
    expect(loginApi).toBeDefined();
    expect(loginApi!.method).toBe('POST');
    expect(loginApi!.name).toBe('AuthController_loginPost');
    expect(loginApi!.responseType).toMatch(/ResOp<.*>/);
    expect(loginApi!.requestBodyType).toBe('LoginDto');
  });

  test('groupApisByTags groups by tag', async () => {
    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const apis = parser.parseApis();
    const grouped = parser.groupApisByTags(apis);
    expect(grouped.size).toBeGreaterThan(0);
    expect(grouped.has('AuthController')).toBe(true);
  });

  test('getTags collects tags from doc and operations', async () => {
    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const tags = parser.getTags();
    expect(tags).toEqual(
      expect.arrayContaining([
        'AuthController',
        'UserController',
        'RoleController',
        'MenuController'
      ])
    );
  });

  test('getApiInfo returns document info', async () => {
    const doc = await loadSwaggerDocument(config.input);
    const parser = new SwaggerParser(doc, config);
    const info = parser.getApiInfo();
    expect(info.title).toBe('template-admin');
    expect(info.version).toBe('1.0');
  });
});