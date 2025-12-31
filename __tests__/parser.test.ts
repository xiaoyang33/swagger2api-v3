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

  test('parseTypes strips null from optional properties', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0' },
      paths: {},
      components: {
        schemas: {
          NullRulesDto: {
            type: 'object',
            properties: {
              reqNullable: { type: 'string', nullable: true },
              optNullable: { type: 'string', nullable: true },
              reqAnyOfNull: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              optAnyOfNull: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              reqAnyNull: { anyOf: [{}, { type: 'null' }] }
            },
            required: ['reqNullable', 'reqAnyOfNull', 'reqAnyNull']
          }
        }
      }
    };

    const parser = new SwaggerParser(doc as any, config);
    const types = parser.parseTypes();
    const t = types.find((x) => x.name === 'NullRulesDto');
    expect(t).toBeDefined();
    const def = t!.definition;

    expect(def).toContain('reqNullable: string | null;');
    expect(def).toContain('optNullable?: string;');
    expect(def).toContain('reqAnyOfNull: string | null;');
    expect(def).toContain('optAnyOfNull?: string;');
    expect(def).toContain('reqAnyNull: any;');
    expect(def).not.toContain('reqAnyNull: any | null;');
  });
});
