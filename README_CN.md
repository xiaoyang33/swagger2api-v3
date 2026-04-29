# Swagger2API-v3

中文 | [English](./README.md)

一个强大的命令行工具，用于从 OpenAPI 3.0 文档自动生成 TypeScript 或 JavaScript 接口代码。

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
npx swagger2api-v3 init
```

### 2. 配置文件说明

工具会生成 `.swagger.config.json` 配置文件：

```json
{
  "$schema": "./node_modules/swagger2api-v3/dist/.swagger2api.schema.json",
  "input": "https://petstore3.swagger.io/api/v3/openapi.json",
  "output": "./src/api",
  "importTemplate": "import { request } from '@/utils/request';",
  "generator": "typescript",
  "requestStyle": "generic",
  "groupByTags": true,
  "overwrite": true,
  "prefix": "",
  "lint": "prettier --write",
  "methodNameIgnorePrefix": [],
  "addMethodSuffix": true,
  "headerComment": "",
  "filter": {
    "include": {
      "tags": []
    },
    "exclude": {
      "tags": []
    }
  },
  "options": {
    "addComments": true
  }
}
```

### 3. 生成接口代码

```bash
npx swagger2api-v3 generate
```

## ⚙️ 配置选项

| 选项                     | 类型                  | 默认值         | 说明                                                                                                                             |
| ------------------------ | --------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `$schema`                | string                | -              | 本地 JSON Schema 路径，用于编辑器自动补全，默认指向 `node_modules/swagger2api-v3/dist/.swagger2api.schema.json`                  |
| `input`                  | string                | -              | Swagger JSON 文件路径或 URL                                                                                                      |
| `output`                 | string                | `'./src/api'`  | 生成代码的输出目录                                                                                                               |
| `generator`              | string                | `'typescript'` | 代码生成器类型，支持 `'typescript'` 和 `'javascript'`。设置 `'javascript'` 时输出 `.js` 文件，并且不生成类型文件                 |
| `groupByTags`            | boolean               | `true`         | 是否按标签分组生成文件                                                                                                           |
| `overwrite`              | boolean               | `true`         | 是否覆盖已存在的文件                                                                                                             |
| `prefix`                 | string                | `''`           | 接口路径公共前缀                                                                                                                 |
| `importTemplate`         | string                | -              | request 函数导入语句模板                                                                                                         |
| `requestStyle`           | 'method' \| 'generic' | `'generic'`    | 请求调用风格：`method` 使用 `request.get/post`，`generic` 使用 `request({ method })`                                             |
| `lint`                   | string                | -              | 代码格式化命令（可选）                                                                                                           |
| `methodNameIgnorePrefix` | string[]              | `[]`           | 生成方法名时需要忽略的前缀数组。例如，配置 `['api', 'auth']` 后，`apiGetName` 会变成 `getName`，`authUserInfo` 会变成 `userInfo` |
| `addMethodSuffix`        | boolean               | `true`         | 是否在生成的方法名中添加 HTTP method 后缀。`true` 时生成如 `userListPost`，`false` 时生成如 `userList`                           |
| `headerComment`          | string                | -              | 自定义生成的 `types`、API 和入口文件头部注释                                                                                     |
| `filter.include.tags`    | string[]              | `[]`           | 只生成匹配这些 tag 的接口。为空时表示包含全部接口                                                                                |
| `filter.exclude.tags`    | string[]              | `[]`           | 跳过匹配这些 tag 的接口。排除规则优先级高于包含规则                                                                              |
| `options.addComments`    | boolean               | `true`         | 是否添加详细注释                                                                                                                 |

## 📁 生成的文件结构

### 按标签分组 (推荐)

```
src/api/
├── types.ts           # 数据类型定义（仅在 TypeScript 模式）
├── user/              # User 相关接口
│   └── index.ts
├── auth/              # Auth 相关接口
│   └── index.ts
└── index.ts          # 入口文件
```

### JavaScript 输出

当设置 `generator: 'javascript'` 时：

- 输出 `.js` 文件（如 `index.js`、`api.js`、`user/index.js` 等）
- 不生成 `types.ts` 类型文件
- 移除 TypeScript 语法（类型标注、`import type`、泛型 `<T>`）

示例（方法风格）：

```javascript
export const codeAuth = (data, config) => {
  return request.post({ url: '/api/auth/codeAuth', data, ...config });
};
```

示例（通用风格）：

```javascript
export const codeAuth = (data, config) => {
  return request({
    url: '/api/auth/codeAuth',
    method: 'POST',
    data,
    ...config
  });
};
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
// authController/index.ts
import { request } from '@/utils/request';
import type { LoginDto, LoginRespDto } from '../types';

/**
 * 登录
 * @param data 登录参数
 * @param config 可选的请求配置
 */
export const authControllerLoginPost = (data: LoginDto, config?: any) => {
  return request.post<LoginRespDto>({
    url: '/admin/auth/login',
    data,
    ...config
  });
};

// 当设置 requestStyle 为 'generic' 时：
export const authControllerLoginPost2 = (data: LoginDto, config?: any) => {
  return request<LoginRespDto>({
    url: '/admin/auth/login',
    data,
    method: 'POST',
    ...config
  });
};
```

## 🔧 CLI 命令

```bash
# 初始化配置文件
npx swagger2api-v3 init [--force]

# 生成接口代码
npx swagger2api-v3 generate [--config <path>]

# 验证配置文件
npx swagger2api-v3 validate [--config <path>]

# 查看帮助
npx swagger2api-v3 --help
```

## 📝 NPM 脚本

在 `package.json` 中添加：

```json
{
  "scripts": {
    "api:generate": "swagger2api-v3 generate",
    "api:init": "swagger2api-v3 init",
    "api:validate": "swagger2api-v3 validate"
  }
}
```

## 🎨 代码格式化

支持在生成完成后自动执行格式化命令：

```json
{
  "lint": "prettier --write"
}
```

## 🤝 贡献指南

如果您遇到任何问题或有改进建议，欢迎在 GitHub 上 [提交 Issue](https://github.com/xiaoyang33/swagger2api-v3/issues)。同时也非常欢迎 Pull Request！

## 📄 许可证

MIT License
