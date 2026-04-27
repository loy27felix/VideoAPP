# FableGlitch P0-A · 后端基建实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭起 FableGlitch Studio 的后端骨架——Supabase schema + RLS + 种子、JWT/Refresh auth 全链路、Rate limit 基础设施、Vercel 可部署的 Next.js 16 项目，完成后前端登录/注册能跑通真机。

**Architecture:** 在现有 `D:\VideoAPP` 仓库下新增 `backend/` 子目录，内含 Next.js 16 App Router 项目；数据库层用 Supabase（Postgres + Auth + RLS），通过 Supabase CLI 管理本地开发 + migrations；Rate limit 用 Upstash Redis；所有 auth 路由跑在 Edge Runtime。endpoint 边界严格遵循 spec §5。

**Tech Stack:**
- Next.js 16 App Router (TypeScript, `app/api/*/route.ts`)
- Supabase (`@supabase/supabase-js`, Supabase CLI for local dev + migrations)
- Upstash Redis (`@upstash/redis` + `@upstash/ratelimit`)
- zod v4 for payload schemas
- vitest for unit + integration tests

**Spec reference:** `docs/superpowers/specs/2026-04-23-fableglitch-p0-foundation-design.md`（v2）。本计划只覆盖 spec §4.1、§4.2、§4.3、§4.4（表结构）、§5.1（auth 路由）、§9.A（asset_types 种子）、§9.B（env 清单）。不含 episodes/assets 路由、不含 GitHub/R2 集成——那是 P0-B 的事。

---

## File Structure

```
D:\VideoAPP\
├── backend/                                    <-- 新增，Codex 主场
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── vitest.config.ts
│   ├── .env.example
│   ├── .env.local                              <-- gitignored
│   ├── app/
│   │   ├── layout.tsx                          <-- 最简壳（只为 Next.js 能跑）
│   │   ├── page.tsx                            <-- 根返回 {status:"ok"}
│   │   └── api/
│   │       └── auth/
│   │           ├── signup/
│   │           │   ├── route.ts
│   │           │   └── route.test.ts
│   │           ├── login/
│   │           │   ├── route.ts
│   │           │   └── route.test.ts
│   │           ├── refresh/
│   │           │   ├── route.ts
│   │           │   └── route.test.ts
│   │           ├── logout/
│   │           │   ├── route.ts
│   │           │   └── route.test.ts
│   │           └── me/
│   │               ├── route.ts
│   │               └── route.test.ts
│   ├── lib/
│   │   ├── env.ts                              <-- zod 验证的 env 加载器
│   │   ├── supabase-admin.ts                   <-- Service Role client
│   │   ├── api-response.ts                     <-- { ok, data/error } 封装
│   │   ├── auth-guard.ts                       <-- JWT 验证 + user 上下文
│   │   ├── rate-limit.ts                       <-- Upstash + 测试替身
│   │   └── validators.ts                       <-- zod schemas (email/password/display_name)
│   └── supabase/
│       ├── config.toml                         <-- supabase init 产物
│       ├── migrations/
│       │   ├── 20260424000001_users_and_asset_types.sql
│       │   ├── 20260424000002_tree.sql
│       │   ├── 20260424000003_assets_and_usage.sql
│       │   └── 20260424000004_rls.sql
│       └── seed.sql                            <-- asset_types 12 行
└── shared/
    └── types.ts                                <-- API / domain 共享类型（前后端消费）
```

**文件职责：**
- `lib/env.ts`：zod schema 校验启动时的环境变量；任一缺失 → 抛错
- `lib/supabase-admin.ts`：导出一个单例 Service Role client；从不暴露给客户端
- `lib/api-response.ts`：`ok(data)` / `err(code, message, details?, status?)` 两个辅助函数，统一返回 `NextResponse`
- `lib/auth-guard.ts`：`requireUser(req)` → `{ user_id, email } | NextResponse`；封装 Bearer token 解析 + supabase `auth.getUser()`
- `lib/rate-limit.ts`：封装 Upstash `Ratelimit`；测试时用内存 Map fallback
- `lib/validators.ts`：`emailSchema` / `passwordSchema` / `displayNameSchema`
- `shared/types.ts`：前后端共用的 `ApiResponse<T>` / `User` / `Session` / `AssetType` 类型

---

