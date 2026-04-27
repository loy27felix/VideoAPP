# FableGlitch Studio · Mockup Index

> Apple-minimal dark variant · design-version 1 · 2026-04-27
>
> 6 静态 HTML mockup，零 JS，可直接 `file://` 打开。所有视觉 token 内联在每个文件的 `<style>` 中，与 `_tokens.css` 同步。

| 文件 | 用途 | 截图建议 |
|------|------|----------|
| `login.html` | 登录 / 注册页（tab 切换，邮箱 + 密码 + display_name） | 1920×1080，截整页 |
| `shell.html` | 主框架空状态：顶导 + 左项目树（暂无剧集）+ 中央欢迎卡 | 1920×1080，截整页 |
| `tree.html` | 主框架带数据：3 系列项目树展开到"侏儒怪 第一集"，中间是剧集 dashboard（8 + 4 板块卡片）+ 一键入库 FAB | 1920×1080，截整页 |
| `episode-wizard.html` | 新建剧集 4 步 wizard（当前 step 4 · 填剧集名 + 路径预览） | 1920×1080，截整页（含 backdrop） |
| `push-review.html` | 一键入库评审：剧本/角色分组、复选框、commit message、底部悬浮 ⚡ 推送 | 1920×1080，截整页（含底部 sticky bar） |
| `first-run-modal.html` | 首次登录引导浮窗，560px 居中模态，背景为虚化的 dashboard 网格 | 1920×1080，截整页 |

## 设计纪律 checklist

- ✅ 一屏一个紫色 CTA — 其他全部低调灰底/纯文字
- ✅ 主内容居中，最大宽度 880px（dashboard / 入库评审）/ 720px（wizard）/ 560px（first-run）/ 480px（login）
- ✅ 状态用 8px 实心圆（绿=已入库 / 琥珀=草稿）— 没有 pill 徽章
- ✅ 渐变只用在 Logo + 主 CTA + 头像
- ✅ 字号跳跃：40 / 22 / 17 / 16 / 14 / 13 / 12 / 11 / 10
- ✅ JetBrains Mono：文件名 / 路径 / 时间戳 / 邮箱 / 版本号 / 容量 / commit
- ✅ 无装饰线、无 scanline、无 glitch 边框 —— 仅 hover 颜色变化
- ✅ 图标全用 emoji（📝 🖼️ 👤 🏰 🗝️ 🎬 ⚡ 👋 …）

## 后续工程映射

工程师重写时建议的组件边界：

- `<TopNav />` —— 56px 高，Logo + 用户区，3 个屏幕共用
- `<ProjectTree />` —— 280px 侧栏，递归节点：系列 → 专辑 → 内容 → 剧集
- `<EpisodeDashboard />` —— `tree.html` 中央内容区
- `<TileGrid />` —— 4 列网格，支持 `locked` 态 + `P4` 角标
- `<Wizard />` —— 步骤指示器 + 4 个 step 内容；当前文件展示 step 4
- `<PushBar />` —— 底部 sticky 悬浮栏（汇总 + 主推送按钮）
- `<FirstRunModal />` —— 复用 `<Modal />` 容器
