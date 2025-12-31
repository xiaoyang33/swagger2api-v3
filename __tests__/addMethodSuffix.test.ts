import { SwaggerParser } from '../src/core/parser';
import { SwaggerConfig } from '../src/types';
import { removeMethodSuffix } from '../src/utils';

describe('addMethodSuffix configuration', () => {
  const baseDoc = {
    openapi: '3.0.0',
    info: { title: 'Test API', version: '1.0' },
    paths: {
      '/users': {
        get: {
          operationId: 'getUsers',
          tags: ['User'],
          responses: {
            200: {
              description: 'Success',
              content: {
                'application/json': {
                  schema: { type: 'array', items: { type: 'object' } }
                }
              }
            }
          }
        },
        post: {
          operationId: 'createUser',
          tags: ['User'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object' }
              }
            }
          },
          responses: {
            201: {
              description: 'Created',
              content: {
                'application/json': {
                  schema: { type: 'object' }
                }
              }
            }
          }
        }
      },
      '/users/{id}': {
        get: {
          tags: ['User'],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Success',
              content: {
                'application/json': {
                  schema: { type: 'object' }
                }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {}
    }
  };

  test('should add method suffix when addMethodSuffix is true', () => {
    const config: SwaggerConfig = {
      input: '',
      output: './temp',
      generator: 'typescript',
      groupByTags: false,
      addMethodSuffix: true
    };

    const parser = new SwaggerParser(baseDoc as any, config);
    const apis = parser.parseApis();

    const getUsersApi = apis.find(
      (api) => api.path === '/users' && api.method === 'GET'
    );
    const createUserApi = apis.find(
      (api) => api.path === '/users' && api.method === 'POST'
    );
    const getUserByIdApi = apis.find(
      (api) => api.path === '/users/{id}' && api.method === 'GET'
    );

    expect(getUsersApi?.name).toBe('getUsersGet');
    expect(createUserApi?.name).toBe('createUserPost');
    expect(getUserByIdApi?.name).toBe('usersIdGet');
  });

  test('should not add method suffix when addMethodSuffix is false', () => {
    const config: SwaggerConfig = {
      input: '',
      output: './temp',
      generator: 'typescript',
      groupByTags: false,
      addMethodSuffix: false
    };

    const parser = new SwaggerParser(baseDoc as any, config);
    const apis = parser.parseApis();

    const getUsersApi = apis.find(
      (api) => api.path === '/users' && api.method === 'GET'
    );
    const createUserApi = apis.find(
      (api) => api.path === '/users' && api.method === 'POST'
    );
    const getUserByIdApi = apis.find(
      (api) => api.path === '/users/{id}' && api.method === 'GET'
    );

    expect(getUsersApi?.name).toBe('getUsers');
    expect(createUserApi?.name).toBe('createUser');
    expect(getUserByIdApi?.name).toBe('usersId');
  });

  test('should default to true when addMethodSuffix is not specified', () => {
    const config: SwaggerConfig = {
      input: '',
      output: './temp',
      generator: 'typescript',
      groupByTags: false
      // addMethodSuffix not specified
    };

    const parser = new SwaggerParser(baseDoc as any, config);
    const apis = parser.parseApis();

    const getUsersApi = apis.find(
      (api) => api.path === '/users' && api.method === 'GET'
    );

    // Should default to true, so suffix should be added
    expect(getUsersApi?.name).toBe('getUsersGet');
  });

  test('removeMethodSuffix utility function', () => {
    expect(removeMethodSuffix('getUsersGet', 'get')).toBe('getUsers');
    expect(removeMethodSuffix('createUserPost', 'post')).toBe('createUser');
    expect(removeMethodSuffix('updateUserPut', 'put')).toBe('updateUser');
    expect(removeMethodSuffix('deleteUserDelete', 'delete')).toBe('deleteUser');
    expect(removeMethodSuffix('patchUserPatch', 'patch')).toBe('patchUser');

    // Should not remove if suffix doesn't match
    expect(removeMethodSuffix('getUsers', 'post')).toBe('getUsers');
    expect(removeMethodSuffix('someFunction', 'get')).toBe('someFunction');
  });

  test('should work with methodNameIgnorePrefix', () => {
    const config: SwaggerConfig = {
      input: '',
      output: './temp',
      generator: 'typescript',
      groupByTags: false,
      addMethodSuffix: false,
      methodNameIgnorePrefix: ['get', 'create']
    };

    const parser = new SwaggerParser(baseDoc as any, config);
    const apis = parser.parseApis();

    const getUsersApi = apis.find(
      (api) => api.path === '/users' && api.method === 'GET'
    );
    const createUserApi = apis.find(
      (api) => api.path === '/users' && api.method === 'POST'
    );

    // Prefix should be removed, and no method suffix
    expect(getUsersApi?.name).toBe('users');
    expect(createUserApi?.name).toBe('user');
  });
});