## Task 1: 脚手架 Next.js 16 后端项目

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/next.config.ts`
- Create: `backend/app/layout.tsx`
- Create: `backend/app/page.tsx`
- Create: `backend/.gitignore`
- Create: `backend/.env.example`
- Modify: `D:\VideoAPP\.gitignore`（加 `backend/.env*` + `backend/.next`）

- [ ] **Step 1: 创建 backend 目录与 package.json**

Run:
```bash
cd D:/VideoAPP
mkdir -p backend
```

Write `backend/package.json`：
```json
{
  "name": "fableglitch-backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:diff": "supabase db diff"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "@upstash/ratelimit": "^2.0.3",
    "@upstash/redis": "^1.34.0",
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^16.0.0",
    "supabase": "^1.200.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: 写 tsconfig.json**

Write `backend/tsconfig.json`：
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"],
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: 写 next.config.ts + 最简 layout + page**

Write `backend/next.config.ts`：
```ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
};

export default config;
```

Write `backend/app/layout.tsx`：
```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh"><body>{children}</body></html>;
}
```

Write `backend/app/page.tsx`：
```tsx
export default function Page() {
  return <pre>FableGlitch backend online.</pre>;
}
```

- [ ] **Step 4: .gitignore + .env.example**

Write `backend/.gitignore`：
```
node_modules
.next
out
.env
.env.local
.env.*.local
supabase/.branches
supabase/.temp
*.tsbuildinfo
next-env.d.ts
```

Write `backend/.env.example`（所有将在 Task 2 用到的变量，**值留空**）：
```
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_ANON_KEY=
SUPABASE_JWT_SECRET=

# Upstash Redis (rate limit)
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=

# P0-B 预留（现在可空）
GITHUB_BOT_TOKEN=
GITHUB_REPO_OWNER=fableglitch
GITHUB_REPO_NAME=asset-library
GITHUB_DEFAULT_BRANCH=main
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=fableglitch-assets
R2_ENDPOINT=
```

在根 `D:\VideoAPP\.gitignore` 追加（先 Read 看看是否已有）：
```
backend/node_modules
backend/.next
backend/.env
backend/.env.local
backend/supabase/.branches
backend/supabase/.temp
```

- [ ] **Step 5: 安装依赖 + 验证能启**

Run:
```bash
cd D:/VideoAPP/backend
npm install
```
Expected: 无报错，`node_modules` 就位，`next-env.d.ts` 由 Next 首次运行时生成。

Run:
```bash
npm run dev
```
Expected：terminal 输出 `Ready in ...` / `Local: http://localhost:3001`。
浏览器访问 `http://localhost:3001` 应看到 `FableGlitch backend online.`。

按 `Ctrl+C` 停止 dev server。

- [ ] **Step 6: Commit**

```bash
cd D:/VideoAPP
git add backend/ .gitignore
git commit -m "feat(backend): scaffold Next.js 16 App Router project"
```

若 `D:\VideoAPP` 还不是 git 仓库，先 `git init && git add -A && git commit -m "chore: initial import" && git checkout -b main`，然后再做上面这次 feat commit。

---

## Task 2: 环境变量加载器（zod 校验）

**Files:**
- Create: `backend/lib/env.ts`
- Create: `backend/lib/env.test.ts`

Spec reference: §9.B。

- [ ] **Step 1: 写失败测试**

Write `backend/lib/env.test.ts`：
```ts
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

describe('env loader', () => {
  const originalEnv = { ...process.env };
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { process.env = { ...originalEnv }; });

  it('throws if SUPABASE_URL missing', async () => {
    delete process.env.SUPABASE_URL;
    process.env.SUPABASE_SERVICE_KEY = 'x';
    process.env.SUPABASE_ANON_KEY = 'x';
    process.env.SUPABASE_JWT_SECRET = 'x';
    process.env.UPSTASH_REDIS_URL = 'https://x.upstash.io';
    process.env.UPSTASH_REDIS_TOKEN = 'x';
    await expect(import('./env')).rejects.toThrow(/SUPABASE_URL/);
  });

  it('throws if SUPABASE_URL is not a URL', async () => {
    process.env.SUPABASE_URL = 'not-a-url';
    process.env.SUPABASE_SERVICE_KEY = 'x';
    process.env.SUPABASE_ANON_KEY = 'x';
    process.env.SUPABASE_JWT_SECRET = 'x';
    process.env.UPSTASH_REDIS_URL = 'https://x.upstash.io';
    process.env.UPSTASH_REDIS_TOKEN = 'x';
    await expect(import('./env')).rejects.toThrow();
  });

  it('loads valid env', async () => {
    process.env.SUPABASE_URL = 'https://abc.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'svc';
    process.env.SUPABASE_ANON_KEY = 'anon';
    process.env.SUPABASE_JWT_SECRET = 'jwt';
    process.env.UPSTASH_REDIS_URL = 'https://x.upstash.io';
    process.env.UPSTASH_REDIS_TOKEN = 'tok';
    const { env } = await import('./env');
    expect(env.SUPABASE_URL).toBe('https://abc.supabase.co');
    expect(env.SUPABASE_SERVICE_KEY).toBe('svc');
  });
});
```

Write `backend/vitest.config.ts`：
```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
});
```

- [ ] **Step 2: 跑测试确认失败**

Run:
```bash
cd D:/VideoAPP/backend
npm test -- lib/env.test.ts
```
Expected: 3 个测试全部 FAIL，错误提示 `Cannot find module './env'`。

- [ ] **Step 3: 实现 env.ts**

Write `backend/lib/env.ts`：
```ts
import { z } from 'zod';

const schema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),
  UPSTASH_REDIS_URL: z.url(),
  UPSTASH_REDIS_TOKEN: z.string().min(1),
  GITHUB_BOT_TOKEN: z.string().optional(),
  GITHUB_REPO_OWNER: z.string().default('fableglitch'),
  GITHUB_REPO_NAME: z.string().default('asset-library'),
  GITHUB_DEFAULT_BRANCH: z.string().default('main'),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default('fableglitch-assets'),
  R2_ENDPOINT: z.url().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;
export type Env = typeof env;
```

- [ ] **Step 4: 跑测试确认通过**

Run:
```bash
npm test -- lib/env.test.ts
```
Expected: 3 passed。

- [ ] **Step 5: Commit**

```bash
git add backend/lib/env.ts backend/lib/env.test.ts backend/vitest.config.ts
git commit -m "feat(backend): zod-validated env loader"
```

---

## Task 3: 共享类型包

**Files:**
- Create: `shared/types.ts`

- [ ] **Step 1: 写类型定义**

Write `shared/types.ts`：
```ts
// Shared between backend (Next.js) and frontend (Electron + React).
// Must stay zero-runtime — pure types only.

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = {
  ok: false;
  error: { code: string; message: string; details?: unknown };
};
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

// --- users ---
export interface User {
  id: string;
  email: string;
  display_name: string;
  team: string | null;
  role: 'member' | 'admin';
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
}

export interface AuthResult {
  user: User;
  session: Session;
}

// --- asset_types ---
export type StorageBackend = 'github' | 'r2';

export interface AssetType {
  code: string;
  name_cn: string;
  icon: string | null;
  folder_path: string;
  filename_tpl: string;
  file_exts: string[];
  storage_ext: string; // 'keep_as_is' | '.md'
  storage_backend: StorageBackend;
  parent_panel: string | null;
  needs_before: string[];
  supports_paste: boolean;
  allow_ai_generate: boolean;
  sort_order: number;
  enabled: boolean;
}

// --- tree (P0-B 使用，这里先占位) ---
export interface EpisodeSummary {
  id: string;
  name_cn: string;
  status: 'drafting' | 'review' | 'published' | 'archived';
  updated_at: string;
  episode_path: string;
  asset_count_pushed: number;
}

// --- error codes (spec §5.4 + auth section) ---
export type ErrorCode =
  | 'INVALID_EMAIL_DOMAIN'
  | 'WEAK_PASSWORD'
  | 'DISPLAY_NAME_REQUIRED'
  | 'EMAIL_ALREADY_EXISTS'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_REFRESH_TOKEN'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'PAYLOAD_MALFORMED';
```

- [ ] **Step 2: 确认 backend 能 import**

Run:
```bash
cd D:/VideoAPP/backend
npx tsc --noEmit
```
Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
cd D:/VideoAPP
git add shared/
git commit -m "feat(shared): API/domain types shared across frontend and backend"
```

---

## Task 4: Migration 001 — users + asset_types 表

**Files:**
- Create: `backend/supabase/config.toml`（`supabase init` 生成）
- Create: `backend/supabase/migrations/20260424000001_users_and_asset_types.sql`

Spec reference: §4.1、§4.2、§9.A。

- [ ] **Step 1: 初始化 Supabase 本地项目**

Run:
```bash
cd D:/VideoAPP/backend
npx supabase init
```
Expected: 生成 `supabase/config.toml` + `supabase/seed.sql`（空）。不 prompt 的话默认配置就够。

- [ ] **Step 2: 写 migration 001**

Write `backend/supabase/migrations/20260424000001_users_and_asset_types.sql`：
```sql
-- Users bound to auth.users; email domain constraint enforces @beva.com
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique check (email ~* '@beva\.com$'),
  display_name text not null,
  team text,
  role text not null default 'member'
    check (role in ('member', 'admin')),
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  is_active boolean not null default true
);

create index idx_users_email on public.users(email);

-- Asset types: data-driven panel registry
create table public.asset_types (
  code text primary key,
  name_cn text not null,
  icon text,
  folder_path text not null,
  filename_tpl text not null,
  file_exts text[] not null,
  storage_ext text not null,
  storage_backend text not null
    check (storage_backend in ('github', 'r2')),
  parent_panel text,
  needs_before text[],
  supports_paste boolean not null default false,
  allow_ai_generate boolean not null default false,
  sort_order int not null default 0,
  enabled boolean not null default true
);
```

- [ ] **Step 3: 本地启动 Supabase 并 apply migration**

Run:
```bash
cd D:/VideoAPP/backend
npx supabase start
```
Expected: 输出 `API URL / DB URL / Studio URL`，记下 `SERVICE_ROLE_KEY / ANON_KEY / JWT_SECRET`（写入 `backend/.env.local`）。首次启动需下载镜像，耗时几分钟。

Run:
```bash
npx supabase db reset
```
Expected: migration 被 apply，无错误。

- [ ] **Step 4: 验证 schema**

Run:
```bash
npx supabase db dump --data-only=false --schema public | head -80
```
Expected: 看到 `CREATE TABLE public.users` 与 `CREATE TABLE public.asset_types`，列名与 migration 一致。

- [ ] **Step 5: 写入 .env.local**

Write `backend/.env.local`（用上一步 `supabase start` 输出的值填）：
```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_KEY=<paste from supabase start output>
SUPABASE_ANON_KEY=<paste from supabase start output>
SUPABASE_JWT_SECRET=<paste from supabase start output>
UPSTASH_REDIS_URL=https://example-placeholder.upstash.io
UPSTASH_REDIS_TOKEN=placeholder
```
（Upstash 留占位——本地 rate limit 走内存 fallback，见 Task 10。）

- [ ] **Step 6: Commit**

```bash
cd D:/VideoAPP
git add backend/supabase/
git commit -m "feat(backend): migration 001 — users and asset_types tables"
```

---

## Task 5: Migration 002 — 四层项目树表

**Files:**
- Create: `backend/supabase/migrations/20260424000002_tree.sql`

Spec reference: §4.3（含 `touch_episodes_updated_at` trigger）。

- [ ] **Step 1: 写 migration 002**

Write `backend/supabase/migrations/20260424000002_tree.sql`：
```sql
-- Series
create table public.series (
  id uuid primary key default gen_random_uuid(),
  name_cn text not null,
  name_short text,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);
create unique index idx_series_name on public.series(name_cn);

-- Albums
create table public.albums (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.series(id) on delete restrict,
  name_cn text not null,
  name_short text,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);
create unique index idx_albums_sc on public.albums(series_id, name_cn);

-- Contents
create table public.contents (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete restrict,
  name_cn text not null,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);
create unique index idx_contents_ac on public.contents(album_id, name_cn);

-- Episodes
create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete restrict,
  name_cn text not null,
  sort_order int not null default 0,
  status text not null default 'drafting'
    check (status in ('drafting', 'review', 'published', 'archived')),
  created_by uuid not null references public.users(id),
  episode_path text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index idx_episodes_name on public.episodes(name_cn);
create index idx_episodes_updated on public.episodes(updated_at desc);

-- Auto-touch updated_at on any UPDATE
create or replace function public.touch_episodes_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_episodes_touch_updated
  before update on public.episodes
  for each row execute function public.touch_episodes_updated_at();
