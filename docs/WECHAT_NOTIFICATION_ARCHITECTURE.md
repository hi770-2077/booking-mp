# 微信生态通知架构 - 完整方案

> 本文档说明如何在现有的预约系统中接入微信生态通知，包括：
> - 顾客侧：小程序订阅消息 / 公众号模板消息
> - 店员侧：公众号模板消息 / 企业微信
> - 管理员侧：unionid 关联绑定

---

## 🎯 整体架构

```
┌──────────────────────────────────────────────────────────────────┐
│  小程序端（现有 booking-mp）                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ 预约流程      │  │ 订阅授权      │  │ 店员绑定      │          │
│  │  (已实现)     │  │ (前端发起)   │  │ (扫码进入)   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                  │
│         ↓ HTTP            ↓ 凭证上报          ↓ openid+unionid   │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          ↓                  ↓                  ↓
┌──────────────────────────────────────────────────────────────────┐
│  云函数 / 后端服务（待部署）                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ 预约 API     │  │ 消息队列      │  │ 通知调度      │          │
│  │  (CRUD)      │  │  (1h/30m)    │  │  (定时触发)   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         ↓                  ↓                  ↓                  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │ 微信 API 适配层                                          │       │
│  │  - sendSubscribeMessage()   (小程序订阅消息)            │       │
│  │  - sendOfficialTplMsg()    (公众号模板消息)            │       │
│  │  - sendEnterpriseWechat()  (企业微信)                  │       │
│  │  - sendMiniCustomerMsg()   (小程序客服消息)            │       │
│  └──────┬───────────────────────┬───────────────────────┘       │
└─────────┼───────────────────────┼───────────────────────────────┘
          ↓                       ↓
┌──────────────────┐    ┌──────────────────┐
│  微信小程序服务器  │    │  微信公众号服务器  │
│  (订阅消息 API)   │    │  (模板消息 API)   │
└──────────────────┘    └──────────────────┘
```

---

## 📦 必须的后端模块（按优先级）

### 1. **消息调度中心**（最重要）

定时扫描数据库，找出"距离预约时间还有 1 小时"和"还有 30 分钟"的预约，调用微信 API 发送。

```typescript
// cloud-functions/scheduler/index.ts
// 定时触发器：每 5 分钟执行一次
export const main = async (event, context) => {
  const now = Date.now();
  const HOUR_1 = 60 * 60 * 1000;
  const MIN_30 = 30 * 60 * 1000;

  // 查询需要发送 1 小时提醒的预约
  const reminders1h = await db.collection('bookings').where({
    startTimestamp: db.command.gt(now + HOUR_1 - 5 * 60 * 1000)
                     .and(db.command.lt(now + HOUR_1 + 5 * 60 * 1000)),
    status: 'confirmed',
    notified1h: false,
  }).get();

  for (const booking of reminders1h.data) {
    await sendSubscribeMessage(booking.phone, '1h_reminder', {
      time: booking.startTime,
      service: booking.service,
      store: booking.storeName,
    });
    await db.collection('bookings').doc(booking._id).update({
      notified1h: true,
    });
  }

  // 30分钟同理
  // ...
};
```

### 2. **顾客订阅凭证存储**

前端 `requestSubscribeMessage` 拿到用户授权后，把 `{openid, tmplId, acceptedAt}` 上报到后端，后端入库。

```sql
CREATE TABLE subscribe_auth (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  openid VARCHAR(64) NOT NULL,
  tmpl_id VARCHAR(64) NOT NULL,
  accepted_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,  -- 用户授权有时效，过期需重新授权
  UNIQUE KEY uk_openid_tmpl (openid, tmpl_id)
);
```

### 3. **店员绑定表**

```sql
CREATE TABLE staff (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(64),
  store_id VARCHAR(32),
  mini_openid VARCHAR(64),   -- 小程序 openid
  mp_unionid VARCHAR(64),    -- 公众号 unionid (用于跨平台通知)
  mp_openid VARCHAR(64),     -- 公众号 openid (用于发模板消息)
  phone VARCHAR(20),
  role ENUM('admin', 'staff') DEFAULT 'staff',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 4. **公众号模板消息发送**

```typescript
// 后端 - 公众号 access_token 管理
let accessToken = '';
let tokenExpireAt = 0;

