import { SwaggerParser } from '../src/core/parser';
import { SwaggerConfig } from '../src/types';

describe('Array type reference generation', () => {
  const config: SwaggerConfig = {
    input: '',
    output: './temp',
    generator: 'typescript',
    groupByTags: false
  };

  test('should generate array notation in the component type definition', () => {
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

    const parser = new SwaggerParser(doc as any, config);
    const types = parser.parseTypes();

    // 找到各个类型
    const menuTreeType = types.find((t) => t.name === 'SystemMenuTreeDto');
    const menuListType = types.find((t) => t.name === 'SystemMenuListRespDto');
    const responseType = types.find(
      (t) => t.name === 'ResponseSystemMenuListRespDto'
    );

    // SystemMenuTreeDto 应该是一个普通的 interface
    expect(menuTreeType?.definition).toContain(
      'export interface SystemMenuTreeDto'
    );

    // 数组组件自身应保留数组语义
    expect(menuListType?.definition).toContain(
      'export type SystemMenuListRespDto = SystemMenuTreeDto[];'
    );

    // 引用数组组件时直接使用组件别名
    expect(responseType?.definition).toContain(
      'export interface ResponseSystemMenuListRespDto'
    );
    expect(responseType?.definition).toContain('data: SystemMenuListRespDto');
    expect(responseType?.definition).not.toContain(
      'data: SystemMenuListRespDto[]'
    );
  });
});
