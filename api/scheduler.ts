/**
 * Vercel Cron Function: 每 5 分钟执行一次
 * 作用：扫描预约，发送 1 小时 / 30 分钟提醒
 * 配置：vercel.json 中已添加 cron
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

const CONFIG = {
  MINI_APPID: process.env.MINI_APPID || '',
  MINI_SECRET: process.env.MINI_SECRET || '',
  REMINDER_1H_TMPL: process.env.REMINDER_1H_TMPL || '',
  REMINDER_30M_TMPL: process.env.REMINDER_30M_TMPL || '',
};

let miniTokenCache = { token: '', expiresAt: 0 };

async function getMiniToken(): Promise<string> {
  if (Date.now() < miniTokenCache.expiresAt && miniTokenCache.token) return miniTokenCache.token;
  const r = await axios.get(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${CONFIG.MINI_APPID}&secret=${CONFIG.MINI_SECRET}`,
  );
  if (r.data.errcode) throw new Error(r.data.errmsg);
  miniTokenCache = { token: r.data.access_token, expiresAt: Date.now() + (r.data.expires_in - 200) * 1000 };
  return miniTokenCache.token;
}

// Vercel 大量使用 KV/Postgres，这里简化用内存
const globalStore = (globalThis as any).__bookings || new Map();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Cron 调用时会带 Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const now = Date.now();
  const TOLERANCE = 5 * 60 * 1000; // 5 分钟容差
  const results = { oneHour: [], thirtyMin: [] };

  // 1 小时提醒
  for (const [_, b] of globalStore) {
    if (b.status !== 'confirmed' || b.notified1h) continue;
    if (Math.abs(b.notify1hAt - now) > TOLERANCE) continue;

    if (!b.openid) continue;
    const token = await getMiniToken();
    const r = await axios.post(
      `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`,
      {
        touser: b.openid,
        template_id: CONFIG.REMINDER_1H_TMPL,
        data: {
          thing1: { value: b.service },
          time2: { value: `${b.date} ${b.startTime}` },
          thing3: { value: '潇洒佳人美学空间' },
        },
      },
    );
    if (r.data.errcode === 0) {
      b.notified1h = true;
      results.oneHour.push({ id: b.id, ok: true });
    }
  }

  // 30 分钟提醒（同上）
  for (const [_, b] of globalStore) {
    if (b.status !== 'confirmed' || b.notified30m) continue;
    if (Math.abs(b.notify30mAt - now) > TOLERANCE) continue;

    if (!b.openid) continue;
    const token = await getMiniToken();
    const r = await axios.post(
      `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`,
      {
        touser: b.openid,
        template_id: CONFIG.REMINDER_30M_TMPL,
        data: {
          thing1: { value: b.service },
          time2: { value: `${b.date} ${b.startTime}` },
          thing3: { value: '潇洒佳人美学空间' },
        },
      },
    );
    if (r.data.errcode === 0) {
      b.notified30m = true;
      results.thirtyMin.push({ id: b.id, ok: true });
    }
  }

  return res.json({ ok: true, timestamp: now, results });
}