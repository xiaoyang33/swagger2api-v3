import * as fs from 'fs';
import * as path from 'path';
import {
  pathToFunctionName,
  toKebabCase,
  toPascalCase,
  toCamelCase,
  sanitizeFilename,
  swaggerTypeToTsType,
  getResponseType,
  generateParameterTypes,
  ensureDirectoryExists,
  removeDirectory,
  writeFile,
  loadSwaggerDocument
} from '../src/utils';
import { createSampleOpenAPIFile } from './helpers';

describe('utils', () => {
  test('pathToFunctionName converts path and method', () => {
    expect(pathToFunctionName('get', '/admin/auth/login/{id}')).toBe(
      'adminAuthLoginIdGet'
    );
  });

  test('case converters work', () => {
    expect(toKebabCase('UserController')).toBe('user-controller');
    expect(toKebabCase('user_controller')).toBe('user-controller');
    expect(toPascalCase('menu_list')).toBe('MenuList');
    expect(toCamelCase('AuthController_loginPost')).toBe(
      'authControllerLoginPost'
    );
  });

  test('sanitizeFilename removes illegal characters', () => {
    expect(sanitizeFilename('auth:controller')).toBe('auth-controller');
    expect(sanitizeFilename('a<b>c|d?e*')).toBe('a-b-c-d-e-');
  });

  test('swaggerTypeToTsType basic types and arrays', () => {
    expect(swaggerTypeToTsType({ type: 'string' })).toBe('string');
    expect(swaggerTypeToTsType({ type: 'integer' })).toBe('number');
    expect(
      swaggerTypeToTsType({ type: 'array', items: { type: 'integer' } })
    ).toBe('number[]');
  });

  test('swaggerTypeToTsType allOf generic container', () => {
    const schema = {
      allOf: [
        { $ref: '#/components/schemas/ResOp' },
        {
          properties: {
            data: { $ref: '#/components/schemas/UserListRespDto' }
          }
        }
      ]
    } as any;
    expect(swaggerTypeToTsType(schema)).toBe('ResOp<UserListRespDto>');
  });

  test('getResponseType from OpenAPI 3 content', () => {
    const responses = {
      200: {
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/ResOp' },
                {
                  properties: {
                    data: { $ref: '#/components/schemas/LoginRespDto' }
                  }
                }
              ]
            }
          }
        }
      }
    } as any;
    expect(getResponseType(responses)).toBe('ResOp<LoginRespDto>');
  });

  test('generateParameterTypes builds types from parameters', () => {
    const params = [
      { name: 'id', in: 'path', required: true, type: 'string' },
      { name: 'q', in: 'query', required: false, type: 'string' },
      {
        name: 'body',
        in: 'body',
        required: true,
        schema: { $ref: '#/components/schemas/LoginDto' }
      }
    ] as any;
    const result = generateParameterTypes(params);
    expect(result).toContain('pathParams: { id: string }');
    expect(result).toContain('queryParams?: { q?: string }');
    expect(result).toContain('data: LoginDto');
  });

  test('ensureDirectoryExists, writeFile, removeDirectory', () => {
    const tmp = path.resolve(__dirname, '../temp', 'utils');
    fs.rmSync(tmp, { recursive: true, force: true });
    const dir = path.join(tmp, 'nested');
    const file = path.join(dir, 'a.txt');
    ensureDirectoryExists(dir);
    expect(fs.existsSync(dir)).toBe(true);
    writeFile(file, 'hello');
    expect(fs.readFileSync(file, 'utf-8')).toBe('hello');
    removeDirectory(tmp);
    expect(fs.existsSync(tmp)).toBe(false);
  });

  test('loadSwaggerDocument loads local file', async () => {
    const docPath = createSampleOpenAPIFile();
    const doc = await loadSwaggerDocument(docPath);
    expect(doc.openapi || doc.swagger).toBeDefined();
    expect(doc.paths).toBeDefined();
  });
});