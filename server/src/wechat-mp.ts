/**
 * 微信公众号 + 小程序双端通知服务
 * 部署到：微信云开发 / Node.js 服务器 / Vercel / 任何 Node 环境
 *
 * 路由列表：
 *   POST /api/auth/wx-login        小程序登录，换 openid
 *   POST /api/subscribe/save       保存用户订阅授权
 *   POST /api/staff/bind           店员扫码绑定
 *   POST /api/notify/staff         通知所有店员（新预约）
 *   POST /api/notify/customer      通知顾客（取消等）
 *   GET  /api/wxacode/staff/:id    生成店员绑定小程序码
 *
 * 定时任务（云函数）：
 *   scheduler  每 5 分钟扫描，发送预约提醒
 */

import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import dayjs from 'dayjs';

// ============ 配置 ============
// 替换成你的真实值（生产环境用环境变量）
const CONFIG = {
  MP_APPID: process.env.MP_APPID || 'wx_MP_APPID_HERE',
  MP_SECRET: process.env.MP_SECRET || 'mp_secret_here',
  MINI_APPID: process.env.MINI_APPID || 'wx_MINI_APPID_HERE',
  MINI_SECRET: process.env.MINI_SECRET || 'mini_secret_here',
  STAFF_TMPL_ID: process.env.STAFF_TMPL_ID || 'tmpl_staff_new_booking',
  CUSTOMER_CANCEL_TMPL_ID: process.env.CUSTOMER_CANCEL_TMPL_ID || 'tmpl_customer_cancel',
};

// ============ 内存缓存（生产用 Redis） ============
let accessTokenCache = { token: '', expiresAt: 0 };

async function getMpAccessToken(): Promise<string> {
  if (Date.now() < accessTokenCache.expiresAt && accessTokenCache.token) {
    return accessTokenCache.token;
  }
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${CONFIG.MP_APPID}&secret=${CONFIG.MP_SECRET}`;
  const res = await axios.get(url);
  if (res.data.errcode) throw new Error(`MP token error: ${res.data.errmsg}`);
  accessTokenCache = {
    token: res.data.access_token,
    expiresAt: Date.now() + (res.data.expires_in - 200) * 1000,
  };
  return accessTokenCache.token;
}

// 小程序 access_token 单独缓存（用途不同）
let miniTokenCache = { token: '', expiresAt: 0 };
async function getMiniAccessToken(): Promise<string> {
  if (Date.now() < miniTokenCache.expiresAt && miniTokenCache.token) {
    return miniTokenCache.token;
  }
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${CONFIG.MINI_APPID}&secret=${CONFIG.MINI_SECRET}`;
  const res = await axios.get(url);
  if (res.data.errcode) throw new Error(`Mini token error: ${res.data.errmsg}`);
  miniTokenCache = {
    token: res.data.access_token,
    expiresAt: Date.now() + (res.data.expires_in - 200) * 1000,
  };
  return miniTokenCache.token;
}

// ============ 数据存储（生产用 MySQL/PostgreSQL）============
interface Booking {
  id: string;
  openid?: string;
  phone: string;
  customerName?: string;
  storeId: string;
  service: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  notify1hAt?: number;
  notify30mAt?: number;
  notified1h: boolean;
  notified30m: boolean;
  createdAt: number;
}

interface Staff {
  id: string;
  name: string;
  storeId: string;
  role: 'admin' | 'staff';
  miniOpenid?: string;   // 小程序 openid
  mpOpenid?: string;     // 公众号 openid
  unionid?: string;      // 跨平台唯一 ID
  phone?: string;
  bound: boolean;        // 是否已扫码绑定
  createdAt: number;
}

interface SubscribeAuth {
  openid: string;
  tmplId: string;
  acceptedAt: number;
  expiresAt: number;
}

// === 内存数据库（演示用，生产请用真实数据库）===
const db = {
  bookings: new Map<string, Booking>(),
  staff: new Map<string, Staff>(),
  subscribeAuth: new Map<string, SubscribeAuth>(),
};

// 初始化演示数据
function seedDemoStaff() {
  const demoStaff: Staff[] = [
    { id: 's1', name: '小美', storeId: 'wenshan', role: 'staff', bound: false, createdAt: Date.now() },
    { id: 's2', name: '阿杰', storeId: 'wenshan', role: 'admin', bound: false, createdAt: Date.now() },
  ];
  demoStaff.forEach((s) => db.staff.set(s.id, s));
}
seedDemoStaff();

// ============ 路由实现 ============
const app = express();
app.use(express.json());

