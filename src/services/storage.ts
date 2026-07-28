// 预约数据持久化（基于 Taro.storage，跨页面同步）
import Taro from '@tarojs/taro';
import type {
  Booking,
  CapacityMap,
  CustomerPhone,
  ReminderRecord,
  AdminNotification,
  AdminConfig,
} from '@/types';
import { SEED_BOOKINGS } from '@/data/bookings';

// === 存储 Key 常量 ===
const KEYS = {
  bookings: 'xiaosa_bookings_v1',
  capacities: 'xiaosa_capacities_v1',
  phones: 'xiaosa_phones_v1',
  reminders: 'xiaosa_reminders_v1',
  notifications: 'xiaosa_admin_notifications_v1',
  admin: 'xiaosa_admin_config_v1',
  adminAuth: 'xiaosa_admin_auth_v1', // 登录态
} as const;

// === 通用读写 ===
function get<T>(key: string, fallback: T): T {
  try {
    const raw = Taro.getStorageSync(key);
    if (raw === undefined || raw === null || raw === '') return fallback;
    return raw as T;
  } catch (e) {
    console.error('[storage] get failed', key, e);
    return fallback;
  }
}

function set<T>(key: string, value: T): void {
  try {
    Taro.setStorageSync(key, value);
  } catch (e) {
    console.error('[storage] set failed', key, e);
  }
}

// === 预约 ===
export const loadBookings = (): Booking[] => {
  const raw = get<Booking[] | null>(KEYS.bookings, null);
  if (!raw) return SEED_BOOKINGS;
  return raw.map((b) => ({ ...b, phone: b.phone ?? '' }));
};

export const saveBookings = (bookings: Booking[]): void => {
  set(KEYS.bookings, bookings);
};

export const genBookingId = (): string => {
  return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
};

// === 时段容量 ===
export const loadCapacities = (): CapacityMap => get<CapacityMap>(KEYS.capacities, {});
export const saveCapacities = (m: CapacityMap): void => set(KEYS.capacities, m);

// === 顾客手机号 ===
export const loadPhones = (): CustomerPhone[] => get<CustomerPhone[]>(KEYS.phones, []);
export const savePhones = (phones: CustomerPhone[]): void => set(KEYS.phones, phones);

// === 提醒记录 ===
export const loadReminders = (): ReminderRecord[] => get<ReminderRecord[]>(KEYS.reminders, []);
export const saveReminders = (r: ReminderRecord[]): void => set(KEYS.reminders, r);

// === 管理员通知 ===
export const loadNotifications = (): AdminNotification[] =>
  get<AdminNotification[]>(KEYS.notifications, []);
export const saveNotifications = (n: AdminNotification[]): void => set(KEYS.notifications, n);

// === 管理员配置 ===
export const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  password: 'admin888',
  notificationsEnabled: true,
  reminderEnabled: true,
  reminderChannels: ['inApp'],
};

export const loadAdminConfig = (): AdminConfig =>
  get<AdminConfig>(KEYS.admin, DEFAULT_ADMIN_CONFIG);

export const saveAdminConfig = (cfg: AdminConfig): void => set(KEYS.admin, cfg);

// === 管理员登录态 ===
export const isAdminAuthed = (): boolean => get<boolean>(KEYS.adminAuth, false);
export const setAdminAuthed = (v: boolean): void => set(KEYS.adminAuth, v);

// === 工具：构造容量 key ===
export const capKey = (date: string, time: string): string => `${date}|${time}`;