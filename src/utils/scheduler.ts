// 时段算法
// 业务规则：
//   - 营业时间：周一-周四 9:00-22:30，周五/六/日 9:00-23:00
//   - 容量：周一-周四 13-18 点 2 人班；周五-周日 13-18 点 3 人班
import type { Booking, SlotMeta, DateItem } from '@/types';

export const TIME_SLOTS: string[] = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30',
];

const OPEN_TIME = 9 * 60;
const CLOSE_WEEKDAY = 22 * 60 + 30;
const CLOSE_WEEKEND = 23 * 60;

const toMin = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const toStr = (min: number): string => {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
};

export const calcEndTime = (start: string, duration: number): string => {
  return toStr(toMin(start) + duration);
};

const isWeekendDate = (date: string): boolean => {
  const d = new Date(date + 'T00:00:00');
  const dow = d.getDay();
  return dow === 0 || dow === 5 || dow === 6;
};

const getSlotCapacity = (
  time: string,
  date: string,
  capacities?: Record<string, number>,
): number => {
  const key = `${date}|${time}`;
  if (capacities && capacities[key] !== undefined) return capacities[key];
  const min = toMin(time);
  if (isWeekendDate(date)) {
    if (min >= 13 * 60 && min < 18 * 60) return 3;
    if (min >= 18 * 60 && min < 20 * 60) return 2;
    return 1;
  }
  if (min >= 13 * 60 && min < 18 * 60) return 2;
  return 1;
};

export const getAvailableSlots = (
  date: string,
  duration: number,
  bookings: Booking[],
  todayDate?: string,
  nowMinutes?: number,
  excludeBookingId?: string,
  capacities?: Record<string, number>,
): SlotMeta[] => {
  const dayBookings = bookings.filter(
    (b) => b.date === date && b.status !== 'cancelled' && b.id !== excludeBookingId,
  );
  const isToday = !!todayDate && date === todayDate;
  const weekend = isWeekendDate(date);
  const closeTime = weekend ? CLOSE_WEEKEND : CLOSE_WEEKDAY;

  return TIME_SLOTS.map((time) => {
    const start = toMin(time);
    const end = start + duration;

    if (isToday && nowMinutes !== undefined && start <= nowMinutes) {
      return { time, available: false, reason: 'past' };
    }
    if (end > closeTime) return { time, available: false, reason: 'closed' };
    if (start < OPEN_TIME) return { time, available: false, reason: 'closed' };

    const cap = getSlotCapacity(time, date, capacities);
    const booked = dayBookings.filter((b) => {
      const bStart = toMin(b.startTime);
      const bEnd = toMin(b.endTime);
      return start < bEnd && end > bStart;
    }).length;
    const full = booked >= cap;

    return {
      time, available: !full,
      capacity: cap, booked,
      reason: full ? 'full' : undefined,
    };
  });
};

const fmtLocal = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const getFutureDates = (days: number = 14): DateItem[] => {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const result: DateItem[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dow = d.getDay();
    result.push({
      date: fmtLocal(d),
      day: d.getDate(),
      weekday: weekdays[dow],
      weekdayShort: dow === 0 || dow === 6 ? '周末' : '周' + ['日', '一', '二', '三', '四', '五', '六'][dow],
      isToday: i === 0,
      isWeekend: dow === 0 || dow === 6,
    });
  }
  return result;
};

export const countSlots = (slots: SlotMeta[]): { morning: number; noon: number; afternoon: number; evening: number; total: number } => {
  let morning = 0;
  let noon = 0;
  let afternoon = 0;
  let evening = 0;
  for (const s of slots) {
    if (!s.available) continue;
    const min = toMin(s.time);
    if (min < 12 * 60) morning++;
    else if (min <= 12 * 60 + 30) noon++;
    else if (min < 18 * 60) afternoon++;
    else evening++;
  }
  return { morning, noon, afternoon, evening, total: morning + noon + afternoon + evening };
};