/**
 * 1. 小程序登录（前端 wx.login 后调用）
 */
app.post('/api/auth/wx-login', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code required' });

  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${CONFIG.MINI_APPID}&secret=${CONFIG.MINI_SECRET}&js_code=${code}&grant_type=authorization_code`;
  const r = await axios.get(url);
  // r.data: { openid, session_key, unionid? }
  if (r.data.errcode) {
    return res.status(400).json({ error: r.data.errmsg });
  }
  res.json({
    openid: r.data.openid,
    unionid: r.data.unionid,
    session_key: r.data.session_key,
  });
});

/**
 * 2. 解密手机号（前端 getPhoneNumber 后调用）
 */
app.post('/api/auth/decrypt-phone', async (req, res) => {
  const { encryptedData, iv, sessionKey } = req.body;
  // AES-128-CBC 解密
  const decipher = crypto.createDecipheriv(
    'aes-128-cbc',
    Buffer.from(sessionKey, 'base64'),
    Buffer.from(iv, 'base64'),
  );
  let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  const data = JSON.parse(decrypted);
  res.json({ phone: data.phoneNumber, purePhone: data.purePhoneNumber });
});

/**
 * 3. 保存订阅授权
 */
app.post('/api/subscribe/save', async (req, res) => {
  const { openid, tmplId } = req.body;
  if (!openid || !tmplId) return res.status(400).json({ error: 'missing params' });

  db.subscribeAuth.set(`${openid}_${tmplId}`, {
    openid,
    tmplId,
    acceptedAt: Date.now(),
    // 小程序一次性订阅有时效（约 30 天）
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  });
  res.json({ ok: true });
});

/**
 * 4. 店员扫码绑定
 * 流程：管理员在后台生成带 scene=staff_<id> 的小程序码
 *      店员扫码 → 小程序 wx.login → 携带 scene 进入绑定页
 *      调用此接口完成 openid+unionid 与 staff_id 关联
 */
app.post('/api/staff/bind', async (req, res) => {
  const { staffId, code } = req.body;
  const staff = db.staff.get(staffId);
  if (!staff) return res.status(404).json({ error: 'staff not found' });

  // 1. code 换 openid
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${CONFIG.MINI_APPID}&secret=${CONFIG.MINI_SECRET}&js_code=${code}&grant_type=authorization_code`;
  const r = await axios.get(url);
  if (r.data.errcode) return res.status(400).json({ error: r.data.errmsg });

  staff.miniOpenid = r.data.openid;
  staff.unionid = r.data.unionid;
  staff.bound = true;
  db.staff.set(staff.id, staff);

  res.json({
    ok: true,
    staff: { id: staff.id, name: staff.name, bound: staff.bound },
  });
});

/**
 * 5. 通知所有店员（新预约）
 */
app.post('/api/notify/staff', async (req, res) => {
  const { booking } = req.body as { booking: Booking };

  // 查找门店下所有已绑定的店员
  const storeStaff = Array.from(db.staff.values()).filter(
    (s) => s.storeId === booking.storeId && s.bound && s.mpOpenid,
  );

  const token = await getMpAccessToken();
  const results: Array<{ name: string; success: boolean; errMsg?: string }> = [];

  for (const s of storeStaff) {
    const data = {
      touser: s.mpOpenid,
      template_id: CONFIG.STAFF_TMPL_ID,
      url: `https://servicewechat.com/${CONFIG.MINI_APPID}/page/booking-detail?id=${booking.id}`,
      data: {
        first: { value: '📅 新预约提醒', color: '#59202E' },
        keyword1: { value: booking.service, color: '#000' },
        keyword2: { value: `${booking.date} ${booking.startTime}`, color: '#000' },
        keyword3: { value: booking.customerName || booking.phone, color: '#000' },
        remark: { value: '请及时确认并准备', color: '#D4B87A' },
      },
    };

    try {
      const r = await axios.post(
        `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${token}`,
        data,
      );
      results.push({ name: s.name, success: r.data.errcode === 0, errMsg: r.data.errmsg });
    } catch (e: any) {
      results.push({ name: s.name, success: false, errMsg: e.message });
    }
  }

  res.json({ ok: true, notified: results.length, results });
});

/**
 * 6. 通知顾客（取消等）
 */
