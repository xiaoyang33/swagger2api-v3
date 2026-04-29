#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { generateFromConfig } from '../index';
import { SwaggerConfig } from '../types';

const program = new Command();

// 版本信息
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')
);

program
  .name('swagger2api-v3')
  .description('从 Swagger/OpenAPI 文档生成 TypeScript API 接口')
  .version(packageJson.version);

// generate 命令
program
  .command('generate')
  .alias('gen')
  .description('根据配置文件生成 API 接口')
  .option('-c, --config <path>', '配置文件路径', '.swagger.config.json')
  .option('-i, --input <path>', 'Swagger JSON 文件路径或 URL')
  .option('-o, --output <path>', '输出目录')
  .option('--no-types', '不生成类型文件')
  .option('--no-group', '不按标签分组')
  .action(async (options) => {
    try {
      if (options.input && options.output) {
        // 使用命令行参数直接生成
        const config: SwaggerConfig = {
          input: options.input,
          output: options.output,
          generator: 'typescript',
          groupByTags: options.group !== false,
          options: {
            generateModels: options.types !== false,
            generateApis: true,
            generateIndex: true,
            useAxios: true,
            addComments: true,
            prettify: true
          }
        };

        const { generate } = await import('../index');
        await generate(config);
      } else {
        // 使用配置文件生成
        await generateFromConfig(options.config);
      }
    } catch (error) {
      console.error('❌ 生成失败:', error);
      process.exit(1);
    }
  });

// init 命令
program
  .command('init')
  .description('初始化配置文件')
  .option('-f, --force', '强制覆盖已存在的配置文件')
  .action(async (options) => {
    const configPath = path.resolve(process.cwd(), '.swagger.config.json');

    try {
      const existsBeforeInit = fs.existsSync(configPath);
      const config = createInitConfig(configPath, options.force);
      const successMessage = getInitSuccessMessage(
        existsBeforeInit,
        options.force
      );
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log(successMessage, configPath);
      console.log(
        '💡 请根据需要修改配置文件，然后运行 swagger2api-v3 generate'
      );
    } catch (error) {
      console.error('❌ 创建配置文件失败:', error);
      process.exit(1);
    }
  });

// validate 命令
program
  .command('validate')
  .description('验证配置文件')
  .option('-c, --config <path>', '配置文件路径', '.swagger.config.json')
  .action(async (options) => {
    const configPath = path.resolve(process.cwd(), options.config);

    try {
      if (!fs.existsSync(configPath)) {
        console.error(`❌ 找不到配置文件: ${configPath}`);
        process.exit(1);
      }

      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config: SwaggerConfig = JSON.parse(configContent);

      const { validateSwaggerConfig } = await import('../config/validator');
      const errors = validateSwaggerConfig(config);

      if (errors.length === 0) {
        console.log('✅ 配置文件验证通过');
      } else {
        console.error('❌ 配置验证失败:');
        errors.forEach((error) => console.error(`   - ${error}`));
        process.exit(1);
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error(`❌ 配置文件 JSON 格式错误: ${configPath}`);
        console.error('错误详情:', error.message);
      } else {
        console.error('❌ 配置文件验证失败:', error);
      }
      process.exit(1);
    }
  });

// 解析命令行参数
program.parse();

// 如果没有提供命令，显示帮助信息
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

/**
 * 创建 init 命令需要写入的配置
 * @param configPath 配置文件路径
 * @param force 是否强制覆盖
 * @returns 初始化配置对象
 */
function createInitConfig(configPath: string, force?: boolean): SwaggerConfig {
  const defaultConfig = createDefaultConfig();

  if (!fs.existsSync(configPath) || force) {
    return defaultConfig;
  }

  const existingConfig = readExistingConfig(configPath);
  return mergeMissingConfig(existingConfig, defaultConfig);
}

/**
 * 创建默认配置对象
 * @returns 默认配置对象
 */
function createDefaultConfig(): SwaggerConfig {
  return {
    $schema: './node_modules/swagger2api-v3/dist/.swagger2api.schema.json',
    input: 'http://localhost:3000/admin/docs/json',
    output: './src/api',
    importTemplate: "import { request } from '@/utils/request';",
    generator: 'typescript',
    requestStyle: 'generic',
    groupByTags: true,
    overwrite: true,
    prefix: '',
    lint: 'prettier --write',
    methodNameIgnorePrefix: [],
    addMethodSuffix: true,
    headerComment: '',
    filter: {
      include: {
        tags: []
      },
      exclude: {
        tags: []
      }
    },
    options: {
      addComments: true
    }
  };
}

/**
 * 获取 init 命令成功提示
 * @param existsBeforeInit 执行 init 前配置文件是否存在
 * @param force 是否强制覆盖
 * @returns 成功提示文案
 */
function getInitSuccessMessage(
  existsBeforeInit: boolean,
  force?: boolean
): string {
  if (existsBeforeInit && force) {
    return '✅ 配置文件已覆盖:';
  }

  if (existsBeforeInit) {
    return '✅ 配置文件已补全:';
  }

  return '✅ 配置文件已创建:';
}

/**
 * 读取已存在的配置文件
 * @param configPath 配置文件路径
 * @returns 已存在的配置对象
 */
function readExistingConfig(configPath: string): SwaggerConfig {
  try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configContent);
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(`❌ 配置文件 JSON 格式错误: ${configPath}`);
      console.error('错误详情:', error.message);
    } else {
      console.error('❌ 读取配置文件失败:', error);
    }
    process.exit(1);
    throw error;
  }
}

/**
 * 合并缺失的配置字段，保留已有配置值
 * @param current 当前配置
 * @param defaults 默认配置
 * @returns 补全后的配置
 */
function mergeMissingConfig(current: any, defaults: any): any {
  const result = { ...current };

  for (const [key, value] of Object.entries(defaults)) {
    if (result[key] === undefined) {
      result[key] = value;
      continue;
    }

    if (isPlainObject(result[key]) && isPlainObject(value)) {
      result[key] = mergeMissingConfig(result[key], value);
    }
  }

  return result;
}

/**
 * 判断是否为普通对象
 * @param value 待判断的值
 * @returns 是否为普通对象
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
