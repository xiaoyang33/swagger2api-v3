import { SwaggerParameter } from '../types';

/**
 * 生成接口注释
 * @param operation Swagger操作对象
 * @param parameters 参数列表
 * @returns 注释字符串
 */
export function generateApiComment(
  operation: any,
  parameters: SwaggerParameter[]
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

      if (hasParams) {
        const paramDescriptions = [...pathParams, ...queryParams]
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
