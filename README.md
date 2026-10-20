# 子墨学堂 · 第一版

面向小学课后辅导机构的微信**原生小程序 + TypeScript + 微信云开发**。同一小程序提供老师、主责老师、管理员和家长工作台。正式数据保存在云数据库，图片在私有云存储中；客户端不能直接读写数据库或存储。

本仓库原为空，现包含业务源码、原生页面、云函数、独立演示服务、测试和配置说明。**没有提供真实 AppID/云环境，因此尚未发布到微信，也未完成真机和真实云部署验收。** 默认启动的是显著标识的虚构演示。

## 先体验（不用先准备微信云资源）

1. 电脑安装 Node.js 22 LTS、微信开发者工具。
2. 在项目根目录打开终端，依次执行：

   ```sh
   npm ci
   npm run build
   npm test
   npm run demo
   ```

3. 保持最后一个终端运行。在微信开发者工具选择“导入项目”，选择**整个仓库目录**，不要只选 `miniprogram`；无 AppID 时选测试号。首次编译前确认已经执行 `npm run build`。
4. 仅本地演示时，在开发者工具“详情 → 本地设置”选择“不校验合法域名、web-view 域名、TLS 版本以及 HTTPS 证书”。这是让模拟器访问本机演示服务；**没有关闭依赖下载或云连接的 TLS 校验**。正式环境保留域名校验。
5. 点击“编译”。顶部黄色条显示“虚构演示”，可以切换管理员、数学老师和两类家长。
6. 修改 `.ts` 后重新执行 `npm run build`，开发者工具会加载生成的 `.js`。持续开发可运行 `npx tsc -p miniprogram/tsconfig.json --watch`。

本地演示将虚构数据保存在演示服务器 `/tmp/zimo-school-demo/state.json`，**并非把所有业务数据塞进小程序本机存储**。电脑重启后 `/tmp` 可能清空；演示不能用来保存真实学生信息。真机请使用独立的云演示环境，手机不能访问电脑的 `127.0.0.1`。

## 文档入口

- [从零配置微信云环境、部署和排错](docs/部署说明.md)
- [老师、管理员、家长分步骤使用手册](docs/使用手册.md)
- [数据结构、权限、接口及普通实现决策](docs/架构与数据.md)
- [实际测试结果、已实现和限制](docs/验收报告.md)
- [上线所需信息和操作清单](docs/上线清单.md)
- [隐私指引填写模板](docs/隐私指引模板.md)

## 项目结构

```text
miniprogram/
  app.ts / app.json / app.wxss     小程序入口、全局样式
  config.ts                       本地演示或真实云环境选择（不放密钥）
  services/api.ts                 统一接口、失败处理和请求去重
  pages/workspace/                老师、家长和管理工作台；动态表单、成绩画布
cloudfunctions/api/
  index.js                       微信 OPENID、初始化和云文件服务
  lib/domain.js                  服务端权限、状态机和业务接口
  lib/cloud-store.js             云数据库事务适配
  lib/memory.js / seed.js         测试适配和虚构种子
scripts/demo-server.js            仅本地的独立演示 API 服务
scripts/                         演示服务与辅助命令
 tests/                          业务、客户端、模板、适配器测试
 docs/                           部署、使用、权限、索引、验收与隐私资料
```

云函数使用 JavaScript（Node.js 18 及以上），便于原生云函数直接部署及本地执行同一业务逻辑；原生小程序使用 TypeScript。没有独立电脑管理后台。未来后台可复用 `action + input` 业务接口，但必须额外接入可信的员工登录及服务端会话；不得用浏览器传来的 OPENID 直接替代微信上下文。

## 日常命令

| 命令 | 用途 |
|---|---|
| `npm run build` | 编译小程序 TypeScript |
| `npm run typecheck` | 类型检查 |
| `npm test` | 编译并执行全部自动化测试 |
| `npm run demo` | 先构建并检查模块，再启动独立虚构演示服务 |
| `npm run check:bundle` | 检查小程序入口及配置等依赖是否齐全 |

依赖通过锁文件固定。请勿提交密钥、微信上传私钥、真实学生导出或云服务凭证。当前目录中的编译产物已生成，Git 和下载包同时保存 TS 源文件及已编译 JS；修改 TS 或环境配置后仍须构建。`npm run demo` 会先自动构建并检查包括 config.js 在内的页面依赖，构建失败不会启动服务。

## Mac 与 Windows 终端

Mac 使用 `npm ci`、`npm run build`、`npm run demo`。Windows PowerShell 若提示 npm.ps1 被禁用，将命令中的 npm 改为 npm.cmd，不必修改系统执行策略。运行前进入同时包含 package.json 与 project.config.json 的项目目录。

若开发者工具显示 `module config.js is not defined`：先在同一个项目根目录运行 `npm run build`，看到“模块检查通过”后，在开发者工具选择“清缓存 → 全部清除”并重新编译。确保没有启用额外的TypeScript编译插件，本项目使用预编译JS。不要删掉 config.js 或手改生成的JS；应修改 config.ts 后重新构建。
