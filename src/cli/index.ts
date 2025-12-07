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
  .option('-c, --config <path>', '配置文件路径', '.swagger.config.ts')
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
    const configPath = path.resolve(process.cwd(), '.swagger.config.ts');

    if (fs.existsSync(configPath) && !options.force) {
      console.error('❌ 配置文件已存在，使用 --force 参数强制覆盖');
      process.exit(1);
    }

    // 检测当前项目的模块类型
    let isESModule = true; // 默认使用 ES Module
    const packageJsonPath = path.resolve(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, 'utf-8')
        );
        // 只有明确设置为 commonjs 时才使用 CommonJS，否则默认使用 ES Module
        isESModule = packageJson.type !== 'commonjs';
      } catch (error) {
        console.warn('⚠️ 无法读取package.json，使用默认ES Module格式');
      }
    }

    const configContent = `/**
 * Swagger2API 配置文件
 * 用于配置从 Swagger JSON 生成前端接口的参数
 */
const config = {
  // Swagger JSON 文件路径或 URL
  input: 'http://localhost:3000/admin/docs/json',
  
  // 输出目录
  output: './src/api',
  
  // request 导入路径模板
  importTemplate: "import { request } from '@/utils/request';",
  
  // 生成器类型
  generator: 'typescript', // 可选 'javascript'（JS 模式输出 .js 文件且不生成类型文件）
  
  // 请求调用风格：'method' 使用 request.get/post；'generic' 使用 request({ method })
  requestStyle: 'generic',
  
  // 按标签分组生成文件
  groupByTags: true,
  
  // 是否覆盖更新，默认为true。为true时会先删除输出目录下的所有文件
  overwrite: true,
  
  // 接口路径公共前缀，默认为空字符串
  prefix: '',
  
  // 代码格式化命令（可选）
  lint: 'prettier --write',
  
  // 生成方法名时需要忽略的前缀（可选）
  // 例如：配置 ['api', 'auth'] 后，apiGetName 会变成 getName，authUserInfo 会变成 userInfo
  // 如果方法名是 apiAuthGetName，会依次移除所有匹配的前缀，最终变成 getName
  methodNameIgnorePrefix: [],
  
  // 是否在生成的方法名中添加 HTTP method 后缀，默认为 true
  // true: userListPost, userDetailGet
  // false: userList, userDetail
  addMethodSuffix: true,
  
  // 生成选项
  options: {
    // 是否添加注释
    addComments: true
  }
};

${isESModule ? 'export default config;' : 'module.exports = config;'}
`;

    try {
      fs.writeFileSync(configPath, configContent, 'utf-8');
      console.log('✅ 配置文件已创建:', configPath);
      console.log('💡 请根据需要修改配置文件，然后运行 swagger2api generate');
    } catch (error) {
      console.error('❌ 创建配置文件失败:', error);
      process.exit(1);
    }
  });

// validate 命令
program
  .command('validate')
  .description('验证配置文件')
  .option('-c, --config <path>', '配置文件路径', '.swagger.config.ts')
  .action(async (options) => {
    const configPath = path.resolve(process.cwd(), options.config);

    try {
      const configModule = await import(configPath);
      const config: SwaggerConfig = configModule.default || configModule;

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
      console.error('❌ 配置文件验证失败:', error);
      process.exit(1);
    }
  });

// run 命令（别名，兼容性）
program
  .command('run')
  .description('运行生成器（generate 命令的别名）')
  .option('-c, --config <path>', '配置文件路径', '.swagger.config.ts')
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
