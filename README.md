# Swagger2API-v3

一个强大的命令行工具，用于从 Swagger/OpenAPI 文档自动生成 TypeScript 接口代码。

## ✨ 特性

- 🚀 **快速生成** - 从 Swagger JSON 快速生成 TypeScript 接口代码
- 📁 **智能分组** - 支持按 Swagger 标签自动分组生成文件
- 📝 **详细注释** - 自动生成包含描述、参数、返回值的详细注释
- 🎨 **代码格式化** - 支持自定义格式化命令
- ⚙️ **环境适配** - 自动检测项目环境，生成对应格式的配置文件
- 🔧 **CLI 工具** - 提供完整的命令行工具

## 📦 安装

```bash
# 全局安装
npm install -g swagger2api-v3

# 项目依赖
npm install swagger2api-v3
```

## 🚀 快速开始

### 1. 初始化配置文件

```bash
swagger2api-v3 init
```

### 2. 配置文件说明

工具会根据项目环境自动生成对应格式的配置文件：

**CommonJS 环境** (`"type": "commonjs"` 或未设置)：
```javascript
const config = {
  input: 'https://petstore.swagger.io/v2/swagger.json',
  output: './src/api',
  importTemplate: "import { request } from '@/utils/request';",
  generator: 'typescript',
  groupByTags: true,
  overwrite: true,
  prefix: '',
  lint: 'prettier --write',
  options: {
    addComments: true
  }
};

module.exports = config;
```

**ES 模块环境** (`"type": "module"`)：
```javascript
const config = {
  // ... 相同配置
};

export default config;
```

### 3. 生成接口代码

```bash
swagger2api-v3 generate
```

## ⚙️ 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `input` | string | - | Swagger JSON 文件路径或 URL |
| `output` | string | `'./src/api'` | 生成代码的输出目录 |
| `generator` | string | `'typescript'` | 代码生成器类型 |
| `groupByTags` | boolean | `true` | 是否按标签分组生成文件 |
| `overwrite` | boolean | `true` | 是否覆盖已存在的文件 |
| `prefix` | string | `''` | 接口路径公共前缀 |
| `importTemplate` | string | - | request 函数导入语句模板 |
| `lint` | string | - | 代码格式化命令（可选） |
| `options.addComments` | boolean | `true` | 是否添加详细注释 |

## 📁 生成的文件结构

### 按标签分组 (推荐)

```
src/api/
├── types.ts           # 数据类型定义
├── user/              # User 相关接口
│   └── index.ts
├── auth/              # Auth 相关接口
│   └── index.ts
└── index.ts          # 入口文件
```

### 不分组

```
src/api/
├── types.ts       # 数据类型定义
├── api.ts         # 所有 API 接口
└── index.ts       # 入口文件
```

## 💡 使用示例

### 生成的类型定义

```typescript
// types.ts
export interface LoginDto {
  /** 账号 */
  account: string;
  /** 密码 */
  password: string;
}

export interface UserInfo {
  /** 用户ID */
  id: string;
  /** 用户名 */
  username: string;
}
```

### 生成的 API 接口

```typescript
// auth/index.ts
import { request } from '@/utils/request';
import type { LoginDto, UserInfo } from '../types';

/**
 * 用户登录
 * @param data 登录参数
 */
export const login = (data: LoginDto) => {
  return request.post<UserInfo>({
    url: '/auth/login',
    data
  });
};
```

## 🔧 CLI 命令

```bash
# 初始化配置文件
swagger2api-v3 init [--force]

# 生成接口代码
swagger2api-v3 generate [--config <path>]

# 验证配置文件
swagger2api-v3 validate [--config <path>]

# 查看帮助
swagger2api-v3 --help
```

## 📝 NPM 脚本

在 `package.json` 中添加：

```json
{
  "scripts": {
    "api:generate": "swagger2api-v3 generate",
    "api:init": "swagger2api-v3 init"
  }
}
```

## 🎨 代码格式化

支持在生成完成后自动执行格式化命令：

```javascript
// 配置文件中
const config = {
  // ... 其他配置
  lint: 'prettier --write'  // 或 'eslint --fix' 等
};
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License