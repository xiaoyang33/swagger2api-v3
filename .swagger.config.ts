/**
 * Swagger2API 配置文件
 * 用于配置从 Swagger JSON 生成前端接口的参数
 */
const config = {
  // Swagger JSON 文件路径或 URL
  input: 'https://petstore.swagger.io/v2/swagger.json',
  
  // 输出目录
  output: './src/api',
  
  // request 导入路径模板
  importTemplate: "import { request } from '@/utils/request';",
  
  // 生成器类型
  generator: 'typescript',
  
  // 按标签分组生成文件
  groupByTags: true,
  
  // 是否覆盖更新，默认为true。为true时会先删除输出目录下的所有文件
  overwrite: true,
  
  // 接口路径公共前缀，默认为空字符串
  prefix: '',
  
  // 代码格式化命令（可选）
  lint: 'prettier --write',
  
  // 生成选项
  options: {
    // 是否添加注释
    addComments: true
  }
};

module.exports = config;
