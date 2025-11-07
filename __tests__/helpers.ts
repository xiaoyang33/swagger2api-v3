import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export function ensureProjectTemp(subdir: string = 'fixtures'): string {
  const base = path.resolve(__dirname, '../temp');
  const dir = path.resolve(base, subdir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function createSampleOpenAPIFile(): string {
  const tmp = ensureProjectTemp('fixtures');
  const file = path.join(
    tmp,
    `openapi-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  );
  const doc = getSampleDoc();
  fs.writeFileSync(file, JSON.stringify(doc, null, 2), 'utf-8');
  return file;
}

export function getSampleDoc() {
  return {
    openapi: '3.0.0',
    info: { title: 'template-admin', version: '1.0' },
    paths: {
      '/admin/auth/login': {
        post: {
          operationId: 'AuthController_login',
          tags: ['AuthController'],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/LoginDto' } }
            }
          },
          responses: {
            200: {
              description: 'ok',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ResOp' },
                      { properties: { data: { $ref: '#/components/schemas/LoginRespDto' } } }
                    ]
                  }
                }
              }
            }
          },
          summary: '登录'
        }
      },
      '/admin/system/user/list': {
        post: {
          operationId: 'UserController_list',
          tags: ['UserController'],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/UserListDto' } }
            }
          },
          responses: {
            200: {
              description: 'ok',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ResOp' },
                      { properties: { data: { $ref: '#/components/schemas/UserListRespDto' } } }
                    ]
                  }
                }
              }
            }
          },
          summary: '用户列表'
        }
      },
      '/admin/system/menus/menuList': {
        post: {
          operationId: 'MenuController_menuList',
          tags: ['MenuController'],
          responses: {
            200: {
              description: 'ok',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ResOp' },
                      { properties: { data: { $ref: '#/components/schemas/MenuListRespDto' } } }
                    ]
                  }
                }
              }
            }
          },
          summary: '菜单列表'
        }
      },
      '/admin/system/role/list': {
        post: {
          operationId: 'RoleController_list',
          tags: ['RoleController'],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/RoleListDto' } }
            }
          },
          responses: {
            200: {
              description: 'ok',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ResOp' },
                      { properties: { data: { $ref: '#/components/schemas/RoleListResDto' } } }
                    ]
                  }
                }
              }
            }
          },
          summary: '获取角色列表'
        }
      }
    },
    components: {
      schemas: {
        ResOp: {
          type: 'object',
          required: ['data'],
          properties: {
            code: { type: 'integer' },
            message: { type: 'string' },
            data: { type: 'object' }
          }
        },
        LoginDto: {
          type: 'object',
          properties: { username: { type: 'string' }, password: { type: 'string' } }
        },
        LoginRespDto: {
          type: 'object',
          properties: { token: { type: 'string' } }
        },
        UserListDto: { type: 'object' },
        UserListRespDto: { type: 'object' },
        MenuListRespDto: { type: 'object' },
        RoleListDto: { type: 'object' },
        RoleListResDto: { type: 'object' }
      }
    }
  } as any;
}