```

- [ ] **Step 2: Apply + 验证**

Run:
```bash
cd D:/VideoAPP/backend
npx supabase db reset
```
Expected: 两个 migration 都 apply 成功。

Run：
```bash
npx supabase db dump --schema public | grep -E "(CREATE TABLE|CREATE INDEX|CREATE TRIGGER)" | head -20
```
Expected: 看到 series / albums / contents / episodes 四张表 + 对应 unique/idx + trigger。

- [ ] **Step 3: Commit**

```bash
cd D:/VideoAPP
git add backend/supabase/migrations/20260424000002_tree.sql
git commit -m "feat(backend): migration 002 — 4-level tree (series/albums/contents/episodes)"
```

---

## Task 6: Migration 003 — assets + usage_logs 表

**Files:**
- Create: `backend/supabase/migrations/20260424000003_assets_and_usage.sql`

Spec reference: §4.4、§4.6。

- [ ] **Step 1: 写 migration 003**

Write `backend/supabase/migrations/20260424000003_assets_and_usage.sql`：
```sql
-- Enums
create type asset_status as enum ('draft', 'pushed', 'superseded');
create type asset_source as enum ('imported', 'pasted', 'ai-generated');
create type storage_backend as enum ('github', 'r2');

-- Assets (metadata only; files live in GitHub or R2)
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.episodes(id) on delete cascade,
  type_code text not null references public.asset_types(code),

  name text not null,
  variant text,
  number int,
  version int not null default 1 check (version >= 1),
  stage text default 'ROUGH' not null
    check (stage in ('ROUGH', 'REVIEW', 'FINAL')),
  language text default 'ZH' not null
    check (language ~ '^[A-Z]{2}$'),

  original_filename text,
  final_filename text not null,

  storage_backend storage_backend not null,
  storage_ref text not null,
  storage_metadata jsonb,

  file_size_bytes bigint,
  mime_type text,
  source asset_source not null,
  status asset_status not null default 'pushed',

  author_id uuid not null references public.users(id),
  superseded_by uuid references public.assets(id),
  created_at timestamptz not null default now(),
  pushed_at timestamptz not null default now()
);

create index idx_assets_episode_type on public.assets(episode_id, type_code);
create index idx_assets_author on public.assets(author_id);

create unique index idx_assets_storage_unique
  on public.assets(episode_id, storage_backend, storage_ref);

create unique index idx_assets_filename_pushed
  on public.assets(episode_id, final_filename)
  where status = 'pushed';

-- Usage logs
create table public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  provider text not null,
  model text,
  action text not null,
  tokens_input int,
  tokens_output int,
  bytes_transferred bigint,
  cost_usd numeric(10, 6),
  episode_id uuid references public.episodes(id) on delete set null,
  request_id text,
  at timestamptz not null default now()
);

create index idx_usage_user_at on public.usage_logs(user_id, at desc);
create index idx_usage_at on public.usage_logs(at desc);
```

- [ ] **Step 2: Apply + 验证**

Run:
```bash
cd D:/VideoAPP/backend
npx supabase db reset
```
Expected: 三个 migration 全部 apply 成功。

- [ ] **Step 3: Commit**

```bash
cd D:/VideoAPP
git add backend/supabase/migrations/20260424000003_assets_and_usage.sql
git commit -m "feat(backend): migration 003 — assets and usage_logs tables"
```

---

## Task 7: Migration 004 — RLS 策略

**Files:**
- Create: `backend/supabase/migrations/20260424000004_rls.sql`

Spec reference: §4.1、§4.2、§4.3、§4.4、§4.6 的 "RLS" 子小节。

- [ ] **Step 1: 写 migration 004**

Write `backend/supabase/migrations/20260424000004_rls.sql`：
```sql
-- Enable RLS on every table (service role always bypasses)
alter table public.users enable row level security;
alter table public.asset_types enable row level security;
alter table public.series enable row level security;
alter table public.albums enable row level security;
alter table public.contents enable row level security;
alter table public.episodes enable row level security;
alter table public.assets enable row level security;
alter table public.usage_logs enable row level security;

-- users: all authenticated can read; self-update of display_name/last_login_at
create policy users_select_all on public.users
  for select to authenticated using (true);

create policy users_self_update on public.users
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- asset_types: readable by all authenticated
create policy asset_types_select on public.asset_types
  for select to authenticated using (true);

-- tree: readable by all authenticated; writes only via service role
create policy series_select on public.series
  for select to authenticated using (true);
create policy albums_select on public.albums
  for select to authenticated using (true);
create policy contents_select on public.contents
  for select to authenticated using (true);
create policy episodes_select on public.episodes
  for select to authenticated using (true);

-- assets: pushed visible to all authenticated; drafts visible only to author
-- (P0 writes only 'pushed' here; draft row support is pre-wiring for future)
create policy assets_select_pushed on public.assets
  for select to authenticated
  using (status = 'pushed' or author_id = auth.uid());

-- usage_logs: admin reads all; member reads own
create policy usage_select_self on public.usage_logs
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- No insert/update/delete policies for non-service-role: writes go through backend
```

- [ ] **Step 2: Apply + 用 anon key 手动验证 RLS 阻写**

Run:
```bash
cd D:/VideoAPP/backend
npx supabase db reset
```
Expected: 四个 migration 全部 apply 成功。

Run（用 anon key 尝试写 users 应失败）:
```bash
# 把下面两个占位符换成 supabase start 输出的 anon key 和 API URL
curl -sS -X POST "http://127.0.0.1:54321/rest/v1/users" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{"email":"x@beva.com","display_name":"X"}'
```
Expected: 返回 `{"code":"...","message":"new row violates row-level security policy..."}` 或类似 RLS 拒写错误。

- [ ] **Step 3: Commit**

```bash
cd D:/VideoAPP
git add backend/supabase/migrations/20260424000004_rls.sql
git commit -m "feat(backend): migration 004 — RLS policies for all tables"
```

---

## Task 8: Seed 文件 — asset_types 12 行

**Files:**
- Modify: `backend/supabase/seed.sql`

Spec reference: §9.A 种子表。

- [ ] **Step 1: 写 seed.sql**

Write `backend/supabase/seed.sql`（覆盖 `supabase init` 生成的空文件）：
```sql
-- asset_types seed — spec §9.A (P0 has 12 rows; 4 disabled for P4)
insert into public.asset_types
  (code, name_cn, icon, folder_path, filename_tpl, file_exts, storage_ext, storage_backend, parent_panel, needs_before, supports_paste, allow_ai_generate, sort_order, enabled)
values
  ('SCRIPT',     '剧本',        '📝', '02_Data/Script',
   '{series}_{content}_SCRIPT',
   array['.docx','.md','.txt'], '.md', 'github', null, null, true, false, 10, true),

  ('PROMPT_IMG', '分镜图提示词', '🖼️', '02_Data/Prompt/Image',
   '{series}_{content}_PROMPT_IMG_{number:03}',
   array['.md','.txt','.xlsx'], '.md', 'github', '分镜', array['SCRIPT'], true, false, 20, true),

  ('PROMPT_VID', '分镜视频提示词','🎞️', '02_Data/Prompt/Video',
   '{series}_{content}_PROMPT_VID_{number:03}',
   array['.md','.txt','.xlsx'], '.md', 'github', '分镜', array['SCRIPT'], true, false, 21, true),

  ('SHOT_IMG',   '分镜图',       '🖼️', '02_Data/Shot/{episode}/Images',
   '{episode}_SHOT_{number:03}_v{version:03}',
   array['.png','.jpg','.jpeg','.webp'], 'keep_as_is', 'r2', '分镜', array['PROMPT_IMG'], false, false, 22, true),

  ('SHOT_VID',   '分镜视频',     '🎬', '02_Data/Shot/{episode}/Videos',
   '{episode}_SHOT_{number:03}_v{version:03}',
   array['.mp4','.mov','.webm'], 'keep_as_is', 'r2', '分镜', array['PROMPT_VID','SHOT_IMG'], false, false, 23, true),

  ('CHAR',       '角色',         '👤', '02_Data/Assets/Characters',
   '{content}_CHAR_{name}_{variant}_v{version:03}',
   array['.png','.jpg','.jpeg','.webp'], 'keep_as_is', 'r2', '视觉资产', null, false, false, 30, true),

  ('PROP',       '道具',         '🎒', '02_Data/Assets/Props',
   '{content}_PROP_{name}_{variant}_v{version:03}',
   array['.png','.jpg','.jpeg','.webp'], 'keep_as_is', 'r2', '视觉资产', null, false, false, 31, true),

  ('SCENE',      '场景',         '🏞️', '02_Data/Assets/Scenes',
   '{content}_SCENE_{name}_{variant}_v{version:03}',
   array['.png','.jpg','.jpeg','.webp'], 'keep_as_is', 'r2', '视觉资产', null, false, false, 32, true),

  ('DIALOG',     '对白',         '💬', '02_Data/Audio/Dialog',
   '{episode}_DIALOG_{number:03}_{language}',
   array['.mp3','.wav','.m4a'], 'keep_as_is', 'r2', '音频', array['SCRIPT'], false, false, 40, false),

  ('BGM',        '配乐',         '🎵', '02_Data/Audio/BGM',
   '{episode}_BGM_{number:03}_{name}',
   array['.mp3','.wav'], 'keep_as_is', 'r2', '音频', null, false, false, 41, false),

  ('SONG',       '歌曲',         '🎤', '02_Data/Audio/Song',
   '{episode}_SONG_{number:03}_{name}',
   array['.mp3','.wav'], 'keep_as_is', 'r2', '音频', null, false, false, 42, false),

  ('SFX',        '音效',         '🔊', '02_Data/Audio/SFX',
   '{episode}_SFX_{number:03}_{name}',
   array['.mp3','.wav'], 'keep_as_is', 'r2', '音频', null, false, false, 43, false)