app.post('/api/notify/customer', async (req, res) => {
  const { openid, message, details } = req.body;

  const data = {
    touser: openid,
    template_id: CONFIG.CUSTOMER_CANCEL_TMPL_ID,
    data: {
      first: { value: message, color: '#59202E' },
      ...details,
      remark: { value: '潇洒佳人美学空间', color: '#888' },
    },
  };

  const token = await getMpAccessToken();
  const r = await axios.post(
    `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${token}`,
    data,
  );
  res.json({ ok: r.data.errcode === 0, result: r.data });
});

/**
 * 7. 生成店员绑定小程序码
 */
app.get('/api/wxacode/staff/:staffId', async (req, res) => {
  const { staffId } = req.params;
  if (!db.staff.get(staffId)) return res.status(404).json({ error: 'staff not found' });

  const token = await getMiniAccessToken();
  const r = await axios.post(
    `https://api.weixin.qq.com/wxaapi/getwxacodeunlimit?access_token=${token}`,
    {
      scene: `staff_${staffId}`,
      page: 'pages/bind/staff',
      width: 430,
      check_path: false,
      env_version: 'release',
    },
    { responseType: 'arraybuffer' },
  );
  res.setHeader('Content-Type', 'image/png');
  res.send(r.data);
});

/**
 * 8. 预约接口（演示）
 */
app.post('/api/booking/create', async (req, res) => {
  const { phone, customerName, storeId, service, date, startTime, endTime } = req.body;
  const id = 'b' + Date.now().toString(36);

  const booking: Booking = {
    id,
    phone,
    customerName,
    storeId,
    service,
    date,
    startTime,
    endTime,
    status: 'confirmed',
    notify1hAt: new Date(`${date} ${startTime}`).getTime() - 60 * 60 * 1000,
    notify30mAt: new Date(`${date} ${startTime}`).getTime() - 30 * 60 * 1000,
    notified1h: false,
    notified30m: false,
    createdAt: Date.now(),
  };
  db.bookings.set(id, booking);

  // 异步触发店员通知（不阻塞响应）
  notifyStaffInternal(booking).catch(console.error);

  res.json({ ok: true, booking });
});

async function notifyStaffInternal(booking: Booking) {
  const storeStaff = Array.from(db.staff.values()).filter(
    (s) => s.storeId === booking.storeId && s.bound && s.mpOpenid,
  );
  if (storeStaff.length === 0) return;

  const token = await getMpAccessToken();
  for (const s of storeStaff) {
    await axios.post(
      `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${token}`,
      {
        touser: s.mpOpenid,
        template_id: CONFIG.STAFF_TMPL_ID,
        data: {
          first: { value: '📅 新预约' },
          keyword1: { value: booking.service },
          keyword2: { value: `${booking.date} ${booking.startTime}` },
          keyword3: { value: booking.customerName || booking.phone },
          remark: { value: '潇洒佳人' },
        },
      },
    );
  }
}

/**
 * 9. 定时调度（云函数定时触发 或 cron 调用）
 * POST /api/scheduler/run
 *   body: { now: timestamp }
 */
app.post('/api/scheduler/run', async (req, res) => {
  const now = req.body.now || Date.now();
  const TOLERANCE = 5 * 60 * 1000;

  const due1h = Array.from(db.bookings.values()).filter(
    (b) =>
      b.status === 'confirmed' &&
      !b.notified1h &&
      Math.abs((b.notify1hAt ?? 0) - now) < TOLERANCE,
  );
  const due30m = Array.from(db.bookings.values()).filter(
    (b) =>
      b.status === 'confirmed' &&
      !b.notified30m &&
      Math.abs((b.notify30mAt ?? 0) - now) < TOLERANCE,
  );

  const results: any = { oneHour: [], thirtyMin: [] };

  // 调用小程序订阅消息 API（需要 openid）
  const miniToken = await getMiniAccessToken();
  for (const b of due1h) {
    if (!b.openid) continue;
    const r = await axios.post(
      `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${miniToken}`,
      {
        touser: b.openid,
        template_id: 'tmpl_reminder_1h', // 你的 1h 模板 ID
        data: {
          thing1: { value: b.service },
          time2: { value: `${b.date} ${b.startTime}` },
          thing3: { value: '潇洒佳人' },
        },
      },
    );
    if (r.data.errcode === 0) {
      b.notified1h = true;
      db.bookings.set(b.id, b);
    }
    results.oneHour.push({ id: b.id, ok: r.data.errcode === 0 });
  }

  // 30分钟同理
  // ...

  res.json(results);
});

// ============ 启动 ============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.info(`🚀 服务已启动: http://localhost:${PORT}`);
  console.info('📡 微信公众号模板消息已就绪');
});

export default app;