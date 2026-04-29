import * as path from 'path';
import * as fs from 'fs';
import { ApiInfo, SwaggerConfig } from './types';
import { SwaggerParser } from './core/parser';
import { CodeGenerator } from './core/generator';
import { loadSwaggerDocument } from './utils';
import { validateSwaggerConfig } from './config/validator';

/**
 * Swagger2API 主类
 */
export class Swagger2API {
  private config: SwaggerConfig;

  constructor(config: SwaggerConfig) {
    // 规范化配置：设置默认值
    this.config = {
      ...config,
      // 默认请求风格为 generic
      requestStyle: config.requestStyle ?? 'generic'
    };
  }

  /**
   * 生成API接口文件
   */
  async generate(): Promise<void> {
    try {
      console.log('🚀 开始生成API接口文件...');

      // 1. 加载Swagger文档
      console.log('📖 加载Swagger文档...');
      const document = await loadSwaggerDocument(this.config.input);
      console.log(
        `✅ 成功加载文档: ${document.info.title} v${document.info.version}`
      );

      // 2. 解析文档
      console.log('🔍 解析API接口...');
      const parser = new SwaggerParser(document, this.config);
      const apis = this.filterApis(parser.parseApis());
      const types = parser.parseTypes();
      const groupedApis = parser.groupApisByTags(apis);

      console.log(`✅ 解析完成: ${apis.length} 个接口, ${types.length} 个类型`);

      if (this.config.groupByTags) {
        console.log(`📁 按标签分组: ${groupedApis.size} 个分组`);
        for (const [tag, tagApis] of groupedApis) {
          console.log(`   - ${tag}: ${tagApis.length} 个接口`);
        }
      }

      // 3. 生成代码
      console.log('⚡ 生成代码文件...');
      const generator = new CodeGenerator(this.config);
      await generator.generateAll(apis, types, groupedApis);

      console.log(`✅ 代码生成完成，输出目录: ${this.config.output}`);
    } catch (error) {
      console.error('❌ 生成失败:', error);
      throw error;
    }
  }

  /**
   * 验证配置
   */
  validateConfig(): boolean {
    const errors = validateSwaggerConfig(this.config);

    if (errors.length > 0) {
      console.error('❌ 配置验证失败:');
      errors.forEach((error) => console.error(`   - ${error}`));
      return false;
    }

    return true;
  }

  /**
   * 根据配置过滤 API
   * @param apis API接口数组
   * @returns 过滤后的 API接口数组
   */
  private filterApis(apis: ApiInfo[]): ApiInfo[] {
    const includeTags = this.config.filter?.include?.tags;
    const excludeTags = this.config.filter?.exclude?.tags;

    if (!includeTags?.length && !excludeTags?.length) {
      return apis;
    }

    return apis.filter((api) => {
      const tags = api.tags || [];
      const included =
        !includeTags?.length || tags.some((tag) => includeTags.includes(tag));
      const excluded =
        !!excludeTags?.length && tags.some((tag) => excludeTags.includes(tag));

      return included && !excluded;
    });
  }
}

/**
 * 从配置文件生成API
 * @param configPath 配置文件路径
 */
export async function generateFromConfig(configPath?: string): Promise<void> {
  const configFile = configPath || '.swagger.config.json';
  const fullPath = path.resolve(process.cwd(), configFile);

  try {
    let config: SwaggerConfig;

    // 读取并解析 JSON 配置文件
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ 找不到配置文件: ${fullPath}`);
      console.error('请确保配置文件存在并且路径正确');
      console.error('提示: 运行 swagger2api-v3 init 来创建配置文件');
      process.exit(1);
    }

    const configContent = fs.readFileSync(fullPath, 'utf-8');
    config = JSON.parse(configContent);

    const swagger2api = new Swagger2API(config);

    if (!swagger2api.validateConfig()) {
      process.exit(1);
    }

    await swagger2api.generate();
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(`❌ 配置文件 JSON 格式错误: ${fullPath}`);
      console.error('请检查 JSON 语法是否正确');
      console.error('错误详情:', error.message);
    } else {
      console.error('❌ 加载配置文件失败:', error);
    }
    process.exit(1);
  }
}

/**
 * 直接使用配置对象生成API
 * @param config 配置对象
 */
export async function generate(config: SwaggerConfig): Promise<void> {
  const swagger2api = new Swagger2API(config);

  if (!swagger2api.validateConfig()) {
    throw new Error('配置验证失败');
  }

  await swagger2api.generate();
}

// 导出类型和工具
export * from './types';
export { SwaggerParser } from './core/parser';
export { CodeGenerator } from './core/generator';
export * from './utils';