on conflict (code) do update set
  name_cn = excluded.name_cn,
  icon = excluded.icon,
  folder_path = excluded.folder_path,
  filename_tpl = excluded.filename_tpl,
  file_exts = excluded.file_exts,
  storage_ext = excluded.storage_ext,
  storage_backend = excluded.storage_backend,
  parent_panel = excluded.parent_panel,
  needs_before = excluded.needs_before,
  supports_paste = excluded.supports_paste,
  allow_ai_generate = excluded.allow_ai_generate,
  sort_order = excluded.sort_order,
  enabled = excluded.enabled;
```

- [ ] **Step 2: Apply seed + 验证**

Run:
```bash
cd D:/VideoAPP/backend
npx supabase db reset
```
Expected: migrations + seed 都跑完，无错误。

Run（用 service key 查 asset_types 行数）:
```bash
curl -sS "http://127.0.0.1:54321/rest/v1/asset_types?select=code,storage_backend,enabled&order=sort_order" \
  -H "apikey: <SERVICE_KEY>" \
  -H "Authorization: Bearer <SERVICE_KEY>"
```
Expected: 返回 12 个对象，`SCRIPT/PROMPT_IMG/PROMPT_VID` 是 `github`，其余 9 个 `r2`；`DIALOG/BGM/SONG/SFX` 四个 `enabled:false`，其他 `enabled:true`。

- [ ] **Step 3: Commit**

```bash
cd D:/VideoAPP
git add backend/supabase/seed.sql
git commit -m "feat(backend): seed 12 asset_types (spec §9.A)"
```

---

## Task 9: Supabase admin client + API 响应封装

**Files:**
- Create: `backend/lib/supabase-admin.ts`
- Create: `backend/lib/api-response.ts`
- Create: `backend/lib/api-response.test.ts`

- [ ] **Step 1: 写 supabase-admin.ts**

Write `backend/lib/supabase-admin.ts`：
```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let client: SupabaseClient | null = null;

/**
 * Service-role Supabase client. Never import from client-side code.
 * Bypasses RLS; use only in Vercel function handlers.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
```

- [ ] **Step 2: 写失败测试 for api-response**

Write `backend/lib/api-response.test.ts`：
```ts
import { describe, expect, it } from 'vitest';
import { ok, err } from './api-response';

describe('api-response', () => {
  it('ok() wraps data with ok:true and default 200', async () => {
    const res = ok({ hello: 'world' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, data: { hello: 'world' } });
  });

  it('ok() honors explicit status', async () => {
    const res = ok({ id: 1 }, 201);
    expect(res.status).toBe(201);
  });

  it('err() wraps error with ok:false', async () => {
    const res = err('INVALID_CREDENTIALS', 'Bad login', undefined, 401);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      ok: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Bad login' },
    });
  });

  it('err() includes details when provided', async () => {
    const res = err('PAYLOAD_MALFORMED', 'nope', { field: 'email' }, 400);
    expect(await res.json()).toEqual({
      ok: false,
      error: { code: 'PAYLOAD_MALFORMED', message: 'nope', details: { field: 'email' } },
    });
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run:
```bash
cd D:/VideoAPP/backend
npm test -- lib/api-response.test.ts
```
Expected: FAIL with `Cannot find module './api-response'`.

- [ ] **Step 4: 实现 api-response.ts**

Write `backend/lib/api-response.ts`：
```ts
import { NextResponse } from 'next/server';
import type { ErrorCode } from '../../shared/types';

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

export function err(
  code: ErrorCode,
  message: string,
  details?: unknown,
  status = 400,
): NextResponse {
  const body = details === undefined
    ? { ok: false, error: { code, message } }
    : { ok: false, error: { code, message, details } };
  return NextResponse.json(body, { status });
}
```

- [ ] **Step 5: 跑测试确认通过**

Run:
```bash
npm test -- lib/api-response.test.ts
```
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
cd D:/VideoAPP
git add backend/lib/supabase-admin.ts backend/lib/api-response.ts backend/lib/api-response.test.ts
git commit -m "feat(backend): supabase admin client + unified API response envelope"
```

---

## Task 10: Rate limit 中间件（带测试替身）

**Files:**
- Create: `backend/lib/rate-limit.ts`
- Create: `backend/lib/rate-limit.test.ts`

Spec reference: §5.1 速率限制（signup 10/hr per IP，login 10/min per IP + 5/min per email）。

- [ ] **Step 1: 写失败测试**

Write `backend/lib/rate-limit.test.ts`：
```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { createInMemoryRateLimiter } from './rate-limit';

describe('rate-limit (in-memory)', () => {
  let clock = 0;
  const now = () => clock;
  beforeEach(() => { clock = 1_700_000_000_000; });

  it('allows up to N requests, then blocks', async () => {
    const rl = createInMemoryRateLimiter({ limit: 3, windowMs: 60_000, now });
    for (let i = 0; i < 3; i++) {
      const r = await rl.consume('key-a');
      expect(r.allowed).toBe(true);
    }
    const blocked = await rl.consume('key-a');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('resets after window expires', async () => {
    const rl = createInMemoryRateLimiter({ limit: 2, windowMs: 60_000, now });
    await rl.consume('key-b');
    await rl.consume('key-b');
    expect((await rl.consume('key-b')).allowed).toBe(false);
    clock += 60_001;
    expect((await rl.consume('key-b')).allowed).toBe(true);
  });

  it('tracks keys independently', async () => {
    const rl = createInMemoryRateLimiter({ limit: 1, windowMs: 60_000, now });
    expect((await rl.consume('x')).allowed).toBe(true);
    expect((await rl.consume('y')).allowed).toBe(true);
    expect((await rl.consume('x')).allowed).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run:
```bash
cd D:/VideoAPP/backend
npm test -- lib/rate-limit.test.ts
```
Expected: FAIL with `Cannot find module './rate-limit'`.

- [ ] **Step 3: 实现 rate-limit.ts**

Write `backend/lib/rate-limit.ts`：
```ts
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { env } from './env';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
  remaining: number;
}

export interface RateLimiter {
  consume(key: string): Promise<RateLimitResult>;
}

export interface InMemoryOpts {
  limit: number;
  windowMs: number;
  now?: () => number;
}

/** Used in tests and as local dev fallback when Upstash URL is placeholder. */
export function createInMemoryRateLimiter(opts: InMemoryOpts): RateLimiter {
  const now = opts.now ?? (() => Date.now());
  const buckets = new Map<string, number[]>();
  return {
    async consume(key) {
      const t = now();
      const cutoff = t - opts.windowMs;
      const hits = (buckets.get(key) ?? []).filter((h) => h > cutoff);
      if (hits.length >= opts.limit) {
        const earliest = hits[0];
        return {
          allowed: false,
          retryAfterSec: Math.max(1, Math.ceil((earliest + opts.windowMs - t) / 1000)),
          remaining: 0,
        };
      }
      hits.push(t);
      buckets.set(key, hits);
      return { allowed: true, retryAfterSec: 0, remaining: opts.limit - hits.length };
    },
  };
}

function createUpstashLimiter(prefix: string, limit: number, windowSec: number): RateLimiter {
  const redis = new Redis({ url: env.UPSTASH_REDIS_URL, token: env.UPSTASH_REDIS_TOKEN });
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
    prefix,
  });
  return {
    async consume(key) {
      const r = await rl.limit(key);
      return {
        allowed: r.success,
        retryAfterSec: r.success ? 0 : Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)),
        remaining: r.remaining,
      };
    },
  };
}

