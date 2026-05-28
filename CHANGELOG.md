## 1.1.9 (2026-05-28)


### Bug Fixes

* 修改接口文档说明 ([a0cb1aa](https://github.com/xiaoyang33/swagger2api-v3/commit/a0cb1aaa0a7bacd751493fbd5f7aeb2a368a9a34))
* **cli:** 默认使用 ES Module 并优化模块类型检测逻辑 ([424cef2](https://github.com/xiaoyang33/swagger2api-v3/commit/424cef2dece442c22eb8c411604b9f863468b14f))
* **generator:** 修复默认情况下未返回驼峰命名的标签 ([475da13](https://github.com/xiaoyang33/swagger2api-v3/commit/475da13f856006aaa1edb5878da3df6297b142c3))
* **parser:** 修复可选属性中null类型的处理问题 ([a9f3553](https://github.com/xiaoyang33/swagger2api-v3/commit/a9f35531b7fdf1a404b5c1f2dc4b5957b57738fa))
* **parser:** 修复类型收集时未过滤未定义类型的问题 ([4a89f04](https://github.com/xiaoyang33/swagger2api-v3/commit/4a89f04ff3b498f981a88d7369481ed60a59e688))
* **utils:** 修复 swaggerTypeToTsType 函数中 nullable 属性的处理 ([8946d6e](https://github.com/xiaoyang33/swagger2api-v3/commit/8946d6e6f1fbf1ec3d984a99a45f2cb2c849aec0))
* **utils:** 修复数组类型引用时生成重复[]的问题 ([8d9fc90](https://github.com/xiaoyang33/swagger2api-v3/commit/8d9fc90dba061823d7eca590b76980594cd55b53))


### Features

* 1.0.4 ([9ecbe84](https://github.com/xiaoyang33/swagger2api-v3/commit/9ecbe844b48925a2650af2ddd8375cc3ea93f536))
* 区分环境导出配置 ([0519050](https://github.com/xiaoyang33/swagger2api-v3/commit/05190505d2c863a4ff1fc7940b3d6d6da32168ab))
* 删除多余文件 ([5fdfbd5](https://github.com/xiaoyang33/swagger2api-v3/commit/5fdfbd58118ca9ff704972b3ef5436cf11ab2369))
* 生成函数名添加请求方法 ([0999b87](https://github.com/xiaoyang33/swagger2api-v3/commit/0999b87ded51ba551b12860dd7461fe540b1cbd3))
* 添加 JSON Schema 支持并增强配置验证 ([6b183de](https://github.com/xiaoyang33/swagger2api-v3/commit/6b183de693ec70f67f52c417f66e703bd62095b9))
* 添加方法名HTTP后缀配置选项并改进类型处理 ([3ece9b2](https://github.com/xiaoyang33/swagger2api-v3/commit/3ece9b2be993b215fd652b61ceda5110de2711cd))
* 修复响应体中引入其他dto为any ([79e370d](https://github.com/xiaoyang33/swagger2api-v3/commit/79e370dc511cc3ad9449b7024abe37930b6479f3))
* 支持 OpenAPI 3.x 规范并重构类型系统 ([3e8e4ea](https://github.com/xiaoyang33/swagger2api-v3/commit/3e8e4ea631e6544f8919185cbbf836933221c078))
* 支持javascript生成器和通用请求风格 ([22ce6d5](https://github.com/xiaoyang33/swagger2api-v3/commit/22ce6d550956a524d8ef87ee530999e92e179fd7))
* **generator:** 增强泛型类型支持和响应容器处理 ([31afb68](https://github.com/xiaoyang33/swagger2api-v3/commit/31afb68bda7da8a5c5c3382a72c1216806825e40))
* **parser:** 增强枚举类型解析支持扩展字段 ([3cb5cad](https://github.com/xiaoyang33/swagger2api-v3/commit/3cb5cadf816bb42a9ae10dae3805b175ffd3ee42))
* **utils:** 添加方法名前缀移除功能 ([ac57347](https://github.com/xiaoyang33/swagger2api-v3/commit/ac57347ef746386bd673e1e7d743f429f70b3fbe))
