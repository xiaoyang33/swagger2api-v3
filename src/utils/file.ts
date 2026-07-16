import * as fs from 'fs';
import * as path from 'path';
import OpenAPIParser = require('@apidevtools/swagger-parser');
import { SwaggerDocument } from '../types';
import { logger } from './logger';

/**
 * 确保目录存在，如果不存在则创建
 * @param dirPath 目录路径
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 删除目录及其所有内容
 * @param dirPath 目录路径
 */
export function removeDirectory(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * 判断目标路径是否严格位于父路径内部
 * @param parentPath 父路径
 * @param targetPath 目标路径
 * @returns 目标路径是否位于父路径内部
 */
export function isPathInside(parentPath: string, targetPath: string): boolean {
  const relativePath = path.relative(
    path.resolve(parentPath),
    path.resolve(targetPath)
  );

  return (
    relativePath !== '' &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}

/**
 * 读取并打包 OpenAPI 3.0 文档
 * @param input 文件路径或 URL
 * @returns OpenAPI 文档对象
 */
export async function loadSwaggerDocument(
  input: string
): Promise<SwaggerDocument> {
  try {
    const isRemoteInput = /^https?:\/\//i.test(input);
    const resolveOptions = isRemoteInput
      ? {
          file: false,
          http: {
            timeout: 15000,
            safeUrlResolver: false
          }
        }
      : {
          http: {
            timeout: 15000,
            safeUrlResolver: false
          }
        };
    const data = (await OpenAPIParser.bundle(input, {
      resolve: resolveOptions
    })) as SwaggerDocument;

    if (isRemoteInput) {
      logger.debug(`从 URL 加载: ${input}`);
    } else {
      logger.debug(`从文件加载: ${path.resolve(input)}`);
    }

    if (data.components?.schemas) {
      logger.debugKV(
        'schemas 数量',
        Object.keys(data.components.schemas).length
      );
    } else {
      logger.debug('加载的数据中未发现 schemas');
    }

    return data;
  } catch (error) {
    throw new Error(`Failed to load OpenAPI document from ${input}: ${error}`);
  }
}

/**
 * 写入文件
 * @param filePath 文件路径
 * @param content 文件内容
 */
export function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  ensureDirectoryExists(dir);
  fs.writeFileSync(filePath, content, 'utf-8');
}