function isPlaceholder(): boolean {
  return env.UPSTASH_REDIS_URL.includes('example-placeholder');
}

/** Factory used by route handlers. Auto-falls-back to in-memory when placeholder env is set. */
export function getLimiter(name: 'signup-ip' | 'login-ip' | 'login-email'): RateLimiter {
  const configs: Record<string, { limit: number; windowSec: number }> = {
    'signup-ip':   { limit: 10, windowSec: 3600 },
    'login-ip':    { limit: 10, windowSec: 60 },
    'login-email': { limit: 5,  windowSec: 60 },
  };
  const cfg = configs[name];
  if (isPlaceholder()) {
    return createInMemoryRateLimiter({ limit: cfg.limit, windowMs: cfg.windowSec * 1000 });
  }
  return createUpstashLimiter(`fg:${name}`, cfg.limit, cfg.windowSec);
}

export function extractClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run:
```bash
npm test -- lib/rate-limit.test.ts
```
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
cd D:/VideoAPP
git add backend/lib/rate-limit.ts backend/lib/rate-limit.test.ts
git commit -m "feat(backend): rate limiter with Upstash + in-memory fallback"
```

---

## Task 11: JWT auth guard

**Files:**
- Create: `backend/lib/auth-guard.ts`
- Create: `backend/lib/auth-guard.test.ts`

Spec reference: §5 所有非 auth 路由都要求 `Authorization: Bearer <access_token>`。

- [ ] **Step 1: 写失败测试**

Write `backend/lib/auth-guard.test.ts`：
```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./supabase-admin', () => ({
  supabaseAdmin: () => ({
    auth: {
      getUser: vi.fn(async (token: string) => {
        if (token === 'valid-token') {
          return { data: { user: { id: 'user-uuid', email: 'test@beva.com' } }, error: null };
        }
        return { data: { user: null }, error: { message: 'invalid token' } };
      }),
    },
  }),
}));

import { requireUser } from './auth-guard';

