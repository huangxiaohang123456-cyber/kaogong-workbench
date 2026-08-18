# 考公 / 考编备考工作台（React 全栈版）

真正的「前端 React + 后端 Supabase（Auth + RLS 权限隔离）」多端应用。
链接发出去，朋友各自注册即用、数据完全隔离；自己换设备登录即同步。

## 技术栈
- 前端：React 18 + Vite 5
- 后端：Supabase（Postgres + Auth 邮箱密码 + RLS 行级权限隔离）
- 部署：Vercel（通过 GitHub 自动部署）

## 本地开发
```bash
npm install
cp .env.example .env   # 填入你的 Supabase URL / anon key
npm run dev            # http://localhost:5173
npm run build          # 产出 dist/
```

## Supabase 配置（一次性）
1. 后台 → SQL Editor 执行 `supabase/schema.sql`（建表 + 权限隔离）
2. Authentication → Providers → Email → 关闭 **Confirm email**（注册即登录）
3. Authentication → URL Configuration → 把你的站点域名加入 **Redirect URLs**（忘记密码回链用）

## 部署到 Vercel
1. 把本仓库推到 GitHub
2. 打开 https://vercel.com → Import 该仓库 → Deploy
3. 在 Vercel 项目 Settings → Environment Variables 添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. 重新 Deploy 即可拿到公开网址
