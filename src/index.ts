import * as path from 'path';
import { SwaggerConfig } from './types';
import { SwaggerParser } from './core/parser';
import { CodeGenerator } from './core/generator';
import { loadSwaggerDocument } from './utils';

/**
 * Swagger2API 主类
 */
export class Swagger2API {
  private config: SwaggerConfig;

  constructor(config: SwaggerConfig) {
    this.config = config;
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
      console.log(`✅ 成功加载文档: ${document.info.title} v${document.info.version}`);

      // 2. 解析文档
      console.log('🔍 解析API接口...');
      const parser = new SwaggerParser(document, this.config);
      const apis = parser.parseApis();
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
    const errors: string[] = [];

    if (!this.config.input) {
      errors.push('input 配置项不能为空');
    }

    if (!this.config.output) {
      errors.push('output 配置项不能为空');
    }

    if (this.config.generator !== 'typescript') {
      errors.push('目前只支持 typescript 生成器');
    }

    if (errors.length > 0) {
      console.error('❌ 配置验证失败:');
      errors.forEach(error => console.error(`   - ${error}`));
      return false;
    }

    return true;
  }
}

/**
 * 从配置文件生成API
 * @param configPath 配置文件路径
 */
export async function generateFromConfig(configPath?: string): Promise<void> {
  const configFile = configPath || '.swagger.config.ts';
  const fullPath = path.resolve(process.cwd(), configFile);
  
  try {
    // 动态导入配置文件
    const configModule = await import(fullPath);
    const config: SwaggerConfig = configModule.default || configModule;
    
    const swagger2api = new Swagger2API(config);
    
    if (!swagger2api.validateConfig()) {
      process.exit(1);
    }
    
    await swagger2api.generate();
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('Cannot resolve module')) {
      console.error(`❌ 找不到配置文件: ${fullPath}`);
      console.error('请确保配置文件存在并且路径正确');
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