describe('requireUser', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects requests without Authorization header', async () => {
    const req = new Request('http://localhost/api/anything');
    const result = await requireUser(req);
    expect('ok' in result).toBe(false);
    if (result instanceof Response) expect(result.status).toBe(401);
  });

  it('rejects malformed Authorization header', async () => {
    const req = new Request('http://localhost/api/anything', {
      headers: { authorization: 'NotBearer xxx' },
    });
    const result = await requireUser(req);
    if (result instanceof Response) expect(result.status).toBe(401);
  });

  it('accepts valid token and returns user', async () => {
    const req = new Request('http://localhost/api/anything', {
      headers: { authorization: 'Bearer valid-token' },
    });
    const result = await requireUser(req);
    expect(result).toEqual({ user_id: 'user-uuid', email: 'test@beva.com' });
  });

  it('rejects invalid token with 401', async () => {
    const req = new Request('http://localhost/api/anything', {
      headers: { authorization: 'Bearer invalid-token' },
    });
    const result = await requireUser(req);
    if (result instanceof Response) expect(result.status).toBe(401);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run:
```bash
cd D:/VideoAPP/backend
npm test -- lib/auth-guard.test.ts
```
Expected: FAIL, module not found.

- [ ] **Step 3: 实现 auth-guard.ts**

Write `backend/lib/auth-guard.ts`：
```ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from './supabase-admin';
import { err } from './api-response';

export interface AuthedUser {
  user_id: string;
  email: string;
}

export async function requireUser(req: Request): Promise<AuthedUser | NextResponse> {
  const header = req.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return err('UNAUTHORIZED', 'Missing or malformed Authorization header', undefined, 401);
  }
  const token = match[1];
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !data.user) {
    return err('UNAUTHORIZED', 'Invalid or expired token', undefined, 401);
  }
  return { user_id: data.user.id, email: data.user.email ?? '' };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run:
```bash
npm test -- lib/auth-guard.test.ts
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
cd D:/VideoAPP
git add backend/lib/auth-guard.ts backend/lib/auth-guard.test.ts
git commit -m "feat(backend): JWT auth guard (Bearer token → supabase user)"
```

---

## Task 12: 输入校验（email/password/display_name）

**Files:**
- Create: `backend/lib/validators.ts`
- Create: `backend/lib/validators.test.ts`

Spec reference: §5.1 signup 校验规则。

- [ ] **Step 1: 写失败测试**

Write `backend/lib/validators.test.ts`：
```ts
import { describe, expect, it } from 'vitest';
import { emailSchema, passwordSchema, displayNameSchema, signupSchema } from './validators';

describe('emailSchema', () => {
  it('accepts @beva.com addresses', () => {
    expect(emailSchema.safeParse('alice@beva.com').success).toBe(true);
  });
  it('rejects non-beva domains', () => {
    expect(emailSchema.safeParse('alice@gmail.com').success).toBe(false);
    expect(emailSchema.safeParse('alice@beva.co').success).toBe(false);
  });
  it('rejects malformed emails', () => {
    expect(emailSchema.safeParse('not-email').success).toBe(false);
  });
  it('normalizes case to lowercase', () => {
    const r = emailSchema.safeParse('Alice@Beva.com');
    expect(r.success && r.data).toBe('alice@beva.com');
  });
});

describe('passwordSchema', () => {
  it('requires ≥8 chars + digit + letter', () => {
    expect(passwordSchema.safeParse('abcdefg1').success).toBe(true);
    expect(passwordSchema.safeParse('short1').success).toBe(false);
    expect(passwordSchema.safeParse('alllowercase').success).toBe(false);
    expect(passwordSchema.safeParse('12345678').success).toBe(false);
  });
});

describe('displayNameSchema', () => {
  it('accepts 1-32 chars', () => {
    expect(displayNameSchema.safeParse('乐美林').success).toBe(true);
    expect(displayNameSchema.safeParse('x').success).toBe(true);
    expect(displayNameSchema.safeParse('y'.repeat(32)).success).toBe(true);
  });
  it('rejects empty or >32', () => {
    expect(displayNameSchema.safeParse('').success).toBe(false);
    expect(displayNameSchema.safeParse(' '.repeat(3)).success).toBe(false); // trimmed becomes empty
    expect(displayNameSchema.safeParse('y'.repeat(33)).success).toBe(false);
  });
});

describe('signupSchema', () => {
  it('validates whole payload', () => {
    const r = signupSchema.safeParse({
      email: 'x@beva.com', password: 'abcdefg1', display_name: '乐美林',
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run:
```bash
cd D:/VideoAPP/backend
npm test -- lib/validators.test.ts
```
Expected: FAIL, module not found.

- [ ] **Step 3: 实现 validators.ts**

Write `backend/lib/validators.ts`：
```ts
import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .transform((s) => s.toLowerCase())
  .pipe(z.email().regex(/@beva\.com$/, 'Must be a @beva.com email'));

export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .refine((s) => /[A-Za-z]/.test(s), 'Must contain a letter')
  .refine((s) => /[0-9]/.test(s), 'Must contain a digit');

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Display name required')
  .max(32, 'Display name at most 32 characters');

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  display_name: displayNameSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

export const logoutSchema = z.object({
  refresh_token: z.string().min(1),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
```

- [ ] **Step 4: 跑测试确认通过**

Run:
```bash
npm test -- lib/validators.test.ts
```
Expected: all passed.

- [ ] **Step 5: Commit**

```bash
cd D:/VideoAPP
git add backend/lib/validators.ts backend/lib/validators.test.ts
git commit -m "feat(backend): zod validators for auth payloads"
```

---

## Task 13: POST /api/auth/signup

**Files:**
- Create: `backend/app/api/auth/signup/route.ts`
- Create: `backend/app/api/auth/signup/route.test.ts`

Spec reference: §5.1 signup、§6.1 首次登录。

- [ ] **Step 1: 写失败测试**

Write `backend/app/api/auth/signup/route.test.ts`：
```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const adminMocks = {
  createUser: vi.fn(),
  from: vi.fn(),
  consume: vi.fn(async () => ({ allowed: true, retryAfterSec: 0, remaining: 9 })),
};

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    auth: { admin: { createUser: adminMocks.createUser } },
    from: adminMocks.from,
  }),
}));
vi.mock('@/lib/rate-limit', () => ({
  getLimiter: () => ({ consume: adminMocks.consume }),
  extractClientIp: () => '1.2.3.4',
}));

import { POST } from './route';

function makeReq(body: unknown) {
  return new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminMocks.consume.mockResolvedValue({ allowed: true, retryAfterSec: 0, remaining: 9 });
  });

  it('400 on non-beva email', async () => {
    const res = await POST(makeReq({ email: 'x@gmail.com', password: 'abcdefg1', display_name: 'X' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_EMAIL_DOMAIN');
  });

  it('400 on weak password', async () => {
    const res = await POST(makeReq({ email: 'x@beva.com', password: 'short', display_name: 'X' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('WEAK_PASSWORD');
  });

  it('400 on empty display_name', async () => {
    const res = await POST(makeReq({ email: 'x@beva.com', password: 'abcdefg1', display_name: '' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('DISPLAY_NAME_REQUIRED');
  });

  it('429 when rate-limited', async () => {
    adminMocks.consume.mockResolvedValueOnce({ allowed: false, retryAfterSec: 120, remaining: 0 });
    const res = await POST(makeReq({ email: 'x@beva.com', password: 'abcdefg1', display_name: 'X' }));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('120');
  });

  it('409 when email already exists', async () => {
    adminMocks.createUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'A user with this email address has already been registered' },
    });
    const res = await POST(makeReq({ email: 'x@beva.com', password: 'abcdefg1', display_name: 'X' }));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('201 on success, returns user + session', async () => {
    adminMocks.createUser.mockResolvedValueOnce({
      data: {
        user: { id: 'uid-1', email: 'x@beva.com' },
      },
      error: null,
    });
    // Mock the insert into public.users + the generateLink / signIn session
    const upsertSpy = vi.fn(async () => ({ error: null }));
    const signInSpy = vi.fn(async () => ({
      data: {
        session: { access_token: 'at', refresh_token: 'rt', expires_at: 1_700_000_000 },
      },
      error: null,
    }));
    adminMocks.from.mockReturnValue({ insert: upsertSpy });
    // Patch the admin client for auth.signInWithPassword too
    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    (supabaseAdmin() as any).auth.signInWithPassword = signInSpy;

    const res = await POST(makeReq({
      email: 'x@beva.com', password: 'abcdefg1', display_name: '乐美林',
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.user.email).toBe('x@beva.com');
    expect(body.data.user.display_name).toBe('乐美林');
    expect(body.data.session.access_token).toBe('at');
    expect(upsertSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run:
```bash
cd D:/VideoAPP/backend
npm test -- app/api/auth/signup/route.test.ts
```
Expected: FAIL, route not found.

- [ ] **Step 3: 实现 signup/route.ts**

Write `backend/app/api/auth/signup/route.ts`：
```ts
export const runtime = 'edge';

import { ok, err } from '@/lib/api-response';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { signupSchema } from '@/lib/validators';
import { getLimiter, extractClientIp } from '@/lib/rate-limit';
import type { AuthResult } from '@shared/types';

export async function POST(req: Request): Promise<Response> {
  // Rate limit by IP
  const ip = extractClientIp(req);
  const rl = await getLimiter('signup-ip').consume(ip);
  if (!rl.allowed) {
    const res = err('RATE_LIMITED', 'Too many signup attempts', undefined, 429);
    res.headers.set('retry-after', String(rl.retryAfterSec));
    return res;
  }

  // Parse + validate
  let body: unknown;
  try { body = await req.json(); }
  catch { return err('PAYLOAD_MALFORMED', 'Body must be JSON', undefined, 400); }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first.path.join('.');
    const code =
      path === 'email' ? 'INVALID_EMAIL_DOMAIN'
      : path === 'password' ? 'WEAK_PASSWORD'
      : path === 'display_name' ? 'DISPLAY_NAME_REQUIRED'
      : 'PAYLOAD_MALFORMED';
    return err(code, first.message, { path }, 400);
  }
  const { email, password, display_name } = parsed.data;

  // Create in auth.users (email_confirm: true bypasses confirmation)
  const admin = supabaseAdmin();
  const { data: createRes, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createErr || !createRes.user) {
    const msg = createErr?.message ?? 'unknown';
    if (/already been registered|already exists/i.test(msg)) {
      return err('EMAIL_ALREADY_EXISTS', 'Email already registered', undefined, 409);
    }
    return err('INTERNAL_ERROR', msg, undefined, 500);
  }

  const uid = createRes.user.id;

  // Insert into public.users
  const { error: insertErr } = await admin.from('users').insert({
    id: uid, email, display_name, team: 'FableGlitch', role: 'member',
  });
  if (insertErr) {
    // Roll back auth user so signup stays transactional from caller's POV
    await admin.auth.admin.deleteUser(uid).catch(() => {});
    return err('INTERNAL_ERROR', insertErr.message, undefined, 500);
  }

  // Issue session via signInWithPassword
  const { data: signInRes, error: signInErr } = await admin.auth.signInWithPassword({
    email, password,
  });
  if (signInErr || !signInRes.session) {
    return err('INTERNAL_ERROR', signInErr?.message ?? 'session issue failed', undefined, 500);
  }

  const result: AuthResult = {
    user: { id: uid, email, display_name, team: 'FableGlitch', role: 'member' },
    session: {
      access_token: signInRes.session.access_token,
      refresh_token: signInRes.session.refresh_token,
      expires_at: signInRes.session.expires_at ?? 0,
    },
  };
  return ok(result, 201);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run:
```bash
npm test -- app/api/auth/signup/route.test.ts
```
Expected: all tests passed.

- [ ] **Step 5: 本地真机冒烟**

Run:
```bash
cd D:/VideoAPP/backend
npm run dev
# 新终端：
curl -sS -X POST http://localhost:3001/api/auth/signup \
  -H "content-type: application/json" \
  -d '{"email":"smoke@beva.com","password":"test1234","display_name":"烟测"}'
```
Expected：201 返回 `{ok:true, data:{user:..., session:{access_token:..., refresh_token:..., expires_at:...}}}`。再跑一次同 email 应返回 409。

- [ ] **Step 6: Commit**

```bash
cd D:/VideoAPP
git add backend/app/api/auth/signup/
git commit -m "feat(backend): POST /api/auth/signup with rate limit + rollback"
```

---

## Task 14: POST /api/auth/login

**Files:**
- Create: `backend/app/api/auth/login/route.ts`
- Create: `backend/app/api/auth/login/route.test.ts`

Spec reference: §5.1 login。Rate limit: IP 10/min + email 5/min，任一触发就 429。

- [ ] **Step 1: 写失败测试**

Write `backend/app/api/auth/login/route.test.ts`：
```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = {
  signIn: vi.fn(),
  getUserRow: vi.fn(),
  updateLastLogin: vi.fn(async () => ({ error: null })),
  consumeIp: vi.fn(async () => ({ allowed: true, retryAfterSec: 0, remaining: 9 })),
  consumeEmail: vi.fn(async () => ({ allowed: true, retryAfterSec: 0, remaining: 4 })),
};

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    auth: { signInWithPassword: mocks.signIn },
    from: (table: string) => ({
      select: () => ({ eq: () => ({ single: async () => mocks.getUserRow() }) }),
      update: () => ({ eq: async () => mocks.updateLastLogin() }),
    }),
  }),
}));

vi.mock('@/lib/rate-limit', () => ({
  getLimiter: (name: string) => ({
    consume: name === 'login-ip' ? mocks.consumeIp : mocks.consumeEmail,
  }),
  extractClientIp: () => '1.2.3.4',
}));

import { POST } from './route';

function makeReq(body: unknown) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeIp.mockResolvedValue({ allowed: true, retryAfterSec: 0, remaining: 9 });
    mocks.consumeEmail.mockResolvedValue({ allowed: true, retryAfterSec: 0, remaining: 4 });
  });

  it('401 on bad credentials', async () => {
    mocks.signIn.mockResolvedValueOnce({ data: { session: null }, error: { message: 'Invalid login credentials' } });
    const res = await POST(makeReq({ email: 'a@beva.com', password: 'wrong123' }));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('INVALID_CREDENTIALS');
  });

  it('429 when IP limit hits', async () => {
    mocks.consumeIp.mockResolvedValueOnce({ allowed: false, retryAfterSec: 30, remaining: 0 });
    const res = await POST(makeReq({ email: 'a@beva.com', password: 'x1' }));
    expect(res.status).toBe(429);
  });

  it('429 when email limit hits', async () => {
    mocks.consumeEmail.mockResolvedValueOnce({ allowed: false, retryAfterSec: 15, remaining: 0 });
    const res = await POST(makeReq({ email: 'a@beva.com', password: 'x1' }));
    expect(res.status).toBe(429);
  });

  it('200 on success returns user + session', async () => {
    mocks.signIn.mockResolvedValueOnce({
      data: {
        user: { id: 'uid-1' },
        session: { access_token: 'at', refresh_token: 'rt', expires_at: 1_700_000_000 },
      },
      error: null,
    });
    mocks.getUserRow.mockResolvedValueOnce({
      data: { id: 'uid-1', email: 'a@beva.com', display_name: '乐美林', team: 'FableGlitch', role: 'member' },
      error: null,
    });
    const res = await POST(makeReq({ email: 'a@beva.com', password: 'abcdefg1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.user.display_name).toBe('乐美林');
    expect(body.data.session.access_token).toBe('at');
    expect(mocks.updateLastLogin).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run:
```bash
npm test -- app/api/auth/login/route.test.ts
```
Expected: FAIL module not found.

- [ ] **Step 3: 实现 login/route.ts**

Write `backend/app/api/auth/login/route.ts`：
```ts
export const runtime = 'edge';

import { ok, err } from '@/lib/api-response';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { loginSchema } from '@/lib/validators';
import { getLimiter, extractClientIp } from '@/lib/rate-limit';
import type { AuthResult } from '@shared/types';

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try { body = await req.json(); }
  catch { return err('PAYLOAD_MALFORMED', 'Body must be JSON', undefined, 400); }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return err('PAYLOAD_MALFORMED', parsed.error.issues[0].message, undefined, 400);
  }
  const { email, password } = parsed.data;

  const ip = extractClientIp(req);
  const ipRl = await getLimiter('login-ip').consume(ip);
  if (!ipRl.allowed) {
    const res = err('RATE_LIMITED', 'Too many login attempts (IP)', undefined, 429);
    res.headers.set('retry-after', String(ipRl.retryAfterSec));
    return res;
  }
  const emailRl = await getLimiter('login-email').consume(email);
  if (!emailRl.allowed) {
    const res = err('RATE_LIMITED', 'Too many login attempts (email)', undefined, 429);
    res.headers.set('retry-after', String(emailRl.retryAfterSec));
    return res;
  }

  const admin = supabaseAdmin();
  const { data: signIn, error: signInErr } = await admin.auth.signInWithPassword({ email, password });
  if (signInErr || !signIn.session || !signIn.user) {
    return err('INVALID_CREDENTIALS', 'Email or password is wrong', undefined, 401);
  }

  const { data: userRow, error: rowErr } = await admin
    .from('users').select('id,email,display_name,team,role').eq('id', signIn.user.id).single();
  if (rowErr || !userRow) {
    return err('INTERNAL_ERROR', 'User row missing', undefined, 500);
  }

  // Touch last_login_at (ignore failure — non-critical)
  await admin.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', signIn.user.id);

  const result: AuthResult = {
    user: {
      id: userRow.id,
      email: userRow.email,
      display_name: userRow.display_name,
      team: userRow.team,
      role: userRow.role as 'member' | 'admin',
    },
    session: {
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
      expires_at: signIn.session.expires_at ?? 0,
    },
  };
  return ok(result, 200);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run:
```bash
npm test -- app/api/auth/login/route.test.ts
```
Expected: 4 passed.

- [ ] **Step 5: 本地真机冒烟**

Run（接续 Task 13 创建的 `smoke@beva.com`）:
```bash
curl -sS -X POST http://localhost:3001/api/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"smoke@beva.com","password":"test1234"}'
```
Expected: 200 返回 user + session。改错密码应 401。

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/auth/login/
git commit -m "feat(backend): POST /api/auth/login with dual rate limit"
```

---

## Task 15: POST /api/auth/refresh

**Files:**
- Create: `backend/app/api/auth/refresh/route.ts`
- Create: `backend/app/api/auth/refresh/route.test.ts`

Spec reference: §5.1 refresh。Supabase refresh_token 滚动——新 token 返回，老 token 失效。

- [ ] **Step 1: 写失败测试**

Write `backend/app/api/auth/refresh/route.test.ts`：
```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = { refresh: vi.fn() };
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({ auth: { refreshSession: mocks.refresh } }),
}));

import { POST } from './route';

function makeReq(body: unknown) {
  return new Request('http://localhost/api/auth/refresh', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/refresh', () => {
  beforeEach(() => vi.clearAllMocks());

  it('400 on empty refresh_token', async () => {
    const res = await POST(makeReq({ refresh_token: '' }));
    expect(res.status).toBe(400);
  });

  it('401 on invalid refresh_token', async () => {
    mocks.refresh.mockResolvedValueOnce({ data: { session: null }, error: { message: 'expired' } });
    const res = await POST(makeReq({ refresh_token: 'bad' }));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('200 on success returns new access + refresh', async () => {
    mocks.refresh.mockResolvedValueOnce({
      data: {
        session: { access_token: 'new-at', refresh_token: 'new-rt', expires_at: 1_700_000_500 },
      },
      error: null,
    });
    const res = await POST(makeReq({ refresh_token: 'old-rt' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      data: { access_token: 'new-at', refresh_token: 'new-rt', expires_at: 1_700_000_500 },
    });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run:
```bash
npm test -- app/api/auth/refresh/route.test.ts
```
Expected: FAIL, module not found.

- [ ] **Step 3: 实现 refresh/route.ts**

Write `backend/app/api/auth/refresh/route.ts`：
```ts
export const runtime = 'edge';

import { ok, err } from '@/lib/api-response';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { refreshSchema } from '@/lib/validators';

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try { body = await req.json(); }
  catch { return err('PAYLOAD_MALFORMED', 'Body must be JSON', undefined, 400); }

  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) {
    return err('PAYLOAD_MALFORMED', parsed.error.issues[0].message, undefined, 400);
  }

  const { data, error } = await supabaseAdmin().auth.refreshSession({
    refresh_token: parsed.data.refresh_token,
  });
  if (error || !data.session) {
    return err('INVALID_REFRESH_TOKEN', 'Refresh token invalid or expired', undefined, 401);
  }

  return ok({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at ?? 0,
  });
}
```

- [ ] **Step 4: 跑测试确认通过**

Run:
```bash
npm test -- app/api/auth/refresh/route.test.ts
```
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/auth/refresh/
git commit -m "feat(backend): POST /api/auth/refresh with rolling refresh token"
```

---

## Task 16: POST /api/auth/logout

**Files:**
- Create: `backend/app/api/auth/logout/route.ts`
- Create: `backend/app/api/auth/logout/route.test.ts`

Spec reference: §5.1 logout。调用 Supabase `auth.admin.signOut(user_id, 'global')` 撤销所有会话。

- [ ] **Step 1: 写失败测试**

Write `backend/app/api/auth/logout/route.test.ts`：
```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = { getUser: vi.fn(), signOut: vi.fn() };
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    auth: {
      getUser: mocks.getUser,
      admin: { signOut: mocks.signOut },
    },
  }),
}));

import { POST } from './route';

function makeReq(body: unknown) {
  return new Request('http://localhost/api/auth/logout', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/logout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 even for unknown token (idempotent)', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'no user' } });
    const res = await POST(makeReq({ refresh_token: 'anything' }));
    expect(res.status).toBe(200);
  });

  it('calls signOut with user id + global scope', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: 'uid-9' } }, error: null });
    mocks.signOut.mockResolvedValueOnce({ error: null });
    const res = await POST(makeReq({ refresh_token: 'rt' }));
    expect(res.status).toBe(200);
    expect(mocks.signOut).toHaveBeenCalledWith('uid-9', 'global');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run:
```bash
npm test -- app/api/auth/logout/route.test.ts
```
Expected: FAIL.

- [ ] **Step 3: 实现 logout/route.ts**

Write `backend/app/api/auth/logout/route.ts`：
```ts
export const runtime = 'edge';

import { ok, err } from '@/lib/api-response';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logoutSchema } from '@/lib/validators';

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try { body = await req.json(); }
  catch { return err('PAYLOAD_MALFORMED', 'Body must be JSON', undefined, 400); }

  const parsed = logoutSchema.safeParse(body);
  if (!parsed.success) {
    return err('PAYLOAD_MALFORMED', parsed.error.issues[0].message, undefined, 400);
  }

  // Resolve user from refresh_token by asking Supabase to identify the session owner.
  // Note: supabase-js v2 can map a refresh token back to a user via getUser(refresh_token).
  // If that fails, logout is still idempotent — we just return ok.
  const admin = supabaseAdmin();
  const { data } = await admin.auth.getUser(parsed.data.refresh_token);
  const userId = data.user?.id;
  if (userId) {
    await admin.auth.admin.signOut(userId, 'global').catch(() => {});
  }
  return ok({});
}
```

- [ ] **Step 4: 跑测试确认通过**

Run:
```bash
npm test -- app/api/auth/logout/route.test.ts
```
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/auth/logout/
git commit -m "feat(backend): POST /api/auth/logout (idempotent, global signOut)"
```

---

## Task 17: GET /api/auth/me

**Files:**
- Create: `backend/app/api/auth/me/route.ts`
- Create: `backend/app/api/auth/me/route.test.ts`

Spec reference: §5.1 me。

- [ ] **Step 1: 写失败测试**

Write `backend/app/api/auth/me/route.test.ts`：
```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = { getUser: vi.fn(), selectSingle: vi.fn() };

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => mocks.selectSingle() }) }),
    }),
  }),
}));