async function getMpAccessToken() {
  if (Date.now() < tokenExpireAt) return accessToken;
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${MP_APPID}&secret=${MP_SECRET}`;
  const res = await fetch(url).then(r => r.json());
  accessToken = res.access_token;
  tokenExpireAt = Date.now() + (res.expires_in - 200) * 1000;
  return accessToken;
}

async function sendOfficialTplMsg(openid, tmplId, data, url) {
  const token = await getMpAccessToken();
  return fetch(`https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${token}`, {
    method: 'POST',
    body: JSON.stringify({
      touser: openid,
      template_id: tmplId,
      data,
      url,
    }),
  });
}
```

---

## 🔧 接入方案对比

### 方案 A：**微信云开发**（推荐，最低门槛）

| 优势 | 劣势 |
|------|------|
| 0 服务器成本，按调用付费 | 数据存在腾讯云 |
| 自带 access_token，无需自管 | 性能受限 |
| 5 分钟上手 | 锁定微信生态 |

```bash
# 开通云开发后
# 1. 上传云函数
tcb fn deploy scheduler

# 2. 设置定时触发器（云开发控制台）
#    cron: */5 * * * * (每5分钟)
```

### 方案 B：**自建服务器**（Node.js + MySQL）

适合已有服务器、想完全掌控数据。

```typescript
// 使用 node-cron
import cron from 'node-cron';
cron.schedule('*/5 * * * *', async () => {
  const due = await db.query('SELECT * FROM bookings WHERE notify_due BETWEEN ? AND ?', [
    Date.now(), Date.now() + 5 * 60 * 1000
  ]);
  for (const b of due) await sendReminder(b);
});
```

### 方案 C：**第三方推送服务**（如 Server酱、WxPusher）

适合个人开发者小项目。

---

## 📱 微信侧的前置准备

### 1. 小程序后台配置
- **订阅消息模板**：在微信公众平台 → 订阅消息 → 公共模板库 → 申请 3 个模板：
  - `预约提醒（1小时前）`：顾客姓名 + 预约项目 + 预约时间 + 门店
  - `预约提醒（30分钟前）`：同上
  - `预约成功通知`：订单号 + 时间 + 门店地址

### 2. 公众号（强烈建议申请一个服务号）
- 服务号才能发模板消息（订阅号没权限）
- 需完成微信认证（300元/年）
- 在公众平台 → 模板消息 → 添加模板（如：新预约通知店员）

### 3. unionid 关联
- 在微信开放平台绑定小程序 + 公众号（同一主体）
- 顾客在小程序和公众号都登录后，会得到相同的 unionid
- 借此判断"是不是同一个人"

---

## 👥 店员通知完整流程

```
1. 管理员在后台生成"店员绑定码"
   → 调用 wxacode.getUnlimited API 生成小程序码（scene=staff_<staff_id>）

2. 店员扫码 → 进入小程序（携带 scene 参数）
   → 自动跳转到 /pages/bind/staff?scene=staff_xxx
   → wx.login() 获取 openid + unionid
   → 上报后端：POST /staff/bind { staff_id, openid, unionid }

3. 顾客下单 → 后端创建预约
   → 查找该门店所有 staff 的 openid
   → 调用 sendOfficialTplMsg(openid, 'newBookingTmpl', data)
   → 店员微信收到"新预约通知"

4. 店员想回复顾客？
   → 在公众号菜单跳回小程序 → 调起客服会话
   → 用 sendMiniCustomerMsg API 主动联系（限48小时窗口）
```

---

## 🚀 我推荐的分步实施

| 步骤 | 工作量 | 价值 | 优先级 |
|------|--------|------|--------|
| ✅ **Step 1：前端订阅授权 UI**（已完成） | 0.5 天 | 用户授权一次后保留凭证 | ⭐⭐⭐ |
| ⏳ **Step 2：部署云函数 + 定时触发** | 1 天 | 自动发送提醒 | ⭐⭐⭐ |
| ⏳ **Step 3：申请公众号 + 模板消息** | 2 天 | 店员接收通知 | ⭐⭐ |
| ⏳ **Step 4：unionid 关联** | 1 天 | 跨平台识别用户 | ⭐⭐ |
| ⏳ **Step 5：企业微信接入**（可选） | 3 天 | 多店员管理 | ⭐ |

---

## ❓ 现实限制说明

| 微信官方限制 | 影响 |
|-------------|------|
| **订阅消息**必须用户主动订阅 | 不能"轰炸式"通知，每次需用户点 |
| 一次性订阅只能发 1 条 | 1h 和 30m 是两次订阅 |
| 长期订阅仅特定类目 | 美业/化妆没有长期订阅权限 |
| 服务号模板消息每月配额有限 | 4次/用户/模板 |
| 公众号 + 小程序必须同主体 | 个人主体无法做跨平台 |
| access_token 不能放到前端 | 必须有后端 |

---

## 💡 我的建议

**最低成本起步**（500元以内/年）：
1. ✅ 前端订阅授权 UI（已完成）
2. 开通微信云开发（免费额度足够用很久）
3. 申请 3 个订阅消息模板（免费）
4. 写 1 个云函数做定时调度（半天）

**完整方案**（如果业务增长）：
- 注册服务号（认证费 300/年）+ 申请店员模板消息
- 后端切换到自建 Node.js + MySQL
- 接入企业微信（多店员管理）

---

## 📞 附录：现成的参考实现

如果想快，可以参考以下开源项目：
- **WxPusher**（个人微信推送，零成本起步）
- **WxJava**（Java 公众号 SDK）
- **wechaty**（Node.js 微信机器人框架）
- **云开发模板**：「预约管理」类目下有官方示例

---

## ✅ 当前进度

- [x] 前端订阅授权 UI（`requestSubscribeMessage`）
- [x] 手机号一键获取接口封装（`handleGetPhoneNumber`）
- [x] 微信登录获取 openid 流程封装（`wxLogin`）
- [x] 店员扫码绑定流程封装（`bindStaffByCode`）
- [x] 订阅凭证本地持久化（`saveSubscribeAuth`）
- [ ] 云函数部署（需在微信开发者工具 → 云开发）
- [ ] 公众号申请 + 模板申请
- [ ] access_token 缓存服务