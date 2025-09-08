# Swagger2API

一个强大的 npm 工具包，用于从 Swagger JSON 文档生成前端接口代码。支持 TypeScript，按标签分组，详细注释生成等功能。

## 特性

- 🚀 **快速生成**: 从 Swagger JSON 快速生成 TypeScript 接口代码
- 📁 **按标签分组**: 支持按 Swagger 标签自动分组生成文件
- 📝 **详细注释**: 自动生成包含描述、参数、返回值的详细注释
- 🎨 **代码格式化**: 支持自定义 lint 命令，在代码生成完成后统一格式化
- ⚙️ **灵活配置**: 支持 `.swagger.config.ts` 配置文件
- 🔧 **CLI 工具**: 提供完整的命令行工具

## 安装

```bash
# 使用 pnpm（推荐）
pnpm add swagger2api

# 使用 npm
npm install swagger2api

# 使用 yarn
yarn add swagger2api
```

## 快速开始

### 1. 初始化配置文件

```bash
# 创建基础配置文件
npx swagger2api init
```

### 2. 配置 `.swagger.config.ts`

```typescript
const config = {
  // Swagger JSON 文件路径或 URL
  input: 'https://petstore.swagger.io/v2/swagger.json',
  
  // 输出目录
  output: './src/api',
  
  // request 导入路径模板
  importTemplate: "import { request } from '../../utils/request';",
  
  // 生成器类型
  generator: 'typescript',
  
  // 按标签分组生成文件
  groupByTags: true,
  
  // 代码格式化命令（可选）
  lint: 'npm run lint',
  
  // 生成选项
  options: {
    // 是否添加注释
    addComments: true
  }
};

module.exports = config;
```

### 3. 生成接口代码

```bash
# 使用配置文件生成
npx swagger2api generate

# 或者通过 npm script
npm run swagger:generate
```

## NPM 脚本

在 `package.json` 中添加以下脚本：

```json
{
  "scripts": {
    "swagger:generate": "npx swagger2api generate",
    "swagger:run": "npx swagger2api run",
    "swagger:init": "npx swagger2api init",
    "swagger:validate": "npx swagger2api validate"
  }
}
```

## CLI 命令

### `swagger2api run`

运行 `.swagger.config.ts` 配置文件生成接口代码：

```bash
# 使用默认配置文件
swagger2api run

# 指定配置文件
swagger2api run -c ./custom.swagger.config.ts
```

### `swagger2api generate`

使用配置文件生成接口代码：

```bash
# 使用默认配置文件 (.swagger.config.ts)
swagger2api generate

# 或者通过 npm script
npm run swagger:generate
```

### `swagger2api init`

初始化配置文件：

```bash
# 创建基础配置
swagger2api init

# 创建示例配置
swagger2api init --example

# 指定输出路径
swagger2api init -o ./config/swagger.config.ts
```

### `swagger2api validate`

验证 Swagger 文档：

```bash
# 验证文件
swagger2api validate -i ./swagger.json

# 使用配置文件验证
swagger2api validate -c ./.swagger.config.ts
```

## 配置选项

### 配置文件结构

```typescript
interface SwaggerConfig {
  // 必需配置
  input: string;                    // Swagger JSON 文件路径或 URL
  output: string;                   // 输出目录
  
  // 可选配置
  generator?: 'typescript' | 'javascript';  // 生成器类型，默认 'typescript'
  groupByTags?: boolean;            // 是否按标签分组，默认 false
  overwrite?: boolean;              // 是否覆盖更新，默认 true
  importTemplate?: string;          // request 导入路径模板
  lint?: string;                    // 代码格式化命令（如：'npm run lint'）
  
  // 生成选项
  options?: {
    addComments?: boolean;          // 添加注释，默认 true
  };
}
```

### 配置说明

- **input**: Swagger JSON 文件的路径或 URL
- **output**: 生成代码的输出目录
- **generator**: 代码生成器类型，目前支持 'typescript'
- **groupByTags**: 是否按 Swagger 标签分组生成文件到不同文件夹
- **overwrite**: 是否覆盖更新，默认为 true。为 true 时会先删除输出目录下的所有文件再重新生成，为 false 时采用增量更新模式
- **prefix**: 接口路径公共前缀，默认为空字符串。如果配置了此项，生成的所有接口前面都会添加这个前缀
- **importTemplate**: 自定义 request 函数的导入语句模板
- **lint**: 可选的代码格式化命令，在所有文件生成完成后执行
- **options.addComments**: 是否在生成的代码中添加详细注释

## 代码格式化 (Lint)

工具支持在所有文件生成完成后执行自定义的代码格式化命令。

### 配置 Lint

在 `.swagger.config.ts` 中配置 `lint` 字段：

```typescript
const config = {
  // ... 其他配置
  
  // 代码格式化命令
  lint: 'npm run lint',  // 或者 'prettier --write' 等
};
```

### Lint 执行时机

- **执行时机**: 在所有文件生成完成后统一执行
- **作用范围**: 对整个输出目录执行格式化
- **可选配置**: 如果不配置 `lint` 字段，则不会执行任何格式化命令

### 常用 Lint 命令示例