import { GET } from './route';

describe('GET /api/auth/me', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 without Bearer token', async () => {
    const res = await GET(new Request('http://localhost/api/auth/me'));
    expect(res.status).toBe(401);
  });

  it('401 with bad token', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'bad' } });
    const res = await GET(new Request('http://localhost/api/auth/me', {
      headers: { authorization: 'Bearer bad-token' },
    }));
    expect(res.status).toBe(401);
  });

  it('200 with valid token returns user row', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: { id: 'uid-9', email: 'x@beva.com' } }, error: null,
    });
    mocks.selectSingle.mockResolvedValueOnce({
      data: { id: 'uid-9', email: 'x@beva.com', display_name: '林', team: 'FableGlitch', role: 'member' },
      error: null,
    });
    const res = await GET(new Request('http://localhost/api/auth/me', {
      headers: { authorization: 'Bearer good-token' },
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).data.user.display_name).toBe('林');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run:
```bash
npm test -- app/api/auth/me/route.test.ts
```
Expected: FAIL.

- [ ] **Step 3: 实现 me/route.ts**

Write `backend/app/api/auth/me/route.ts`：
```ts
export const runtime = 'edge';

import { ok, err } from '@/lib/api-response';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireUser } from '@/lib/auth-guard';

export async function GET(req: Request): Promise<Response> {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const { data, error } = await supabaseAdmin()
    .from('users').select('id,email,display_name,team,role').eq('id', auth.user_id).single();
  if (error || !data) {
    return err('INTERNAL_ERROR', 'User row missing', undefined, 500);
  }

  return ok({
    user: {
      id: data.id,
      email: data.email,
      display_name: data.display_name,
      team: data.team,
      role: data.role,
    },
  });
}
```

- [ ] **Step 4: 跑测试确认通过**

Run:
```bash
npm test -- app/api/auth/me/route.test.ts
```
Expected: 3 passed.

- [ ] **Step 5: 全量测试**

Run:
```bash
npm test
```
Expected：所有测试通过，**无跳过、无 failed**。

- [ ] **Step 6: 真机联动冒烟**（跑完 signup/login/refresh/logout 完整链路）

Run:
```bash
cd D:/VideoAPP/backend
npm run dev
# new terminal
SMOKE_EMAIL="smoke2@beva.com"
SMOKE_PW="test1234"

# signup
curl -sS -X POST http://localhost:3001/api/auth/signup \
  -H "content-type: application/json" \
  -d "{\"email\":\"$SMOKE_EMAIL\",\"password\":\"$SMOKE_PW\",\"display_name\":\"冒烟\"}" \
  | tee /tmp/signup.json

# login
LOGIN=$(curl -sS -X POST http://localhost:3001/api/auth/login \
  -H "content-type: application/json" \
  -d "{\"email\":\"$SMOKE_EMAIL\",\"password\":\"$SMOKE_PW\"}")
echo "$LOGIN"
ACCESS=$(echo "$LOGIN" | python -c "import sys,json;print(json.load(sys.stdin)['data']['session']['access_token'])")
REFRESH=$(echo "$LOGIN" | python -c "import sys,json;print(json.load(sys.stdin)['data']['session']['refresh_token'])")

# me
curl -sS http://localhost:3001/api/auth/me -H "authorization: Bearer $ACCESS"

# refresh
curl -sS -X POST http://localhost:3001/api/auth/refresh \
  -H "content-type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH\"}"

# logout
curl -sS -X POST http://localhost:3001/api/auth/logout \
  -H "content-type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH\"}"
```
Expected: signup 201; login 200 返回 tokens; me 200 返回 user; refresh 200 返回新 tokens; logout 200。

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/auth/me/
git commit -m "feat(backend): GET /api/auth/me returns current user row"
```

---

## Task 18: Vercel preview 部署 + 冒烟

**Files:**
- Create: `backend/vercel.json`（runtime 配置）
- Modify: `backend/.env.example`（补注释）

- [ ] **Step 1: 创建 Vercel 项目配置**

Write `backend/vercel.json`：
```json
{
  "framework": "nextjs",
  "regions": ["hnd1"],
  "buildCommand": "next build",
  "installCommand": "npm install"
}
```

- [ ] **Step 2: 乐美林侧预置（人工步骤，Codex 无法自动化）**

在 `D:\VideoAPP\docs\superpowers\plans\2026-04-24-p0a-operator-checklist.md` 写下运维指令：
```md
# P0-A 运维接入清单（乐美林手动）

部署前必做：
1. Supabase：创建生产 project；在 Auth 设置中 **关闭** email confirmations；记下 URL / service key / anon key / JWT secret
2. Upstash：创建 Redis database（免费 tier 足够）；记下 REST URL + REST Token
3. GitHub：创建 organization `fableglitch` + 私有仓库 `asset-library`（只要一个初始 commit 就行）；用 `fableglitch-bot@beva.com` 新注册账号并生成 classic PAT (scope: repo)
4. Cloudflare R2：创建 bucket `fableglitch-assets`；生成 R2 API Token（Object Read+Write）
5. Vercel：import GitHub 仓库，Root Directory 设为 `backend`，按 §9.B 清单填入所有环境变量

部署：
6. 把代码推到 GitHub `main` 分支——Vercel 自动跑首次 preview build
7. 若 build 失败：在 Vercel dashboard 查看 log 定位（常见：env 缺失、migration 未 apply）

冷启动 migrations：
8. 本地运行 `npx supabase link --project-ref <生产 ref>` + `npx supabase db push`——把本地 4 个 migration 推到生产
9. 生产 DB 跑一次 `seed.sql`（用 Supabase SQL Editor 直接贴入执行）
10. 验证：Studio 里能看到 `asset_types` 12 行
```

- [ ] **Step 3: 手动部署（乐美林在 Vercel 把 env 填全后触发）**

Expected：Vercel preview URL（如 `fableglitch-backend-git-main-xxx.vercel.app`）能 200 返回 `FableGlitch backend online.`。

- [ ] **Step 4: 远程冒烟 5 个 auth 路由**

同 Task 17 Step 6，但 base URL 换成 Vercel preview URL，并用一个真 `@beva.com` 测试邮箱。

Expected：signup / login / me / refresh / logout 全部返回 2xx。

- [ ] **Step 5: Commit + 打 tag**

```bash
cd D:/VideoAPP
git add backend/vercel.json docs/superpowers/plans/2026-04-24-p0a-operator-checklist.md
git commit -m "chore(backend): Vercel config + operator onboarding checklist"
git tag p0a-complete
```

**P0-A 完成判定**：所有 vitest 通过 + Vercel preview 上 5 个 auth endpoint 冒烟通过。

---

## 后续衔接

P0-A 完成后，并行两条轨道：
- **P0-B（后端资产流）**：规划新增 `lib/filename-resolver.ts` / `lib/github.ts` / `lib/r2.ts` / `lib/idempotency.ts`、episodes / assets / usage 路由。单独出一份 plan。
- **P0-C（前端外壳）**：只依赖本计划产出的 API 形状（signup/login/refresh/logout/me），可以立即动工。单独出一份 plan。

当本计划的 Vercel preview URL 稳定后，前端 `.env.local` 可指向它联调。

---

## 附：测试层级说明

- **Unit tests**（本计划全部是这类）：Mock Supabase admin client，不跑真实 DB。快、CI 友好。
- **Integration tests**（推荐 P0-B 引入）：起 `supabase start`，用 service key 跑真实 SQL + 路由，验证 RLS 不破、migration 幂等。跑在 `vitest.integration.config.ts` 隔离配置下。

P0-A 不引入 integration test 层，因为 auth 路由的复杂度在 validator + rate limit + Supabase API 调用组合，mock 足够覆盖；真实 DB 的 RLS 验证放 P0-B 一起做更划算。
