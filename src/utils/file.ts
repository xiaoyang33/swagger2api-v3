import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { SwaggerDocument } from '../types';

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
 * 读取Swagger文档
 * @param input 文件路径或URL
 * @returns Swagger文档对象
 */
export async function loadSwaggerDocument(
  input: string
): Promise<SwaggerDocument> {
  try {
    if (input.startsWith('http://') || input.startsWith('https://')) {
      const { data } = await axios.get(input);
      console.log('Loaded from URL:', input);
      if (data.components?.schemas) {
        console.log('Schemas count:', Object.keys(data.components.schemas).length);
      } else {
        console.log('No schemas in loaded data');
      }
      return data;
    }

    const content = fs.readFileSync(input, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load Swagger document from ${input}: ${error}`);
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
