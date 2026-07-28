/**
 * Vercel Serverless Function: 微信公众号/小程序通知服务
 * 部署路径：放项目 /api 目录下，Vercel 自动识别
 *
 * 路由：
 *   POST /api/wechat-mp             统一入口（根据 action 调用不同接口）
 *   GET  /api/wechat-mp/wxacode     生成小程序码
 *
 * 环境变量（Vercel 后台配置）：
 *   MP_APPID, MP_SECRET, MINI_APPID, MINI_SECRET, STAFF_TMPL_ID
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import crypto from 'crypto';

// ============ 配置 ============
const CONFIG = {
  MP_APPID: process.env.MP_APPID || '',
  MP_SECRET: process.env.MP_SECRET || '',
  MINI_APPID: process.env.MINI_APPID || '',
  MINI_SECRET: process.env.MINI_SECRET || '',
  STAFF_TMPL_ID: process.env.STAFF_TMPL_ID || '',
};

// ============ Token 缓存 ============
let mpTokenCache = { token: '', expiresAt: 0 };
let miniTokenCache = { token: '', expiresAt: 0 };

async function getMpToken(): Promise<string> {
  if (Date.now() < mpTokenCache.expiresAt && mpTokenCache.token) return mpTokenCache.token;
  const r = await axios.get(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${CONFIG.MP_APPID}&secret=${CONFIG.MP_SECRET}`,
  );
  if (r.data.errcode) throw new Error(`MP token: ${r.data.errmsg}`);
  mpTokenCache = { token: r.data.access_token, expiresAt: Date.now() + (r.data.expires_in - 200) * 1000 };
  return mpTokenCache.token;
}

async function getMiniToken(): Promise<string> {
  if (Date.now() < miniTokenCache.expiresAt && miniTokenCache.token) return miniTokenCache.token;
  const r = await axios.get(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${CONFIG.MINI_APPID}&secret=${CONFIG.MINI_SECRET}`,
  );
  if (r.data.errcode) throw new Error(`Mini token: ${r.data.errmsg}`);
  miniTokenCache = { token: r.data.access_token, expiresAt: Date.now() + (r.data.expires_in - 200) * 1000 };
  return miniTokenCache.token;
}

// ============ 内存数据库（Vercel KV 替代） ============
// 实际生产用 Vercel KV / Postgres / Supabase
const db = {
  bookings: new Map<string, any>(),
  staff: new Map<string, any>(),
  subscribeAuth: new Map<string, any>(),
};

// 初始化演示店员
if (db.staff.size === 0) {
  db.staff.set('s1', { id: 's1', name: '小美', storeId: 'wenshan', bound: false });
  db.staff.set('s2', { id: 's2', name: '阿杰', storeId: 'wenshan', bound: false });
}

// ============ 路由分发 ============
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.body || req.query;

  try {
    switch (action) {
      case 'wx-login':
        return await handleWxLogin(req, res);
      case 'decrypt-phone':
        return await handleDecryptPhone(req, res);
      case 'save-subscribe':
        return await handleSaveSubscribe(req, res);
      case 'staff-bind':
        return await handleStaffBind(req, res);
      case 'notify-staff':
        return await handleNotifyStaff(req, res);
      case 'create-booking':
        return await handleCreateBooking(req, res);
      case 'list-staff':
        return res.json({ ok: true, staff: Array.from(db.staff.values()) });
      default:
        return res.status(400).json({ error: 'unknown action', action });
    }
  } catch (e: any) {
    console.error('[api] error', e);
    return res.status(500).json({ error: e.message });
  }
}

// ============ 业务实现 ============
async function handleWxLogin(req: VercelRequest, res: VercelResponse) {
  const { code } = req.body;
  const r = await axios.get(
    `https://api.weixin.qq.com/sns/jscode2session?appid=${CONFIG.MINI_APPID}&secret=${CONFIG.MINI_SECRET}&js_code=${code}&grant_type=authorization_code`,
  );
  return res.json(r.data);
}

async function handleDecryptPhone(req: VercelRequest, res: VercelResponse) {
  const { encryptedData, iv, sessionKey } = req.body;
  try {
    const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from(sessionKey, 'base64'), Buffer.from(iv, 'base64'));
    let dec = decipher.update(encryptedData, 'base64', 'utf8');
    dec += decipher.final('utf8');
    const data = JSON.parse(dec);
    return res.json({ phone: data.phoneNumber, purePhone: data.purePhoneNumber });
  } catch (e: any) {
    return res.status(400).json({ error: 'decrypt failed: ' + e.message });
  }
}

async function handleSaveSubscribe(req: VercelRequest, res: VercelResponse) {
  const { openid, tmplId } = req.body;
  db.subscribeAuth.set(`${openid}_${tmplId}`, {
    openid, tmplId, acceptedAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  });
  return res.json({ ok: true });
}

async function handleStaffBind(req: VercelRequest, res: VercelResponse) {
  const { staffId, code } = req.body;
  const staff = db.staff.get(staffId);
  if (!staff) return res.status(404).json({ error: 'staff not found' });

  const r = await axios.get(
    `https://api.weixin.qq.com/sns/jscode2session?appid=${CONFIG.MINI_APPID}&secret=${CONFIG.MINI_SECRET}&js_code=${code}&grant_type=authorization_code`,
  );
  if (r.data.errcode) return res.status(400).json({ error: r.data.errmsg });

  staff.miniOpenid = r.data.openid;
  staff.unionid = r.data.unionid;
  staff.bound = true;
  db.staff.set(staff.id, staff);

  return res.json({ ok: true, staff });
}

async function handleNotifyStaff(req: VercelRequest, res: VercelResponse) {
  const { booking } = req.body;
  const storeStaff = Array.from(db.staff.values()).filter(
    (s: any) => s.storeId === booking.storeId && s.bound && s.mpOpenid,
  );

  const token = await getMpToken();
  const results = [];
  for (const s of storeStaff) {
    const r = await axios.post(
      `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${token}`,
      {
        touser: s.mpOpenid,
        template_id: CONFIG.STAFF_TMPL_ID,
        data: {
          first: { value: '�� 新预约' },
          keyword1: { value: booking.service },
          keyword2: { value: `${booking.date} ${booking.startTime}` },
          keyword3: { value: booking.customerName || booking.phone },
          remark: { value: '潇洒佳人美学空间' },
        },
      },
    );
    results.push({ name: s.name, ok: r.data.errcode === 0 });
  }
  return res.json({ ok: true, notified: results.length, results });
}

async function handleCreateBooking(req: VercelRequest, res: VercelResponse) {
  const { phone, customerName, storeId, service, date, startTime, endTime, openid } = req.body;
  const id = 'b' + Date.now().toString(36);
  const booking = {
    id, phone, customerName, storeId, service, date, startTime, endTime,
    status: 'confirmed', openid,
    notify1hAt: new Date(`${date} ${startTime}`).getTime() - 60 * 60 * 1000,
    notify30mAt: new Date(`${date} ${startTime}`).getTime() - 30 * 60 * 1000,
    notified1h: false, notified30m: false,
    createdAt: Date.now(),
  };
  db.bookings.set(id, booking);

  // 异步通知店员
  axios.post(`${req.headers.origin || ''}/api/wechat-mp`, {
    action: 'notify-staff', booking,
  }).catch(console.error);

  return res.json({ ok: true, booking });
}

// ============ 生成小程序码（独立部署） ============
export async function wxacode(req: VercelRequest, res: VercelResponse) {
  const { scene } = req.query;
  const token = await getMiniToken();
  const r = await axios.post(
    `https://api.weixin.qq.com/wxaapi/getwxacodeunlimit?access_token=${token}`,
    {
      scene: scene || 'staff_default',
      page: 'pages/bind/staff',
      width: 430,
    },
    { responseType: 'arraybuffer' },
  );
  res.setHeader('Content-Type',