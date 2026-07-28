# 🚀 Vercel 一键部署指南（潇洒佳人预约系统）

> 这是你之前已经熟悉的部署方式（Vite + 静态 HTML5）
> 现在加了 Serverless Functions 后端，**整体依然保持 1 条命令部署**

---

## 📦 项目结构

```
booking-mp/
├── src/                    # 前端 (Taro + React)
├── api/                    # 后端 Serverless Functions ← 新增
│   ├── wechat-mp.ts        # 微信登录 / 通知 / 店员绑定
│   └── scheduler.ts        # 定时调度（每5分钟）
├── docs/                   # 文档
├── vercel.json             # Vercel 配置
├── package.json
└── dist/                   # Taro 构建产物（自动生成）
```

---

## 🎯 5 步完成部署

### Step 1: 安装 Vercel CLI
```bash
npm install -g vercel
```

### Step 2: 登录 Vercel
```bash
vercel login
# 会跳浏览器，让你用 GitHub/GitLab/Email 登录
```

### Step 3: 在 Vercel 后台配置环境变量

打开 https://vercel.com/dashboard → 你的项目 → Settings → Environment Variables

添加以下 5 个变量（值从你的微信公众平台后台获取）：

| 变量名 | 值来源 | 示例 |
|--------|--------|------|
| `MP_APPID` | 服务号 → 基本配置 | `wx1234567890abcdef` |
| `MP_SECRET` | 服务号 → 基本配置 → 重置后复制 | `a1b2c3d4e5f6...` |
| `MINI_APPID` | 小程序后台 → 开发设置 | `wx75c67a79820b9a4f` |
| `MINI_SECRET` | 小程序后台 → 开发设置 | `f6e5d4c3b2a1...` |
| `STAFF_TMPL_ID` | 服务号 → 模板消息 → 模板 ID | `xSAbook_staff_new_xxx` |
| `CRON_SECRET` | 自己生成一个 | `b3f9d2k4m6n8...` |

### Step 4: 一键部署
```bash
cd /home/shun/TRAE/output/2026-07-28/代码/booking-mp

# 首次部署（会让你确认项目名/配置）
npm run deploy:vercel-preview

# 或直接生产部署
npm run deploy:vercel
```

### Step 5: 部署完成！
你会得到一个 URL，类似：
```
✅ Production: https://booking-mp-xxxx.vercel.app
```

---

## 🔧 部署后需要做的事

### 1. 给小程序配置业务域名
```
微信小程序后台 → 开发管理 → 开发设置 → 服务器域名
→ 添加：https://booking-mp-xxxx.vercel.app
→ request合法域名 / uploadFile合法域名
```

### 2. 给服务号配置回调
```
微信公众平台 → 设置 → 公众号设置 → 功能设置
→ 网页授权域名：booking-mp-xxxx.vercel.app
```

### 3. 测试接口
```bash
# 测试服务是否正常
curl https://booking-mp-xxxx.vercel.app/api/wechat-mp

# 测试定时任务（手动触发）
curl -H "Authorization: Bearer b3f9d2k4m6n8..." \
     https://booking-mp-xxxx.vercel.app/api/scheduler
```

---

## 📊 已部署的接口

| 接口 | 用途 |
|------|------|
| `POST /api/wechat-mp` | 微信登录 / 手机号解密 / 订阅保存 / 店员绑定 / 通知店员 / 创建预约 |
| `GET  /api/wxacode?scene=staff_<id>` | 生成店员绑定小程序码 |
| `POST /api/scheduler` | 定时调度（自动每 5 分钟） |

---

## 🎁 升级到生产环境（可选）

免费版 Vercel 每月有 100 GB 流量 + 100 万次函数调用。对于一个美业门店完全够用。

如果以后要：
- **数据库**：加 Vercel KV / Postgres（同样免费额度）
- **CDN**：Vercel 默认全球 CDN
- **自定义域名**：在 Settings → Domains 添加你的域名

---

## ⚠️ 注意事项

1. **每次改代码后**：
   ```bash
   git add .
   git commit -m "feat: xxx"
   git push            # 如果绑定了 GitHub，自动部署
   # 或者
   vercel --prod       # 命令行部署
   ```

2. **小程序上传密钥**（不是 Vercel 用）：
   你已经有 `/home/shun/微信小程序上传密钥/private.wx75c67a79820b9a4f.key`
   用于微信开发者工具上传小程序代码到微信服务器，跟 Vercel 无关

3. **数据持久化**：
   - 当前 `api/wechat-mp.ts` 用的是内存 Map，**重启会清空**
   - 演示用 OK，正式用请加 Vercel KV / Postgres
   - 我们也已经在前端用 localStorage 存了预约，**前后端双重存储**

---

## 🎯 下一步

| 序号 | 操作 | 时间 |
|------|------|------|
| ① | 注册 / 登录 Vercel | 1 分钟 |
| ② | GitHub 创建仓库并 push 代码 | 2 分钟 |
| ③ | Vercel 导入 GitHub 仓库 | 1 分钟 |
| ④ | 配置 6 个环境变量 | 2 分钟 |
| ⑤ | 部署 → 拿到 vercel.app URL | 自动 |
| ⑥ | 小程序后台配置业务域名 | 1 分钟 |
| ⑦ | 微信开发者工具上传小程序代码 | 5 分钟 |

**总计：15 分钟部署完成**

---

## 💡 为什么选 Vercel 而不是别的？

| 平台 | 优点 | 缺点 | 适合你吗？ |
|------|------|------|-----------|
| **Vercel** | Vite 原生支持 / 免费 / Serverless | 需要科学上网 | ✅ |
| Cloudflare Pages | 全球 CDN / 同样免费 | 配置稍复杂 | ⚠️ |
| 微信云开发 | 和小程序无缝 | 新平台，要学 | ⚠️ |
| 自建服务器 | 完全掌控 | 你没有公网 IP | ❌ |

你之前用 Vite 部署过，**这次 Vercel 就是最熟悉的味道**。

---

## 📞 联系方式 / 进阶

部署出问题？截图给我看错误信息。
需要进阶功能（数据库 / 自动同步 / 推送）？我可以继续加。

🔗 当前项目路径：`/home/shun/TRAE/output/2026-07-28/代码/booking-mp`