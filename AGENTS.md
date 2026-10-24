# 项目规范

## 定位与来源

本项目是 `wan-kong/fuck-douyin` 的独立维护分支，维护仓库为 `paaroll/fuck-douyin_paarollfix`。交付物是通过 Vue、TypeScript、Vite 和 vite-plugin-monkey 生成的油猴脚本，不是独立网站。保留原作者来源与 MIT 许可声明。

## 目录与职责

- `src/config/schema.ts` 是配置项、默认值和面板行的唯一来源。新增功能先在 schema 中增加字段；既有键已持久化，不能随意改名。
- `src/config/store.ts` 合并旧配置与新默认值并保存；存储统一通过 `storage.ts`，优先 GM API，开发环境回退到 localStorage。配置键为 `fd_config`，浮动按钮位置键为 `fd_fab_pos`。
- `src/features/live.ts` 实现直播间礼物栏、失焦控制栏和自动设置；`skip.ts`、`quality.ts`、`videoActions.ts` 分别维护既有信息流与播放器功能。
- `src/main.ts` 将 UI 挂载到 `fd-root-box`，维护宿主页更新后的挂载状态；`App.vue` 与 `components/` 负责浮动面板。
- `tests/` 使用 Node.js 测试运行器与 Playwright 验证构建后的完整脚本。测试夹具不访问真实抖音，也不操作用户账号。
- `dist/` 是可重建的构建产物，不手工维护。`.tmp/` 仅供任务临时文件，不能成为运行依赖。

## 工程边界

- 面板样式限定在 `.fd-root` 和 Vue scoped 样式。针对抖音 DOM 的样式由对应 feature 管理，不添加全局 reset。
- 礼物栏通过持续生效的 CSS 隐藏，适配全屏容器搬移与动态创建；不能全局拦截鼠标或靠模拟移动鼠标隐藏。
- 失焦判断使用窗口焦点，不用页面可见性代替。失焦隐藏开启时，自动设置不得模拟鼠标或点击；异步等待后必须重新检查。恢复焦点、关闭选项或总开关后恢复原控制行为，保持视频播放和布局。
- 配置在 schema 中生成；Vue 是唯一运行时依赖，生产构建通过 CDN 引用。Playwright 仅为开发测试依赖。
- 图标只在 `components/icons.ts` 中增加必要 SVG，不引入整套图标包。保持严格 TypeScript 检查，不引入 CSS 框架。
- `package.json` 维护版本号；面板和用户脚本元信息应与其一致。主页、反馈和更新地址属于本分支，不能继续使用上游的发布地址。

## 工作流与文档

- 使用 pnpm 和锁文件。`pnpm build` 先执行类型检查，再生成脚本；`pnpm test` 构建后运行浏览器回归。浏览器准备方式见 README。
- `README.md` 描述安装、迁移、功能与当前可用命令；`ROADMAP.md` 记录状态、验证和发布前事项；`CLAUDE.md` 只引用本文件。
- 交付前检查实际 diff、构建、浏览器回归、公开元信息与许可，不把本机路径、日志、浏览器截图和临时材料放进发布包。
- 提交、推送、打标签、创建 Release 和修改 CI/CD 均遵循用户本次明确授权范围；准备发布候选版不等于执行公开发布。
