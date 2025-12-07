import { SwaggerParser } from '../src/core/parser';
import { SwaggerConfig } from '../src/types';

describe('Array type reference generation', () => {
  test('should generate array notation at reference point, not in type definition', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0' },
      paths: {},
      components: {
        schemas: {
          SystemMenuTreeDto: {
            description: '菜单树',
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' }
            },
            required: ['id', 'title']
          },
          SystemMenuListRespDto: {
            description: '菜单列表',
            type: 'array',
            items: {
              $ref: '#/components/schemas/SystemMenuTreeDto'
            }
          },
          ResponseSystemMenuListRespDto: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: {
                $ref: '#/components/schemas/SystemMenuListRespDto'
              }
            },
            required: ['code', 'message', 'data']
          }
        }
      }
    };

    const config: SwaggerConfig = {
      input: '',
      output: './temp',
      generator: 'typescript',
      groupByTags: false
    };

    const parser = new SwaggerParser(doc as any, config);
    const types = parser.parseTypes();

    // 找到各个类型
    const menuTreeType = types.find(t => t.name === 'SystemMenuTreeDto');
    const menuListType = types.find(t => t.name === 'SystemMenuListRespDto');
    const responseType = types.find(t => t.name === 'ResponseSystemMenuListRespDto');

    // SystemMenuTreeDto 应该是一个普通的 interface
    expect(menuTreeType?.definition).toContain('export interface SystemMenuTreeDto');
    
    // SystemMenuListRespDto 应该是一个类型别名,指向 SystemMenuTreeDto (不带 [])
    // 期望: export type SystemMenuListRespDto = SystemMenuTreeDto;
    // 而不是: export type SystemMenuListRespDto = SystemMenuTreeDto[];
    expect(menuListType?.definition).toContain('export type SystemMenuListRespDto');
    expect(menuListType?.definition).toContain('SystemMenuTreeDto');
    expect(menuListType?.definition).not.toMatch(/SystemMenuTreeDto\[\]/);

    // ResponseSystemMenuListRespDto 的 data 字段应该是 SystemMenuListRespDto[]
    expect(responseType?.definition).toContain('export interface ResponseSystemMenuListRespDto');
    expect(responseType?.definition).toContain('data: SystemMenuListRespDto[]');
  });

  test('should handle nested array references correctly', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0' },
      paths: {},
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' }
            }
          },
          UserList: {
            type: 'array',
            items: { $ref: '#/components/schemas/User' }
          },
          Response: {
            type: 'object',
            properties: {
              users: { $ref: '#/components/schemas/UserList' }
            }
          }
        }
      }
    };

    const config: SwaggerConfig = {
      input: '',
      output: './temp',
      generator: 'typescript',
      groupByTags: false
    };

    const parser = new SwaggerParser(doc as any, config);
    const types = parser.parseTypes();

    const userListType = types.find(t => t.name === 'UserList');
    const responseType = types.find(t => t.name === 'Response');

    // UserList 应该是类型别名,不带 []
    expect(userListType?.definition).toContain('export type UserList = User');
    expect(userListType?.definition).not.toMatch(/User\[\]/);

    // Response 的 users 字段应该是 UserList[]
    expect(responseType?.definition).toContain('users');
    expect(responseType?.definition).toContain('UserList[]');
  });
});
