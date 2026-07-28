// 预约状态管理（Zustand）- 扩展版（容量/手机号/提醒/通知）
import { create } from 'zustand';
import type {
  Booking,
  CapacityMap,
  CustomerPhone,
  ReminderRecord,
  AdminNotification,
} from '@/types';
import {
  loadBookings,
  saveBookings,
  loadCapacities,
  saveCapacities,
  loadPhones,
  savePhones,
  loadReminders,
  saveReminders,
  loadNotifications,
  saveNotifications,
  capKey,
  genBookingId,
} from '@/services/storage';
import { scheduleReminders, cancelReminders } from '@/services/reminder';

interface BookingState {
  // === 预约 ===
  bookings: Booking[];
  addBooking: (b: Omit<Booking, 'id' | 'createdAt' | 'status'>) => Booking;
  cancelBooking: (id: string) => void;

  // === 容量管理 ===
  capacities: CapacityMap;
  setSlotCapacity: (date: string, time: string, capacity: number) => void;
  resetSlotCapacity: (date: string, time: string) => void;
  /** 从源日期的某段时间复制容量到目标日期的同段时间 */
  copyDayCapacities: (fromDate: string, toDates: string[]) => void;
  /** 在指定日期范围内批量设置容量 */
  bulkUpdateSlots: (
    dates: string[],
    times: string[],
    capacity: number,
    mode: 'overwrite' | 'increment',
  ) => void;
  /** 一键应用：周一-周四容量模板 */
  applyWeekdayTemplate: (dates: string[]) => void;
  /** 一键应用：周末容量模板 */
  applyWeekendTemplate: (dates: string[]) => void;
  /** 清空指定日期的所有容量设置（恢复默认） */
  clearDateCapacities: (date: string) => void;

  // === 手机号簿 ===
  phones: CustomerPhone[];
  addPhone: (phone: string, name?: string) => CustomerPhone;
  removePhone: (id: string) => void;
  usePhone: (id: string) => void;

  // === 提醒 ===
  reminders: ReminderRecord[];

