import * as fs from 'fs';
import * as path from 'path';

/**
 * 创建临时 OpenAPI JSON 文件并返回路径
 * @returns 临时文件绝对路径
 */
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

/**
 * 确保临时目录存在
 * @param subdir 子目录名
 * @returns 临时目录绝对路径
 */
export function ensureProjectTemp(subdir: string = 'fixtures'): string {
  const base = path.resolve(__dirname, '../temp');
  const dir = path.resolve(base, subdir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * 生成完整的 OpenAPI 3.0 测试文档
 *
 * 覆盖场景：
 * - 所有 HTTP 方法（GET / POST / PUT / DELETE / PATCH）
 * - 路径参数、查询参数、请求体
 * - 有 / 无 operationId
 * - 多标签 API
 * - deprecated 操作
 * - allOf 泛型响应容器、直接 $ref 响应、数组响应、204 No Content
 * - $ref 引用（parameters、requestBody、schemas）
 * - 多种 schema 类型：object、array、string enum、numeric enum、nullable、oneOf、anyOf、additionalProperties
 * - Server URL 变量替换
 */
export function getSampleDoc() {
  return {
    openapi: '3.0.0',
    info: { title: 'template-admin', version: '1.0' },
    servers: [
      {
        url: 'https://{env}.api.example.com/{version}',
        variables: {
          env: { default: 'dev' },
          version: { default: 'v1' }
        }
      }
    ],
    tags: [
      { name: 'AuthController', description: '认证管理' },
      { name: 'UserController', description: '用户管理' },
      { name: 'RoleController', description: '角色管理' },
      { name: 'MenuController', description: '菜单管理' },
      { name: 'FileController', description: '文件管理' }
    ],
    paths: {
      // ─── POST /admin/auth/login ─── 有 operationId、requestBody、allOf 响应
      '/admin/auth/login': {
        post: {
          operationId: 'AuthController_login',
          tags: ['AuthController'],
          summary: '登录',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginDto' }
              }
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
          }
        }
      },

      // ─── POST /admin/system/user/list ─── 分页查询（requestBody）
      '/admin/system/user/list': {
        post: {
          operationId: 'UserController_list',
          tags: ['UserController'],
          summary: '用户列表',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserListDto' }
              }
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
                      {
                        properties: {
                          data: {
                            $ref: '#/components/schemas/UserListRespDto'
                          }
                        }
                      }
                    ]
                  }
                }
              }
            }
          }
        }
      },

      // ─── /admin/system/user/{id} ─── GET / PUT / DELETE（路径参数）
      '/admin/system/user/{id}': {
        parameters: [
          { $ref: '#/components/parameters/UserIdParam' }
        ],
        get: {
          tags: ['UserController'],
          summary: '获取用户详情',
          responses: {
            200: {
              description: 'ok',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ResOp' },
                      {
                        properties: {
                          data: {
                            $ref: '#/components/schemas/UserDetailRespDto'
                          }
                        }
                      }
                    ]
                  }
                }
              }
            }
          }
        },
        put: {
          operationId: 'UserController_update',
          tags: ['UserController'],
          summary: '更新用户',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserUpdateDto' }
              }
            }
          },
          responses: {
            200: {
              description: 'ok',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ResOp' }
                }
              }
            }
          }
        },
        delete: {
          operationId: 'UserController_delete',
          tags: ['UserController'],
          summary: '删除用户',
          responses: {
            204: {
              description: 'No Content'
            }
          }
        }
      },

      // ─── GET /admin/system/users ─── 查询参数（分页 + 关键字）
      '/admin/system/users': {
        get: {
          operationId: 'UserController_search',
          tags: ['UserController'],
          summary: '搜索用户',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'pageSize', in: 'query', required: true, schema: { type: 'integer' } },
            { name: 'keyword', in: 'query', schema: { type: 'string' } }
          ],
          responses: {
            200: {
              description: 'ok',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ResOp' },
                      {
                        properties: {
                          data: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/UserDetailRespDto' }
                          }
                        }
                      }
                    ]
                  }
                }
              }
            }
          }
        }
      },

      // ─── PATCH /admin/system/user/{id}/status ─── PATCH 方法
      '/admin/system/user/{id}/status': {
        patch: {
          operationId: 'UserController_updateStatus',
          tags: ['UserController'],
          summary: '更新用户状态',
          parameters: [
            {
              $ref: '#/components/parameters/UserIdParam'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { $ref: '#/components/schemas/StatusEnum' }
                  },
                  required: ['status']
                }
              }
            }
          },
          responses: {
            200: {
              description: 'ok',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ResOp' }
                }
              }
            }
          }
        }
      },

      // ─── POST /admin/system/menus/menuList ─── 无 requestBody 的 POST
      '/admin/system/menus/menuList': {
        post: {
          operationId: 'MenuController_menuList',
          tags: ['MenuController'],
          summary: '菜单列表',
          responses: {
            200: {
              description: 'ok',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ResOp' },
                      {
                        properties: {
                          data: {
                            $ref: '#/components/schemas/MenuListRespDto'
                          }
                        }
                      }
                    ]
                  }
                }
              }
            }
          }
        }
      },

      // ─── POST /admin/system/role/list ───
      '/admin/system/role/list': {
        post: {
          operationId: 'RoleController_list',
          tags: ['RoleController'],
          summary: '获取角色列表',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RoleListDto' }
              }
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
                      {
                        properties: {
                          data: {
                            $ref: '#/components/schemas/RoleListResDto'
                          }
                        }
                      }
                    ]
                  }
                }
              }
            }
          }
        }
      },

      // ─── POST /admin/file/upload ─── multipart/form-data、$ref requestBody
      '/admin/file/upload': {
        post: {
          operationId: 'FileController_upload',
          tags: ['FileController'],
          summary: '上传文件',
          requestBody: {
            $ref: '#/components/requestBodies/UploadBody'
          },
          responses: {
            200: {
              description: 'ok',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ResOp' },
                      {
                        properties: {
                          data: {
                            type: 'object',
                            properties: {
                              url: { type: 'string' }
                            }
                          }
                        }
                      }
                    ]
                  }
                }
              }
            }
          }
        }
      },

      // ─── GET /admin/system/config ─── deprecated、直接 $ref 响应、多标签
      '/admin/system/config': {
        get: {
          operationId: 'SystemController_getConfig',
          tags: ['SystemController'],
          summary: '获取系统配置',
          deprecated: true,
          responses: {
            200: {
              description: 'ok',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ResOp' },
                      {
                        properties: {
                          data: {
                            $ref: '#/components/schemas/SystemConfigDto'
                          }
                        }
                      }
                    ]
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      // ─── 可复用参数 ───
      parameters: {
        UserIdParam: {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: '用户ID'
        }
      },

      // ─── 可复用请求体 ───
      requestBodies: {
        UploadBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary' }
                },
                required: ['file']
              }
            }
          }
        }
      },

      // ─── Schema 定义 ───
      schemas: {
        // 通用响应容器
        ResOp: {
          type: 'object',
          required: ['data'],
          properties: {
            code: { type: 'integer' },
            message: { type: 'string' },
            data: { type: 'object' }
          }
        },

        // ─── 认证相关 ───
        LoginDto: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string' },
            password: { type: 'string' }
          }
        },
        LoginRespDto: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            expiresIn: { type: 'integer' }
          }
        },

        // ─── 用户相关 ───
        UserListDto: {
          type: 'object',
          properties: {
            page: { type: 'integer', default: 1 },
            pageSize: { type: 'integer', default: 10 },
            keyword: { type: 'string' }
          }
        },
        UserListRespDto: {
          type: 'object',
          properties: {
            list: {
              type: 'array',
              items: { $ref: '#/components/schemas/UserDetailRespDto' }
            },
            total: { type: 'integer' }
          }
        },
        UserDetailRespDto: {
          type: 'object',
          required: ['id', 'username'],
          properties: {
            id: { type: 'string' },
            username: { type: 'string' },
            email: { type: 'string', nullable: true },
            age: { type: 'integer' },
            gender: { $ref: '#/components/schemas/GenderEnum' },
            status: { $ref: '#/components/schemas/StatusEnum' },
            role: { $ref: '#/components/schemas/RoleDto' },
            tags: {
              type: 'array',
              items: { type: 'string' }
            },
            metadata: {
              type: 'object',
              additionalProperties: { type: 'string' }
            },
            nickname: {
              anyOf: [{ type: 'string' }, { type: 'null' }]
            },
            remark: {
              oneOf: [{ type: 'string' }, { type: 'number' }],
              nullable: true
            }
          }
        },
        UserUpdateDto: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            email: { type: 'string' },
            gender: { $ref: '#/components/schemas/GenderEnum' }
          }
        },

        // ─── 枚举类型 ───
        StatusEnum: {
          type: 'string',
          enum: ['active', 'inactive', 'banned'],
          'x-enum-varnames': ['ACTIVE', 'INACTIVE', 'BANNED']
        },
        GenderEnum: {
          type: 'integer',
          enum: [0, 1, 2]
        },

        // ─── 角色相关 ───
        RoleListDto: { type: 'object' },
        RoleListResDto: { type: 'object' },
        RoleDto: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            permissions: {
              type: 'array',
              items: { $ref: '#/components/schemas/PermissionDto' }
            }
          }
        },

        // ─── 菜单相关 ───
        MenuListRespDto: {
          type: 'array',
          items: { $ref: '#/components/schemas/MenuTreeDto' }
        },
        MenuTreeDto: {
          type: 'object',
          required: ['id', 'title'],
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            children: {
              type: 'array',
              items: { $ref: '#/components/schemas/MenuTreeDto' }
            }
          }
        },

        // ─── 权限相关 ───
        PermissionDto: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            description: { type: 'string' }
          }
        },

        // ─── 系统配置 ───
        SystemConfigDto: {
          type: 'object',
          properties: {
            appName: { type: 'string' },
            version: { type: 'string' },
            features: {
              type: 'object',
              additionalProperties: { type: 'boolean' }
            }
          }
        }
      }
    }
  } as any;
}
