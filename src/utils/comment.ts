import { ParameterInfo } from '../types';

/**
 * 注释生成需要的操作信息
 */
export interface ApiCommentOperation {
  /** 接口摘要 */
  summary?: string;
  /** 接口描述 */
  description?: string;
  /** 是否废弃 */
  deprecated?: boolean;
}

/**
 * 注释生成需要的参数信息
 */
export type ApiCommentParameter = Pick<ParameterInfo, 'in' | 'description'> & {
  /** 生成后的函数参数名 */
  name?: string;
};

/**
 * 生成接口注释
 * @param operation 接口操作信息
 * @param parameters 参数列表
 * @returns 注释字符串
 */
export function generateApiComment(
  operation: ApiCommentOperation,
  parameters: ApiCommentParameter[]
): string {
  const comments: string[] = ['/**'];

  if (operation.summary) {
    comments.push(` * ${operation.summary}`);
  }

  if (operation.description && operation.description !== operation.summary) {
    comments.push(` * ${operation.description}`);
  }

  if (parameters && parameters.length > 0) {
    const queryParams = parameters.filter((param) => param.in === 'query');
    const pathParams = parameters.filter((param) => param.in === 'path');
    const bodyParams = parameters.filter((param) => param.in === 'body');
    const hasParams = queryParams.length > 0 || pathParams.length > 0;
    const hasData = bodyParams.length > 0;

    if (hasParams || hasData) {
      comments.push(' *');

      pathParams.forEach((param, index) => {
        const name = param.name || `pathParam${index + 1}`;
        comments.push(` * @param ${name} ${param.description || '路径参数'}`);
      });

      if (queryParams.length > 0) {
        const paramDescriptions = queryParams
          .map((param) => param.description || '')
          .filter((description) => description)
          .join(', ');
        const description = paramDescriptions || '请求参数';
        comments.push(` * @param params ${description}`);
      }

      if (hasData) {
        const dataParam = bodyParams[0];
        const description = dataParam?.description || '请求数据';
        comments.push(` * @param data ${description}`);
      }

      comments.push(` * @param config 可选的请求配置`);
    }
  }

  if (operation.deprecated) {
    comments.push(' * @deprecated');
  }

  comments.push(' */');

  return comments.join('\n');
}