```typescript
// 使用 Prettier
lint: 'prettier --write'

// 使用 ESLint 修复
lint: 'eslint --fix'

// 使用项目的 npm script
lint: 'npm run lint'
lint: 'npm run format'

// 使用 pnpm
lint: 'pnpm run lint'
```

### 注意事项

- Lint 命令会在生成的输出目录中执行
- 请确保项目中已安装相应的格式化工具
- 如果 lint 命令执行失败，会显示错误信息但不会中断生成流程

## 生成的文件结构

### 不分组模式 (groupByTags: false)

```
src/api/
├── types.ts       # 数据类型定义
├── api.ts         # 所有 API 接口
└── index.ts       # 入口文件
```

### 按标签分组模式 (groupByTags: true)

```
src/api/
├── types.ts           # 数据类型定义
├── authcontroller/    # Auth 相关接口
│   └── index.ts
├── usercontroller/    # User 相关接口
│   └── index.ts
├── menucontroller/    # Menu 相关接口
│   └── index.ts
└── index.ts          # 入口文件（导出所有模块）
```

## 生成的代码示例

### 数据类型定义 (types.ts)

```typescript
/**
 * API 类型定义
 * 此文件由 swagger2api 自动生成，请勿手动修改
 */
export interface LoginDto {
 /** 账号 */
  account: string;
 /** 密码 */
  password: string;
}

export interface UserInfoRespDto {
 /** 用户ID */
  id: string;
 /** 用户名 */
  username: string;
 /** 角色 */
  roles: string[];
}

export interface LoginRespDto {
 /** 用户信息 */
  user: any;
 /** token */
  token: string;
}
```

### API 接口文件 (authcontroller/index.ts)

```typescript
/**
 * AuthController API 接口
 * 此文件由 swagger2api 自动生成，请勿手动修改
 */

import { request } from '../../utils/request';;
import type { LoginDto, LoginRespDto } from '../types';

/**
 * 登录
 *
 * @param data 登录参数
 * @param config 请求配置
 */
export const authControllerLogin = (data: LoginDto, config?: any) => {
  return request.post<LoginRespDto>({
    url: '/admin/auth/login',
    data,
    ...config
  });
}
```

### 入口文件 (index.ts)

```typescript
/**
 * API 入口文件
 * 此文件由 swagger2api 自动生成，请勿手动修改
 */

export * from './types';
export * from './authcontroller';
export * from './usercontroller';
export * from './menucontroller';
```

## 使用示例

### 基础配置示例

```typescript
// .swagger.config.ts
const config = {
  input: 'http://localhost:3000/api/docs/json',
  output: './src/api',
  generator: 'typescript',
  groupByTags: false,
  overwrite: true,
  prefix: '',
  options: {
    addComments: true
  }
};

module.exports = config;
```

### 完整配置示例

```typescript
// .swagger.config.ts
const config = {
  input: 'https://petstore.swagger.io/v2/swagger.json',
  output: './src/api',
  importTemplate: "import { request } from '../utils/request';",
  generator: 'typescript',
  groupByTags: true,
  overwrite: true,
  prefix: '/api',
  lint: 'prettier --write',
  options: {
    addComments: true
  }
};

module.exports = config;
```

## 技术栈

- **TypeScript** - 类型安全的 JavaScript
- **Commander.js** - 命令行工具框架
- **Prettier** - 代码格式化
- **Axios** - HTTP 客户端（生成的代码中使用）

## 测试

项目包含完整的测试套件，包括单元测试和集成测试。

### 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并监听文件变化
npm run test:watch

# 运行测试并生成覆盖率报告
npm run test:coverage

# CI环境下运行测试
npm run test:ci
```

### 测试结构

```
test/
├── config.test.ts          # 配置管理测试
├── typescript-generator.test.ts  # TypeScript生成器测试
├── cli.test.ts             # CLI功能测试
├── integration.test.ts     # 集成测试
└── setup.ts               # 测试环境设置
```

### 测试覆盖率

项目要求测试覆盖率达到80%以上，包括：
- 分支覆盖率: 80%
- 函数覆盖率: 80%
- 行覆盖率: 80%
- 语句覆盖率: 80%

## 开发与贡献

### 开发环境设置

```bash
# 克隆项目
git clone <repository-url>
cd swagger2api

# 安装依赖
npm install

# 构建项目
npm run build

# 运行测试
npm test

# 启动开发模式（监听文件变化）
npm run test:watch
```

### 代码质量

项目使用以下工具确保代码质量：

- **TypeScript**: 类型安全
- **Prettier**: 代码格式化
- **Jest**: 测试框架
- **ESLint**: 代码规范（推荐）

### 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 编写测试用例
4. 确保所有测试通过 (`npm test`)
5. 确保代码格式正确 (`npm run format`)
6. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
7. 推送到分支 (`git push origin feature/AmazingFeature`)
8. 打开 Pull Request

### 发布流程

```bash
# 构建项目
npm run build

# 运行所有测试
npm run test:ci

# 发布到npm（需要权限）
npm publish
```

## 许可证

MIT License - 查看 [LICENSE](LICENSE) 文件了解详情。