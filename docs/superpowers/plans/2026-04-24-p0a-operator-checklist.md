# P0-A 运维接入清单（乐美林手动）

部署前必做：

1. Supabase：创建生产 project；在 Auth 设置中关闭 email confirmations；记下 URL / service key / anon key / JWT secret。
2. Upstash：创建 Redis database（免费 tier 足够）；记下 REST URL + REST Token。
3. GitHub：创建 organization `fableglitch` + 私有仓库 `asset-library`（只要一个初始 commit 就行）；用 `fableglitch-bot@beva.com` 新注册账号并生成 classic PAT，scope 选 `repo`。
4. Cloudflare R2：创建 bucket `fableglitch-assets`；生成 R2 API Token（Object Read+Write）。
5. Vercel：import GitHub 仓库，Root Directory 设为 `backend`，按 spec §9.B 清单填入所有环境变量。

部署：

6. 把代码推到 GitHub `main` 分支，Vercel 自动跑首次 preview build。
7. 若 build 失败：在 Vercel dashboard 查看 log 定位，常见原因是 env 缺失或 migration 未 apply。

冷启动 migrations：

8. 本地运行 `npx supabase link --project-ref <生产 ref>`。
9. 本地运行 `npx supabase db push`，把本地 4 个 migration 推到生产。
10. 生产 DB 跑一次 `backend/supabase/seed.sql`，可以用 Supabase SQL Editor 直接执行。
11. 验证：Studio 或 SQL Editor 里能看到 `asset_types` 12 行。

远程冒烟：

12. Vercel preview URL 根路径能返回 `FableGlitch backend online.`。
13. 用真 `@beva.com` 测试邮箱依次跑 signup / login / me / refresh / logout，全部应返回 2xx。
