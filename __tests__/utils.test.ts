import * as fs from 'fs';
import * as path from 'path';
import {
  pathToFunctionName,
  toKebabCase,
  toPascalCase,
  toCamelCase,
  sanitizeFilename,
  sanitizeTypeName,
  stripNullFromUnion,
  swaggerTypeToTsType,
  getResponseType,
  getSchemaFromContent,
  getRefName,
  ensureDirectoryExists,
  removeDirectory,
  writeFile,
  loadSwaggerDocument
} from '../src/utils';
import { createSampleOpenAPIFile } from './helpers';

describe('utils', () => {
  // ─── pathToFunctionName ───
  test('pathToFunctionName converts path and method', () => {
    expect(pathToFunctionName('get', '/admin/auth/login/{id}')).toBe(
      'adminAuthLoginIdGet'
    );
  });

  test('pathToFunctionName handles root path', () => {
    expect(pathToFunctionName('get', '/')).toBe('Get');
  });

  test('pathToFunctionName handles special characters in path', () => {
    expect(pathToFunctionName('get', '/api/v1/user-info/{id}')).toBe(
      'apiV1UserinfoIdGet'
    );
  });

  // ─── case converters ───
  test('case converters work', () => {
    expect(toKebabCase('UserController')).toBe('user-controller');
    expect(toKebabCase('user_controller')).toBe('user-controller');
    expect(toPascalCase('menu_list')).toBe('MenuList');
    expect(toCamelCase('AuthController_loginPost')).toBe(
      'authControllerLoginPost'
    );
  });

  test('toPascalCase handles edge cases', () => {
    expect(toPascalCase('')).toBe('');
    expect(toPascalCase('a')).toBe('A');
    expect(toPascalCase('a-b-c')).toBe('ABC');
  });

  test('toKebabCase handles edge cases', () => {
    expect(toKebabCase('')).toBe('');
    expect(toKebabCase('already-kebab')).toBe('already-kebab');
  });

  // ─── sanitizeFilename ───
  test('sanitizeFilename removes illegal characters', () => {
    expect(sanitizeFilename('auth:controller')).toBe('auth-controller');
    expect(sanitizeFilename('a<b>c|d?e*')).toBe('a-b-c-d-e-');
  });

  // ─── sanitizeTypeName ───
  test('sanitizeTypeName handles dots and special chars', () => {
    expect(sanitizeTypeName('System.Menu.ListResp')).toBe('SystemMenuListResp');
    expect(sanitizeTypeName('some.other-Type')).toBe('SomeOtherType');
  });

  test('sanitizeTypeName handles empty string', () => {
    expect(sanitizeTypeName('')).toBe('');
  });

  // ─── getRefName ───
  test('getRefName extracts name from $ref', () => {
    expect(getRefName('#/components/schemas/UserDto')).toBe('UserDto');
    expect(getRefName('#/components/schemas/System.Menu.ListResp')).toBe(
      'System.Menu.ListResp'
    );
    expect(getRefName('UserDto')).toBe('UserDto');
    expect(getRefName('')).toBe('');
  });

  // ─── swaggerTypeToTsType — 边界输入 ───
  test('swaggerTypeToTsType returns any for null/undefined/empty', () => {
    expect(swaggerTypeToTsType(null as any)).toBe('any');
    expect(swaggerTypeToTsType(undefined as any)).toBe('any');
    expect(swaggerTypeToTsType({} as any)).toBe('any');
  });

  // ─── swaggerTypeToTsType — 基本类型 ───
  test('swaggerTypeToTsType basic types and arrays', () => {
    expect(swaggerTypeToTsType({ type: 'string' })).toBe('string');
    expect(swaggerTypeToTsType({ type: 'integer' })).toBe('number');
    expect(swaggerTypeToTsType({ type: 'number' })).toBe('number');
    expect(swaggerTypeToTsType({ type: 'boolean' })).toBe('boolean');
    expect(swaggerTypeToTsType({ type: 'file' })).toBe('File');
    expect(swaggerTypeToTsType({ type: 'null' })).toBe('null');
    expect(
      swaggerTypeToTsType({ type: 'array', items: { type: 'integer' } })
    ).toBe('number[]');
  });

  // ─── swaggerTypeToTsType — nullable ───
  test('swaggerTypeToTsType handles nullable', () => {
    expect(swaggerTypeToTsType({ type: 'string', nullable: true })).toBe(
      'string | null'
    );
    expect(swaggerTypeToTsType({ type: 'integer', nullable: true })).toBe(
      'number | null'
    );
    expect(swaggerTypeToTsType({ nullable: true })).toBe('any');
  });

  // ─── swaggerTypeToTsType — $ref ───
  test('swaggerTypeToTsType handles refs with dots', () => {
    const schema = { $ref: '#/components/schemas/System.Menu.ListResp' } as any;
    expect(swaggerTypeToTsType(schema)).toBe('SystemMenuListResp');
  });

  // ─── swaggerTypeToTsType — allOf ───
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

  test('swaggerTypeToTsType allOf with no ref item falls back', () => {
    const schema = {
      allOf: [{ type: 'string' }, { type: 'integer' }]
    };
    expect(swaggerTypeToTsType(schema)).toBe('string');
  });

  test('swaggerTypeToTsType allOf with only ref returns sanitized name', () => {
    const schema = {
      allOf: [{ $ref: '#/components/schemas/UserDto' }]
    };
    expect(swaggerTypeToTsType(schema)).toBe('UserDto');
  });

  test('swaggerTypeToTsType allOf with multiple properties', () => {
    const schema = {
      allOf: [
        { $ref: '#/components/schemas/ResOp' },
        {
          properties: {
            data: { $ref: '#/components/schemas/UserDto' },
            extra: { type: 'string' }
          }
        }
      ]
    };
    expect(swaggerTypeToTsType(schema)).toContain('ResOp<');
    expect(swaggerTypeToTsType(schema)).toContain('extra');
  });

  // ─── swaggerTypeToTsType — anyOf / oneOf ───
  test('swaggerTypeToTsType handles anyOf with null', () => {
    const schema = {
      anyOf: [{ type: 'string' }, { type: 'null' }]
    };
    expect(swaggerTypeToTsType(schema)).toBe('string | null');
  });

  test('swaggerTypeToTsType handles oneOf', () => {
    const schema = {
      oneOf: [{ type: 'integer' }, { type: 'string' }]
    };
    expect(swaggerTypeToTsType(schema)).toBe('number | string');
  });

  test('swaggerTypeToTsType anyOf with any returns any', () => {
    const schema = {
      anyOf: [{}, { type: 'string' }]
    };
    expect(swaggerTypeToTsType(schema)).toBe('any');
  });

  // ─── swaggerTypeToTsType — OpenAPI 3.1 type array ───
  test('swaggerTypeToTsType handles OpenAPI 3.1 type array', () => {
    expect(swaggerTypeToTsType({ type: ['string', 'null'] })).toBe(
      'string | null'
    );
  });

  // ─── swaggerTypeToTsType — object ───
  test('swaggerTypeToTsType handles object additionalProperties', () => {
    expect(
      swaggerTypeToTsType({
        type: 'object',
        additionalProperties: { type: 'integer' }
      })
    ).toBe('Record<string, number>');
  });

  test('swaggerTypeToTsType handles additionalProperties false', () => {
    expect(
      swaggerTypeToTsType({
        type: 'object',
        additionalProperties: false
      })
    ).toBe('Record<string, never>');
  });

  test('swaggerTypeToTsType handles object with no properties as Record<string, any>', () => {
    expect(swaggerTypeToTsType({ type: 'object' })).toBe('Record<string, any>');
  });

  test('swaggerTypeToTsType handles nested objects', () => {
    const schema = {
      type: 'object',
      properties: {
        address: {
          type: 'object',
          properties: {
            city: { type: 'string' },
            zip: { type: 'string' }
          }
        }
      }
    };
    const result = swaggerTypeToTsType(schema);
    expect(result).toContain('city?: string');
    expect(result).toContain('zip?: string');
  });

  // ─── swaggerTypeToTsType — enum ───
  test('swaggerTypeToTsType handles non-string enum values', () => {
    expect(swaggerTypeToTsType({ type: 'integer', enum: [0, 1] })).toBe(
      '0 | 1'
    );
    expect(swaggerTypeToTsType({ enum: ['on', null] })).toBe("'on' | null");
    expect(swaggerTypeToTsType({ type: 'string', enum: ['active', 'inactive'] })).toBe(
      "'active' | 'inactive'"
    );
  });

  // ─── swaggerTypeToTsType — array 引用 ───
  test('swaggerTypeToTsType avoids duplicate arrays for array-of-array-ref', () => {
    const schemas = {
      List: { type: 'array', items: { type: 'string' } }
    } as any;
    const schema = {
      type: 'array',
      items: { $ref: '#/components/schemas/List' }
    } as any;
    expect(swaggerTypeToTsType(schema, schemas)).toBe('List[]');
  });

  test('swaggerTypeToTsType handles bare ref to array schema and avoids [][]', () => {
    const schemas = {
      MenuListRespDto: {
        type: 'array',
        items: { $id: 'MenuListRespDto', type: 'object', properties: {} }
      }
    } as any;

    expect(swaggerTypeToTsType({ $ref: 'MenuListRespDto' }, schemas)).toBe(
      'MenuListRespDto[]'
    );

    const schema = {
      type: 'array',
      items: { $ref: 'MenuListRespDto' }
    } as any;
    expect(swaggerTypeToTsType(schema, schemas)).toBe('MenuListRespDto[]');
  });

  // ─── stripNullFromUnion ───
  test('stripNullFromUnion removes top-level null and keeps nested unions', () => {
    expect(stripNullFromUnion('string | null')).toBe('string');
    expect(stripNullFromUnion('null | any')).toBe('any');
    expect(stripNullFromUnion('ResOp<{ a: string | null }> | null')).toBe(
      'ResOp<{ a: string | null }>'
    );
  });

  test('stripNullFromUnion handles edge cases', () => {
    expect(stripNullFromUnion('')).toBe('any');
    expect(stripNullFromUnion('null')).toBe('any');
    expect(stripNullFromUnion('string')).toBe('string');
  });

  test('stripNullFromUnion handles deeply nested generics', () => {
    expect(stripNullFromUnion('A<B<C | null>> | null')).toBe('A<B<C | null>>');
    expect(stripNullFromUnion('A<B<C>> | null')).toBe('A<B<C>>');
  });

  test('stripNullFromUnion deduplicates types', () => {
    expect(stripNullFromUnion('string | string | null')).toBe('string');
  });

  // ─── getResponseType ───
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

  test('getResponseType uses json-like content and schemas context', () => {
    const responses = {
      202: {
        description: 'accepted',
        content: {
          'application/problem+json': {
            schema: { $ref: '#/components/schemas/ListResp' }
          }
        }
      }
    };
    const schemas = {
      ListResp: {
        type: 'array',
        items: { type: 'string' }
      }
    };

    expect(getResponseType(responses, schemas)).toBe('ListResp[]');
  });

  test('getResponseType returns void for No Content', () => {
    const responses = {
      204: { description: 'No Content' }
    };
    expect(getResponseType(responses as any)).toBe('void');
  });

  test('getResponseType returns any for null responses', () => {
    expect(getResponseType(null as any)).toBe('any');
    expect(getResponseType(undefined as any)).toBe('any');
  });

  test('getResponseType falls back to 201 then 2xx then default', () => {
    expect(
      getResponseType({
        201: { description: 'created', content: { 'application/json': { schema: { type: 'string' } } } }
      })
    ).toBe('string');
    expect(
      getResponseType({
        202: { description: 'accepted', content: { 'application/json': { schema: { type: 'boolean' } } } }
      })
    ).toBe('boolean');
    expect(
      getResponseType({
        default: { description: 'ok', content: { 'application/json': { schema: { type: 'number' } } } }
      })
    ).toBe('number');
  });

  // ─── getSchemaFromContent ───
  test('getSchemaFromContent returns undefined for null/undefined', () => {
    expect(getSchemaFromContent(undefined)).toBeUndefined();
    expect(getSchemaFromContent(null as any)).toBeUndefined();
  });

  test('getSchemaFromContent prefers application/json', () => {
    const content = {
      'application/json': { schema: { type: 'string' } },
      'application/xml': { schema: { type: 'object' } }
    };
    expect(getSchemaFromContent(content)).toEqual({ type: 'string' });
  });

  test('getSchemaFromContent falls back to first schema media type', () => {
    expect(
      getSchemaFromContent({
        'multipart/form-data': {
          schema: { type: 'object' }
        }
      })
    ).toEqual({ type: 'object' });
  });

  // ─── file operations ───
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

  test('removeDirectory handles non-existent directory', () => {
    expect(() => removeDirectory('/non/existent/path')).not.toThrow();
  });

  // ─── loadSwaggerDocument ───
  test('loadSwaggerDocument loads local file', async () => {
    const docPath = createSampleOpenAPIFile();
    const doc = await loadSwaggerDocument(docPath);
    expect(doc.openapi).toBeDefined();
    expect(doc.paths).toBeDefined();
  });

  test('loadSwaggerDocument throws for non-existent file', async () => {
    await expect(loadSwaggerDocument('/non/existent/file.json')).rejects.toThrow();
  });
});
