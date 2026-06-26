import { generateApiComment, ApiCommentOperation, ApiCommentParameter } from '../src/utils/comment';

describe('generateApiComment', () => {
  test('只有 summary 时生成注释', () => {
    const result = generateApiComment({ summary: '获取用户列表' }, []);
    expect(result).toContain('获取用户列表');
    expect(result).not.toContain('@param');
  });

  test('summary + description 不同时同时输出', () => {
    const result = generateApiComment(
      { summary: '获取用户列表', description: '根据条件分页查询用户' },
      []
    );
    expect(result).toContain('获取用户列表');
    expect(result).toContain('根据条件分页查询用户');
  });

  test('summary 和 description 相同时只输出一次', () => {
    const result = generateApiComment(
      { summary: '获取用户列表', description: '获取用户列表' },
      []
    );
    const matches = result.match(/获取用户列表/g);
    expect(matches).toHaveLength(1);
  });

  test('有 query 参数时生成 @param params', () => {
    const params: ApiCommentParameter[] = [
      { in: 'query', description: '页码' }
    ];
    const result = generateApiComment({ summary: '搜索' }, params);
    expect(result).toContain('@param params 页码');
  });

  test('有 path 参数时生成 @param params', () => {
    const params: ApiCommentParameter[] = [
      { in: 'path', description: '用户ID' }
    ];
    const result = generateApiComment({ summary: '获取详情' }, params);
    expect(result).toContain('@param params 用户ID');
  });

  test('有 body 参数时生成 @param data', () => {
    const params: ApiCommentParameter[] = [
      { in: 'body', description: '用户信息' }
    ];
    const result = generateApiComment({ summary: '创建用户' }, params);
    expect(result).toContain('@param data 用户信息');
  });

  test('混合参数（query + path + body）同时输出', () => {
    const params: ApiCommentParameter[] = [
      { in: 'path', description: '用户ID' },
      { in: 'query', description: '详细信息' },
      { in: 'body', description: '更新数据' }
    ];
    const result = generateApiComment({ summary: '更新用户' }, params);
    expect(result).toContain('@param params 用户ID, 详细信息');
    expect(result).toContain('@param data 更新数据');
    expect(result).toContain('@param config');
  });

  test('deprecated 为 true 时添加 @deprecated', () => {
    const result = generateApiComment({ summary: '旧接口', deprecated: true }, []);
    expect(result).toContain('@deprecated');
  });

  test('deprecated 为 false 时不添加 @deprecated', () => {
    const result = generateApiComment({ summary: '接口', deprecated: false }, []);
    expect(result).not.toContain('@deprecated');
  });

  test('空参数列表时不生成 @param', () => {
    const result = generateApiComment({ summary: '无参数接口' }, []);
    expect(result).not.toContain('@param');
  });

  test('参数无 description 时使用默认提示', () => {
    const params: ApiCommentParameter[] = [
      { in: 'query' },
      { in: 'body' }
    ];
    const result = generateApiComment({ summary: '接口' }, params);
    expect(result).toContain('@param params 请求参数');
    expect(result).toContain('@param data 请求数据');
  });

  test('生成的注释以 /** 开头 */ 结尾', () => {
    const result = generateApiComment({ summary: '测试' }, []);
    expect(result.startsWith('/**')).toBe(true);
    expect(result.endsWith('*/')).toBe(true);
  });

  test('无 operation 时只生成空注释', () => {
    const result = generateApiComment({}, []);
    expect(result).toBe('/**\n */');
  });
});
