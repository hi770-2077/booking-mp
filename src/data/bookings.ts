// 预约 mock 数据（演示用）
import type { Booking } from '@/types';

const fmtLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const SEED_BOOKINGS: Booking[] = (() => {
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2);
  return [
    {
      id: 'b1', storeId: 'store_wenshan', packageId: 'p5', service: '仪式场景妆',
      date: fmtLocal(tomorrow), startTime: '10:00', endTime: '12:00',
      duration: 120, stylistId: null, price: 168, status: 'confirmed',
      phone: '13800000001', createdAt: fmtLocal(today),
    },
    {
      id: 'b2', storeId: 'store_wenshan', packageId: 'p2', service: '精致全妆',
      date: fmtLocal(dayAfter), startTime: '14:00', endTime: '15:00',
      duration: 60, stylistId: null, price: 99, status: 'confirmed',
      phone: '13800000002', createdAt: fmtLocal(today),
    },
  ];
})();