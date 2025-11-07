# Swagger2API-v3

English | [中文](./README_CN.md)

A powerful command-line tool for automatically generating TypeScript interface code from Swagger (OAS3.0) documentation.

## ✨ Features

- 🚀 **Fast Generation** - Quickly generate TypeScript interface code from Swagger JSON
- 📁 **Smart Grouping** - Support automatic file grouping by Swagger tags
- 📝 **Detailed Comments** - Automatically generate detailed comments including descriptions, parameters, and return values
- 🎨 **Code Formatting** - Support custom formatting commands
- ⚙️ **Environment Adaptation** - Automatically detect project environment and generate corresponding configuration files
- 🔧 **CLI Tool** - Provide complete command-line tools

## 📦 Installation

```bash
# Global installation
npm install -g swagger2api-v3

# Project dependency
npm install swagger2api-v3
```

## 🚀 Quick Start

### 1. Initialize Configuration File

```bash
npx swagger2api-v3 init
```

### 2. Configuration File Description

The tool automatically generates configuration files in the corresponding format based on the project environment:

**CommonJS Environment** (`"type": "commonjs"` or not set):
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

**ES Module Environment** (`"type": "module"`):
```javascript
const config = {
  // ... same configuration
};

export default config;
```

### 3. Generate Interface Code

```bash
npx swagger2api-v3 generate
```

## ⚙️ Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `input` | string | - | Swagger JSON file path or URL |
| `output` | string | `'./src/api'` | Output directory for generated code |
| `generator` | string | `'typescript'` | Code generator type. Supports `'typescript'` and `'javascript'`. `'javascript'` outputs `.js` files and skips type file generation |
| `groupByTags` | boolean | `true` | Whether to group files by tags |
| `overwrite` | boolean | `true` | Whether to overwrite existing files |
| `prefix` | string | `''` | Common prefix for API paths |
| `importTemplate` | string | - | Import statement template for request function |
| `requestStyle` | 'method' \| 'generic' | `'generic'` | Request call style: `method` uses `request.get/post`, `generic` uses `request({ method })` |
| `lint` | string | - | Code formatting command (optional) |
| `options.addComments` | boolean | `true` | Whether to add detailed comments |

## 📁 Generated File Structure

### Grouped by Tags (Recommended)

```
src/api/
├── types.ts           # Data type definitions (TypeScript mode only)
├── user/              # User-related APIs
│   └── index.ts
├── auth/              # Auth-related APIs
│   └── index.ts
└── index.ts          # Entry file
```

### JavaScript Output

When `generator: 'javascript'` is set:

- Outputs `.js` files (`index.js`, `api.js`, `user/index.js`, etc.)
- Does not generate a `types.ts` file
- Removes TypeScript-specific syntax (types, `import type`, generics like `<T>`)

Example generated API function (method style):

```javascript
export const codeAuth = (data, config) => {
  return request.post({ url: '/api/auth/codeAuth', data, ...config });
};
```

Example generated API function (generic style):

```javascript
export const codeAuth = (data, config) => {
  return request({ url: '/api/auth/codeAuth', method: 'POST', data, ...config });
};
```

### Not Grouped

```
src/api/
├── types.ts       # Data type definitions
├── api.ts         # All API interfaces
└── index.ts       # Entry file
```

## 💡 Usage Examples

### Generated Type Definitions

```typescript
// types.ts
export interface LoginDto {
  /** Account */
  account: string;
  /** Password */
  password: string;
}

export interface UserInfo {
  /** User ID */
  id: string;
  /** Username */
  username: string;
}
```

### Generated API Interfaces

```typescript
// authController/index.ts
import { request } from '@/utils/request';
import type { LoginDto, LoginRespDto } from '../types';

/**
 * Login
 * @param data Login parameters
 * @param config Optional request configuration
 */
export const authControllerLoginPost = (data: LoginDto, config?: any) => {
  return request.post<LoginRespDto>({
    url: '/admin/auth/login',
    data,
    ...config
  });
};

// When requestStyle is set to 'generic':
export const authControllerLoginPost2 = (data: LoginDto, config?: any) => {
  return request<LoginRespDto>({
    url: '/admin/auth/login',
    data,
    method: 'POST',
    ...config
  });
};
```

## 🔧 CLI Commands

```bash
# Initialize configuration file
npx swagger2api-v3 init [--force]

# Generate interface code
npx swagger2api-v3 generate [--config <path>]

# Validate configuration file
npx swagger2api-v3 validate [--config <path>]

# Show help
npx swagger2api-v3 --help
```

## 📝 NPM Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "api:generate": "swagger2api-v3 generate",
    "api:init": "swagger2api-v3 init",
    "api:validate": "swagger2api-v3 validate"
  }
}
```

## 🎨 Code Formatting

Support automatic execution of formatting commands after generation:

```javascript
// In configuration file
const config = {
  // ... other configurations
  lint: 'prettier --write'  // or 'eslint --fix', etc.
};
```

## 🤝 Contributing

Issues and Pull Requests are welcome!

## 📄 License

MIT License