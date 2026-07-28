// 预约提醒调度服务
// 工作原理：
//   1. 预约创建时计算 提醒时间戳（提前 1 小时 + 提前 30 分钟）
//   2. 用 setTimeout 调度，到点触发"应用内通知"（生产环境替换为微信订阅消息）
//   3. 取消预约时清除定时器
//   4. 重新进入应用时扫描未触发的提醒，重新调度

import Taro from '@tarojs/taro';
import type { Booking, ReminderRecord, AdminNotification } from '@/types';
import { loadReminders, saveReminders } from './storage';
import { STORES } from '@/data/stores';

const REMINDER_KEYS = 'xiaosa_pending_reminders';

// === 计算时间戳 ===
function calcRemindTimestamps(date: string, time: string): { at1h: number; at30m: number } {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const bookingTs = new Date(y, mo - 1, d, h, mi).getTime();
  return {
    at1h: bookingTs - 60 * 60 * 1000,  // 提前 1 小时
    at30m: bookingTs - 30 * 60 * 1000,  // 提前 30 分钟
  };
}

// === 应用内通知（H5 / 小程序通用）===
function notifyInApp(title: string, content: string, type: 'reminder' = 'reminder'): void {
  // Taro.showToast + showModal 是跨端最简单的提醒方式
  try {
    Taro.showToast({ title, icon: 'none', duration: 3000 });
  } catch {
    console.info('[Reminder]', title, content);
  }

  // 同时写入管理员通知
  try {
    const list = Taro.getStorageSync('xiaosa_admin_notifications_v1') as AdminNotification[] | undefined;
    const next = [
      {
        id: 'n' + Date.now().toString(36),
        bookingId: '',
        type,
        title,
        content,
        storeId: '',
        createdAt: new Date().toISOString(),
        read: false,
      } as AdminNotification,
      ...(list ?? []),
    ].slice(0, 100);
    Taro.setStorageSync('xiaosa_admin_notifications_v1', next);
  } catch (e) {
    console.error('[Reminder] notify failed', e);
  }
}

// === 调度单个提醒 ===
function scheduleOne(record: ReminderRecord, which: '1h' | '30m'): void {
  const ts = which === '1h' ? record.remindAt1h : record.remindAt30m;
  const delay = ts - Date.now();
  if (delay <= 0) return; // 已过期，不调度
  const tag = `reminder_${record.id}_${which}`;
  console.info(`[Reminder] schedule ${tag} in ${Math.round(delay / 1000)}s`);
  setTimeout(() => {
    const title = which === '1h' ? '⏰ 1小时后预约' : '🔔 30分钟后预约';
    const content = `${record.service} | ${record.date} ${record.startTime} | ${record.storeName}`;
    notifyInApp(title, content);
    // 标记已触发
    const list = loadReminders();
    const next = list.map((r) =>
      r.id === record.id ? { ...r, [which === '1h' ? 'fired1h' : 'fired30m']: true } : r,
    );
    saveReminders(next);
  }, delay);
}

// === 调度某条预约的两次提醒 ===
export function scheduleReminders(booking: Booking, _existing: ReminderRecord[]): void {
  const { at1h, at30m } = calcRemindTimestamps(booking.date, booking.startTime);
  const store = STORES.find((s) => s.id === booking.storeId);

  const record: ReminderRecord = {
    id: booking.id,
    phone: booking.phone,
    service: booking.service,
    storeName: store?.name ?? '门店',
    date: booking.date,
    startTime: booking.startTime,
    remindAt1h: at1h,
    remindAt30m: at30m,
    fired1h: false,
    fired30m: false,
  };

  // 保存记录
  const list = loadReminders();
  const next = [record, ...list.filter((r) => r.id !== booking.id)];
  saveReminders(next);

  scheduleOne(record, '1h');
  scheduleOne(record, '30m');
}

// === 取消某条预约的所有提醒 ===
export function cancelReminders(bookingId: string): void {
  const list = loadReminders();
  saveReminders(list.filter((r) => r.id !== bookingId));
}

// === 应用启动时重新调度所有未触发的提醒 ===
export function bootstrapReminders(): void {
  const list = loadReminders();
  for (const r of list) {
    if (!r.fired1h) scheduleOne(r, '1h');
    if (!r.fired30m) scheduleOne(r, '30m');
  }
  console.info('[Reminder] bootstrap', list.length);
}