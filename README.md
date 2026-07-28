# 潇洒佳人美学空间预约系统

> 一个完整的微信小程序预约系统 + Vercel Serverless 后端

## 🎯 功能

- 🎨 优雅的酒红色 + 金色半圆拱形设计
- 📅 完整预约流程（选项目 → 选日期 → 选时段 → 填资料）
- ⏰ 时段容量管理（每个时段可配置预约人数）
- 👤 超级管理员后台（批量管理、批量复制、批量修改）
- 📱 手机号簿（一键填充常用手机号）
- 🔔 提醒通知（预约前 1 小时 / 30 分钟）
- 💬 微信生态对接（订阅消息 + 服务号模板消息）

## 🚀 快速开始

### 本地开发

```bash
# 安装依赖
npm install --legacy-peer-deps

# 编译小程序（推荐用开发者工具打开 dist 目录）
npm run dev:weapp

# 编译 H5（用于 Web 测试）
npm run build:h5
```

### 部署到 Vercel

```bash
# 一键部署脚本
./deploy-vercel.sh prod
```

详细文档：[docs/VERCEL_DEPLOY_GUIDE.md](docs/VERCEL_DEPLOY_GUIDE.md)

## 📂 项目结构

```
booking-mp/
├── src/                      # 前端 (Taro + React + TypeScript)
│   ├── pages/                # 页面
│   │   ├── index/            # 首页（套餐列表 + 选择时段）
│   │   ├── admin/            # 超级管理员后台
│   │   └── ...
│   ├── components/           # 公共组件
│   ├── services/             # 业务服务
│   ├── store/                # Zustand 状态管理
│   ├── types/                # TypeScript 类型
│   └── utils/                # 工具函数
├── api/                      # Vercel Serverless 后端
│   ├── wechat-mp.ts          # 微信 API 代理
│   └── scheduler.ts          # 定时调度
├── docs/                     # 文档
│   ├── VERCEL_DEPLOY_GUIDE.md
│   └── WECHAT_NOTIFICATION_ARCHITECTURE.md
├── server/                   # 备用 Node.js 后端
├── dist/                     # 构建产物
└── vercel.json               # Vercel 配置
```

## 🔧 环境变量

部署到 Vercel 时需要配置：

| 变量 | 说明 |
|------|------|
| `MP_APPID` | 微信公众号 AppID |
| `MP_SECRET` | 微信公众号 AppSecret |
| `MINI_APPID` | 小程序 AppID |
| `MINI_SECRET` | 小程序 AppSecret |
| `STAFF_TMPL_ID` | 店员通知模板 ID |
| `REMINDER_1H_TMPL` | 1小时提醒模板 ID |
| `REMINDER_30M_TMPL` | 30分钟提醒模板 ID |
| `CRON_SECRET` | 定时任务密钥（自己生成） |

## 📖 文档

- [Vercel 部署指南](docs/VERCEL_DEPLOY_GUIDE.md)
- [微信通知架构](docs/WECHAT_NOTIFICATION_ARCHITECTURE.md)

## 📜 License

Copyright © 2026 潇洒佳人美学空间