// 全局类型定义 - 预约系统

export interface Store {
  id: string;
  name: string;
  address: string;
  phone: string;
  businessHours: string;
}

export interface PackageItem {
  id: string;
  title: string;
  subtitle: string;
  duration: number;       // 服务时长（分钟）
  price: number;
  originalPrice: number;
  sold: number;
  tags: string[];
  storeIds?: string[];    // 限定门店；不填=两店通用
}

export interface Stylist {
  id: string;
  storeId: string;
  name: string;
  rating: number;
  tasks: number;
  specialties: string[];
}

export interface Booking {
  id: string;
  storeId: string;
  packageId: string;
  service: string;
  date: string;            // YYYY-MM-DD
  startTime: string;       // HH:MM
  endTime: string;
  duration: number;
  stylistId: string | null;
  price: number;
  status: 'confirmed' | 'completed' | 'cancelled';
  phone: string;
  createdAt: string;
}

export interface SlotMeta {
  time: string;
  available: boolean;
  capacity?: number;
  booked?: number;
  reason?: 'closed' | 'overlap' | 'past' | 'full';
}

export interface DateItem {
  date: string;
  day: number;
  weekday: string;
  weekdayShort: string;
  isToday: boolean;
  isWeekend: boolean;
}

// === 新增：扩展类型 ===

// 时段容量覆盖（key: 日期-时间 如 "2026-07-28-14:00"）
export type CapacityMap = Record<string, number>;

// 顾客手机号记录（多账号管理）
export interface CustomerPhone {
  id: string;
  phone: string;
  name?: string;       // 备注/昵称
  lastUsedAt: string;  // 上次使用时间 YYYY-MM-DD
  useCount: number;
}

// 预约提醒记录
export interface ReminderRecord {
  id: string;          // 与 booking.id 一致
  phone: string;
  service: string;
  storeName: string;
  date: string;
  startTime: string;
  remindAt1h: number;  // 时间戳
  remindAt30m: number;
  fired1h: boolean;
  fired30m: boolean;
}

// 管理员通知（门店收到的预约信息）
export interface AdminNotification {
  id: string;
  bookingId: string;
  type: 'new_booking' | 'cancelled' | 'reminder';
  title: string;
  content: string;
  storeId: string;
  createdAt: string;
  read: boolean;
}

// 管理员配置
export interface AdminConfig {
  password: string;        // 默认 admin888
  notificationsEnabled: boolean;
  reminderEnabled: boolean; // 是否启用预约提醒
  reminderChannels: ('inApp' | 'wechat')[]; // 提醒渠道
}