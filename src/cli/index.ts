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

    if (fs.existsSync(configPath) && !options.force) {
      console.error('❌ 配置文件已存在，使用 --force 参数强制覆盖');
      process.exit(1);
    }

    const config = {
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

    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log('✅ 配置文件已创建:', configPath);
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

      const { Swagger2API } = await import('../index');
      const swagger2api = new Swagger2API(config);

      if (swagger2api.validateConfig()) {
        console.log('✅ 配置文件验证通过');

        // 尝试加载 Swagger 文档
        try {
          const { loadSwaggerDocument } = await import('../utils');
          const document = await loadSwaggerDocument(config.input);
          console.log(
            `✅ Swagger 文档加载成功: ${document.info.title} v${document.info.version}`
          );
        } catch (error) {
          console.warn('⚠️  Swagger 文档加载失败:', error);
        }
      } else {
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

// run 命令（别名，兼容性）
program
  .command('run')
  .description('运行生成器（generate 命令的别名）')
  .option('-c, --config <path>', '配置文件路径', '.swagger.config.json')
  .action(async (options) => {
    try {
      await generateFromConfig(options.config);
    } catch (error) {
      console.error('❌ 生成失败:', error);
      process.exit(1);
    }
  });

// 解析命令行参数
program.parse();

// 如果没有提供命令，显示帮助信息
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