  // === 管理员通知 ===
  notifications: AdminNotification[];
  unreadCount: number;
  addNotification: (n: Omit<AdminNotification, 'id' | 'createdAt' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;

  // === 初始化 ===
  init: () => void;
}

export const useBookingStore = create<BookingState>((set, get) => ({
  bookings: [],
  capacities: {},
  phones: [],
  reminders: [],
  notifications: [],
  unreadCount: 0,

  // === 预约 ===
  addBooking: (data) => {
    const today = new Date();
    const fmt = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const newB: Booking = {
      ...data,
      id: genBookingId(),
      status: 'confirmed',
      createdAt: fmt,
    };
    const next = [newB, ...get().bookings];
    set({ bookings: next });
    saveBookings(next);
    console.info('[BookingStore] add', newB.id, newB.service, newB.date, newB.startTime);

    // 调度提醒
    scheduleReminders(newB, get().reminders);
    // 通知管理员
    get().addNotification({
      bookingId: newB.id,
      type: 'new_booking',
      title: '🆕 新预约',
      content: `${newB.service} | ${newB.date} ${newB.startTime} | ${newB.phone}`,
      storeId: newB.storeId,
    });
    return newB;
  },

  cancelBooking: (id) => {
    const target = get().bookings.find((b) => b.id === id);
    const next = get().bookings.map((b) =>
      b.id === id ? { ...b, status: 'cancelled' as const } : b,
    );
    set({ bookings: next });
    saveBookings(next);
    if (target) {
      cancelReminders(id);
      get().addNotification({
        bookingId: id,
        type: 'cancelled',
        title: '✗ 预约已取消',
        content: `${target.service} | ${target.date} ${target.startTime}`,
        storeId: target.storeId,
      });
    }
    console.info('[BookingStore] cancel', id);
  },

  // === 容量管理 ===
  setSlotCapacity: (date, time, capacity) => {
    const key = capKey(date, time);
    const cur = { ...get().capacities };
    if (capacity <= 0) {
      delete cur[key];
    } else {
      cur[key] = capacity;
    }
    set({ capacities: cur });
    saveCapacities(cur);
  },

  resetSlotCapacity: (date, time) => {
    const key = capKey(date, time);
    const cur = { ...get().capacities };
    delete cur[key];
    set({ capacities: cur });
    saveCapacities(cur);
  },

  copyDayCapacities: (fromDate, toDates) => {
    const cur = { ...get().capacities };
    const fromEntries = Object.entries(cur).filter(([k]) => k.startsWith(fromDate + '|'));
    for (const toDate of toDates) {
      for (const [k, v] of fromEntries) {
        const time = k.split('|')[1];
        cur[capKey(toDate, time)] = v;
      }
    }
    set({ capacities: cur });
    saveCapacities(cur);
  },

  bulkUpdateSlots: (dates, times, capacity, mode) => {
    const cur = { ...get().capacities };
    for (const d of dates) {
      for (const t of times) {
        const key = capKey(d, t);
        if (mode === 'overwrite') {
          if (capacity <= 0) delete cur[key];
          else cur[key] = capacity;
        } else {
          cur[key] = (cur[key] ?? 0) + capacity;
        }
      }
    }
    set({ capacities: cur });
    saveCapacities(cur);
  },

  applyWeekdayTemplate: (dates) => {
    const cur = { ...get().capacities };
    for (const d of dates) {
      const dow = new Date(d + 'T00:00:00').getDay();
      if (dow === 0 || dow === 6) continue; // 跳过周末
      for (let h = 9; h < 22.5; h += 0.5) {
        const hh = Math.floor(h);
        const mm = h % 1 === 0 ? '00' : '30';
        const time = `${String(hh).padStart(2, '0')}:${mm}`;
        const min = hh * 60 + (mm === '30' ? 30 : 0);
        let cap = 1;
        if (min >= 13 * 60 && min < 18 * 60) cap = 2;
        cur[capKey(d, time)] = cap;
      }
    }
    set({ capacities: cur });
    saveCapacities(cur);
  },

  applyWeekendTemplate: (dates) => {
    const cur = { ...get().capacities };
    for (const d of dates) {
      const dow = new Date(d + 'T00:00:00').getDay();
      if (dow !== 0 && dow !== 6) continue; // 跳过工作日
      for (let h = 9; h < 23; h += 0.5) {
        const hh = Math.floor(h);
        const mm = h % 1 === 0 ? '00' : '30';
        const time = `${String(hh).padStart(2, '0')}:${mm}`;
        const min = hh * 60 + (mm === '30' ? 30 : 0);
        let cap = 1;
        if (min >= 13 * 60 && min < 18 * 60) cap = 3;
        else if (min >= 18 * 60 && min < 20 * 60) cap = 2;
        cur[capKey(d, time)] = cap;
      }
    }
    set({ capacities: cur });
    saveCapacities(cur);
  },

  clearDateCapacities: (date) => {
    const cur = { ...get().capacities };
    for (const k of Object.keys(cur)) {
      if (k.startsWith(date + '|')) delete cur[k];
    }
    set({ capacities: cur });
    saveCapacities(cur);
  },

  // === 手机号簿 ===
  addPhone: (phone, name) => {
    const existing = get().phones.find((p) => p.phone === phone);
    if (existing) {
      const next = get().phones.map((p) =>
        p.id === existing.id
          ? { ...p, name: name ?? p.name, lastUsedAt: new Date().toISOString().slice(0, 10) }
          : p,
      );
      set({ phones: next });
      savePhones(next);
      return next.find((p) => p.id === existing.id)!;
    }
    const newPhone: CustomerPhone = {
      id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      phone,
      name,
      lastUsedAt: new Date().toISOString().slice(0, 10),
      useCount: 1,
    };
    const next = [newPhone, ...get().phones];
    set({ phones: next });
    savePhones(next);
    return newPhone;
  },

  removePhone: (id) => {
    const next = get().phones.filter((p) => p.id !== id);
    set({ phones: next });
    savePhones(next);
  },

  usePhone: (id) => {
    const next = get().phones.map((p) =>
      p.id === id
        ? { ...p, useCount: p.useCount + 1, lastUsedAt: new Date().toISOString().slice(0, 10) }
        : p,
    );
    set({ phones: next });
    savePhones(next);
  },

  // === 提醒（不直接操作，由 reminder service 维护） ===
  reminders: [],

  // === 通知 ===
  addNotification: (n) => {
    const newN: AdminNotification = {
      ...n,
      id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      createdAt: new Date().toISOString(),
      read: false,
    };
    const next = [newN, ...get().notifications].slice(0, 100); // 最多保留 100 条
    set({ notifications: next, unreadCount: next.filter((x) => !x.read).length });
    saveNotifications(next);
  },

  markNotificationRead: (id) => {
    const next = get().notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    set({ notifications: next, unreadCount: next.filter((x) => !x.read).length });
    saveNotifications(next);
  },

  markAllNotificationsRead: () => {
    const next = get().notifications.map((n) => ({ ...n, read: true }));
    set({ notifications: next, unreadCount: 0 });
    saveNotifications(next);
  },

  clearNotifications: () => {
    set({ notifications: [], unreadCount: 0 });
    saveNotifications([]);
  },

  // === 初始化 ===
  init: () => {
    const bookings = loadBookings();
    const capacities = loadCapacities();
    const phones = loadPhones();
    const reminders = loadReminders();
    const notifications = loadNotifications();
    set({
      bookings,
      capacities,
      phones,
      reminders,
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    });
    console.info('[BookingStore] init', {
      bookings: bookings.length,
      capacities: Object.keys(capacities).length,
      phones: phones.length,
      reminders: reminders.length,
      notifications: notifications.length,
    });
  },
}));