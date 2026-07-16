import * as fs from 'fs';
import * as path from 'path';
import { SwaggerParser } from '../src/core/parser';
import {
  pathToFunctionName,
  toKebabCase,
  toPascalCase,
  toCamelCase,
  sanitizeFilename,
  sanitizeTypeName,
  stripNullFromUnion,
  isValidIdentifier,
  formatTsPropertyName,
  swaggerTypeToTsType,
  getResponseType,
  getSchemaFromContent,
  getRefName,
  ensureDirectoryExists,
  removeDirectory,
  isPathInside,
  writeFile,
  loadSwaggerDocument
} from '../src/utils';
import { createCleanProjectTemp, createSampleOpenAPIFile } from './helpers';

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

  test('isValidIdentifier identifies valid TypeScript identifiers', () => {
    expect(isValidIdentifier('foo')).toBe(true);
    expect(isValidIdentifier('_bar')).toBe(true);
    expect(isValidIdentifier('$baz')).toBe(true);
    expect(isValidIdentifier('foo123')).toBe(true);
  });

  test('isValidIdentifier rejects invalid TypeScript identifiers', () => {
    expect(isValidIdentifier('x-request-id')).toBe(false);
    expect(isValidIdentifier('123abc')).toBe(false);
    expect(isValidIdentifier('user.name')).toBe(false);
    expect(isValidIdentifier('')).toBe(false);
  });

  test('formatTsPropertyName quotes invalid identifiers', () => {
    expect(formatTsPropertyName('foo')).toBe('foo');
    expect(formatTsPropertyName('x-request-id')).toBe('"x-request-id"');
    expect(formatTsPropertyName('123abc')).toBe('"123abc"');
  });

  test('sanitizeTypeName handles empty string', () => {
    expect(sanitizeTypeName('')).toBe('AnonymousType');
    expect(sanitizeTypeName('123-model')).toBe('_123Model');
  });

  // ─── getRefName ───
  test('getRefName extracts name from $ref', () => {
    expect(getRefName('#/components/schemas/UserDto')).toBe('UserDto');
    expect(getRefName('#/components/schemas/System.Menu.ListResp')).toBe(
      'System.Menu.ListResp'
    );
    expect(getRefName('UserDto')).toBe('UserDto');
    expect(getRefName('#/components/schemas/Foo~1Bar')).toBe('Foo/Bar');
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
    expect(swaggerTypeToTsType({ type: 'string', format: 'binary' })).toBe(
      'Blob'
    );
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

  test('swaggerTypeToTsType handles type arrays', () => {
    expect(swaggerTypeToTsType({ type: ['string', 'null'] })).toBe(
      'string | null'
    );
    expect(swaggerTypeToTsType({ type: ['integer', 'string'] })).toBe(
      'number | string'
    );
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
    const schemas = {
      ResOp: {
        type: 'object',
        properties: {
          code: { type: 'integer' },
          data: { type: 'object' }
        }
      },
      UserListRespDto: { type: 'object', properties: {} }
    } as any;
    expect(swaggerTypeToTsType(schema, schemas)).toBe('ResOp<UserListRespDto>');
  });

  test('swaggerTypeToTsType keeps standard allOf inheritance as intersection', () => {
    const schemas = {
      Pet: {
        type: 'object',
        properties: { name: { type: 'string' } }
      }
    } as any;
    const schema = {
      allOf: [
        { $ref: '#/components/schemas/Pet' },
        { properties: { age: { type: 'integer' } } }
      ]
    } as any;

    expect(swaggerTypeToTsType(schema, schemas)).toBe(
      'Pet & {\n  age?: number;\n}'
    );
  });

  test('swaggerTypeToTsType keeps own properties on generic allOf schemas', () => {
    const schemas = {
      ResOp: {
        type: 'object',
        properties: {
          code: { type: 'integer' },
          data: { type: 'object' }
        }
      },
      User: { type: 'object', properties: { id: { type: 'string' } } }
    } as any;
    const schema = {
      allOf: [
        { $ref: '#/components/schemas/ResOp' },
        { properties: { data: { $ref: '#/components/schemas/User' } } }
      ],
      properties: { traceId: { type: 'string' } }
    } as any;

    expect(swaggerTypeToTsType(schema, schemas)).toBe(
      'ResOp<User> & {\n  traceId?: string;\n}'
    );
  });

  test('swaggerTypeToTsType allOf with no ref item falls back', () => {
    const schema = {
      allOf: [{ type: 'string' }, { type: 'integer' }]
    };
    expect(swaggerTypeToTsType(schema)).toBe('string & number');
  });

  test('swaggerTypeToTsType allOf with multiple refs returns intersection', () => {
    const schema = {
      allOf: [
        { $ref: '#/components/schemas/UserDto' },
        { $ref: '#/components/schemas/AuditDto' }
      ]
    };
    expect(swaggerTypeToTsType(schema)).toBe('UserDto & AuditDto');
  });

  test('swaggerTypeToTsType allOf with three elements uses intersection', () => {
    const schema = {
      allOf: [
        { $ref: '#/components/schemas/BaseDto' },
        { type: 'string' },
        {
          type: 'object',
          properties: {
            name: { type: 'string' }
          }
        }
      ]
    };
    const result = swaggerTypeToTsType(schema);

    expect(result).toContain('BaseDto');
    expect(result).toContain('string');
    expect(result).toContain('name?: string');
    expect(result).toContain('&');
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
    const result = swaggerTypeToTsType(schema);
    expect(result).toContain('ResOp &');
    expect(result).toContain('data?: UserDto');
    expect(result).toContain('extra?: string');
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

  test('swaggerTypeToTsType infers object from properties', () => {
    expect(
      swaggerTypeToTsType({ properties: { id: { type: 'string' } } })
    ).toBe('{\n  id?: string;\n}');
  });

  test('swaggerTypeToTsType combines properties and additionalProperties', () => {
    const result = swaggerTypeToTsType({
      type: 'object',
      properties: { id: { type: 'string' } },
      additionalProperties: { type: 'integer' }
    });

    expect(result).toContain('id?: string;');
    expect(result).toContain('[key: string]: number | string | undefined;');
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

  test('swaggerTypeToTsType quotes invalid object property names', () => {
    const schema = {
      type: 'object',
      properties: {
        'x-request-id': { type: 'string' },
        'user.name': { type: 'string' },
        '1st': { type: 'integer' }
      }
    };
    const result = swaggerTypeToTsType(schema);

    expect(result).toContain('"x-request-id"?: string;');
    expect(result).toContain('"user.name"?: string;');
    expect(result).toContain('"1st"?: number;');
  });

  // ─── swaggerTypeToTsType — enum ───
  test('swaggerTypeToTsType handles non-string enum values', () => {
    expect(swaggerTypeToTsType({ type: 'integer', enum: [0, 1] })).toBe(
      '0 | 1'
    );
    expect(swaggerTypeToTsType({ enum: ['on', null] })).toBe('"on" | null');
    expect(
      swaggerTypeToTsType({ type: 'string', enum: ['active', 'inactive'] })
    ).toBe('"active" | "inactive"');
    expect(swaggerTypeToTsType({ enum: ["can't", 'c\\d'] })).toBe(
      '"can\'t" | "c\\\\d"'
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

  test('swaggerTypeToTsType keeps array component refs as aliases', () => {
    const schemas = {
      MenuListRespDto: {
        type: 'array',
        items: { $id: 'MenuListRespDto', type: 'object', properties: {} }
      }
    } as any;

    expect(swaggerTypeToTsType({ $ref: 'MenuListRespDto' }, schemas)).toBe(
      'MenuListRespDto'
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
    const schemas = {
      ResOp: {
        type: 'object',
        properties: {
          code: { type: 'integer' },
          data: { type: 'object' }
        }
      },
      LoginRespDto: { type: 'object', properties: {} }
    } as any;
    expect(getResponseType(responses, schemas)).toBe('ResOp<LoginRespDto>');
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

    expect(getResponseType(responses, schemas)).toBe('ListResp');
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
        201: {
          description: 'created',
          content: { 'application/json': { schema: { type: 'string' } } }
        }
      })
    ).toBe('string');
    expect(
      getResponseType({
        202: {
          description: 'accepted',
          content: { 'application/json': { schema: { type: 'boolean' } } }
        }
      })
    ).toBe('boolean');
    expect(
      getResponseType({
        default: {
          description: 'ok',
          content: { 'application/json': { schema: { type: 'number' } } }
        }
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
    const tmp = createCleanProjectTemp('utils');
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
    const missingPath = path.join(
      createCleanProjectTemp('utils-missing'),
      'missing'
    );
    expect(() => removeDirectory(missingPath)).not.toThrow();
  });

  test('isPathInside only accepts strict child paths', () => {
    const parent = path.resolve(__dirname, '../temp/path-parent');

    expect(isPathInside(parent, path.join(parent, 'child'))).toBe(true);
    expect(isPathInside(parent, parent)).toBe(false);
    expect(isPathInside(parent, path.resolve(parent, '..'))).toBe(false);
  });

  // ─── loadSwaggerDocument ───
  test('loadSwaggerDocument loads local file', async () => {
    const docPath = createSampleOpenAPIFile();
    const doc = await loadSwaggerDocument(docPath);
    expect(doc.openapi).toBe('3.0.0');
    expect(doc.paths).toHaveProperty('/admin/auth/login');
  });

  test('loadSwaggerDocument throws for non-existent file', async () => {
    const missingPath = path.join(
      createCleanProjectTemp('missing-document'),
      'openapi.json'
    );
    await expect(loadSwaggerDocument(missingPath)).rejects.toThrow();
  });

  test('loadSwaggerDocument bundles external refs into the document', async () => {
    const tmp = createCleanProjectTemp('external-ref');
    const modelsPath = path.join(tmp, 'models.json');
    const documentPath = path.join(tmp, 'openapi.json');
    fs.writeFileSync(
      modelsPath,
      JSON.stringify({
        User: {
          type: 'object',
          properties: { id: { type: 'string' } }
        }
      }),
      'utf-8'
    );
    fs.writeFileSync(
      documentPath,
      JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'External Ref', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              responses: {
                200: {
                  description: 'ok',
                  content: {
                    'application/json': {
                      schema: { $ref: './models.json#/User' }
                    }
                  }
                }
              }
            }
          }
        },
        components: {
          schemas: {
            User: { $ref: './models.json#/User' }
          }
        }
      }),
      'utf-8'
    );

    const document = await loadSwaggerDocument(documentPath);
    expect(document.components?.schemas?.User).toEqual(
      expect.objectContaining({
        type: 'object',
        properties: { id: { type: 'string' } }
      })
    );
    const parser = new SwaggerParser(document, {
      input: documentPath,
      output: path.join(tmp, 'api'),
      generator: 'typescript',
      groupByTags: false
    });
    expect(parser.parseApis()[0].responseType).toBe('User');
  });

  test('loadSwaggerDocument loads OpenAPI 3.1 documents', async () => {
    const tmp = createCleanProjectTemp('openapi-31-document');
    const documentPath = path.join(tmp, 'openapi.json');
    fs.writeFileSync(
      documentPath,
      JSON.stringify({
        openapi: '3.1.0',
        info: { title: 'OpenAPI 3.1', version: '1.0.0' },
        paths: {}
      }),
      'utf-8'
    );

    await expect(loadSwaggerDocument(documentPath)).resolves.toEqual(
      expect.objectContaining({ openapi: '3.1.0' })
    );
  });
});
