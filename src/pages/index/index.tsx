import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Input, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classNames from 'classnames';
import { STORES } from '@/data/stores';
import { PACKAGES } from '@/data/packages';
import { useBookingStore } from '@/store/useBookingStore';
import {
  calcEndTime,
  getAvailableSlots,
  getFutureDates,
  countSlots,
} from '@/utils/scheduler';
import type { Booking, PackageItem, Store } from '@/types';
import styles from './index.module.scss';

// ──────────────────────────────────────────────────────
// 月历选择器 - 内联组件，避免 mini-program custom component 注册问题
// ──────────────────────────────────────────────────────
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
function fmt(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}
function getMonthGrid(year: number, month: number): Array<{
  y: number;
  m: number;
  d: number;
  dateStr: string;
  inMonth: boolean;
}> {
  const firstDay = new Date(year, month - 1, 1);
  const startWeekday = firstDay.getDay();
  const cells: Array<{ y: number; m: number; d: number; dateStr: string; inMonth: boolean }> = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, -i);
    cells.push({ y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), dateStr: fmt(d.getFullYear(), d.getMonth() + 1, d.getDate()), inMonth: false });
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ y: year, m: month, d, dateStr: fmt(year, month, d), inMonth: true });
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1];
    const next = new Date(last.y, last.m - 1, last.d + 1);
    cells.push({ y: next.getFullYear(), m: next.getMonth() + 1, d: next.getDate(), dateStr: fmt(next.getFullYear(), next.getMonth() + 1, next.getDate()), inMonth: false });
  }
  return cells;
}

interface FutureDateLite {
  date: string;
  day: number;
  weekday: string;
  weekdayShort: string;
  isWeekend: boolean;
  isToday: boolean;
}

interface DatePickerCalendarProps {
  futureDates: FutureDateLite[];
  todayDate: string;
  selectedDate: string | null;
  maxMonths: number;
  onSelect: (dateStr: string) => void;
}

const DatePickerCalendar: React.FC<DatePickerCalendarProps> = ({
  futureDates,
  todayDate,
  selectedDate,
  maxMonths,
  onSelect,
}) => {
  const [ty, tm] = todayDate.split('-').map(Number);
  const [viewYear, setViewYear] = useState(() => {
    if (selectedDate) return Number(selectedDate.split('-')[0]);
    return ty;
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (selectedDate) return Number(selectedDate.split('-')[1]);
    return tm;
  });

  const maxYear = ty + Math.floor((tm - 1 + maxMonths) / 12);
  const maxMonth = ((tm - 1 + maxMonths) % 12) + 1;
  const canGoNext = !(viewYear > maxYear || (viewYear === maxYear && viewMonth >= maxMonth));
  const canGoPrev = !(viewYear < ty || (viewYear === ty && viewMonth <= tm));

  const grid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const futureDateSet = useMemo(() => new Set(futureDates.map((d) => d.date)), [futureDates]);

  return (
    <View className={styles.calendar}>
      <View className={styles.calNav}>
        <View
          className={classNames(styles.calArrow, !canGoPrev && styles.calArrowDisabled)}
          onClick={() => {
            if (!canGoPrev) return;
            if (viewMonth === 1) { setViewYear(viewYear - 1); setViewMonth(12); }
            else { setViewMonth(viewMonth - 1); }
          }}
        >
          <Text className={styles.calArrowText}>‹</Text>
        </View>
        <View className={styles.calTitle}>
          <Text className={styles.calTitleYear}>{viewYear}</Text>
          <Text className={styles.calTitleMonth}>{viewMonth}月</Text>
        </View>
        <View
          className={classNames(styles.calArrow, !canGoNext && styles.calArrowDisabled)}
          onClick={() => {
            if (!canGoNext) return;
            if (viewMonth === 12) { setViewYear(viewYear + 1); setViewMonth(1); }
            else { setViewMonth(viewMonth + 1); }
          }}
        >
          <Text className={styles.calArrowText}>›</Text>
        </View>
      </View>

      <View className={styles.calWeekHeader}>
        {WEEKDAYS.map((w, i) => (
          <View key={i} className={classNames(styles.calWeekHeaderCell, (i === 0 || i === 6) && styles.calWeekHeaderCellWeekend)}>
            <Text>{w}</Text>
          </View>
        ))}
      </View>

      <View className={styles.calGrid}>
        {grid.map((cell) => {
          const isToday = cell.dateStr === todayDate;
          const isSelected = cell.dateStr === selectedDate;
          const isFuture = futureDateSet.has(cell.dateStr);
          const isWeekend = new Date(cell.y, cell.m - 1, cell.d).getDay() === 0
            || new Date(cell.y, cell.m - 1, cell.d).getDay() === 6;
          const disabled = !isFuture || !cell.inMonth;

          return (
            <View
              key={cell.dateStr}
              className={classNames(
                styles.calCell,
                isSelected && styles.calCellSelected,
                !isSelected && isToday && styles.calCellToday,
                disabled && styles.calCellDisabled,
                !cell.inMonth && styles.calCellOutMonth,
                isWeekend && !isSelected && styles.calCellWeekend,
              )}
              onClick={() => {
                if (disabled) return;
                onSelect(cell.dateStr);
              }}
            >
              <Text
                className={classNames(
                  styles.calCellText,
                  isSelected && styles.calCellTextSelected,
                )}
              >
                {cell.d}
              </Text>
              {isToday && !isSelected && <View className={styles.calTodayDot} />}
            </View>
          );
        })}
      </View>

      <View className={styles.calLegend}>
        <View className={styles.calLegendItem}>
          <View className={classNames(styles.calLegendDot, styles.calLegendDotToday)} />
          <Text>今天</Text>
        </View>
        <View className={styles.calLegendItem}>
          <View className={classNames(styles.calLegendDot, styles.calLegendDotSelected)} />
          <Text>已选</Text>
        </View>
        <View className={styles.calLegendItem}>
          <View className={classNames(styles.calLegendDot, styles.calLegendDotDisabled)} />
          <Text>不可选</Text>
        </View>
      </View>
    </View>
  );
};

const IndexPage: React.FC = () => {
  // 状态
  const [storeId, setStoreId] = useState<string>(STORES[0].id);
  const [selectedPackageId, setSelectedPackageId] = useState<string>(PACKAGES[0].id);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // 弹窗
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [showBookingsModal, setShowBookingsModal] = useState(false);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [successBooking, setSuccessBooking] = useState<Booking | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneNameInput, setPhoneNameInput] = useState('');

  // store
  const bookings = useBookingStore((s) => s.bookings);
  const addBooking = useBookingStore((s) => s.addBooking);
  const cancelBooking = useBookingStore((s) => s.cancelBooking);
  const capacities = useBookingStore((s) => s.capacities);
  const phones = useBookingStore((s) => s.phones);
  const addPhone = useBookingStore((s) => s.addPhone);
  const usePhone = useBookingStore((s) => s.usePhone);
  const removePhone = useBookingStore((s) => s.removePhone);

  // 实时当前时间（每分钟刷新）
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const todayDate = useMemo(() => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [now]);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // 初始化默认日期
  useEffect(() => {
    setSelectedDate(getFutureDates(14)[0].date);
  }, []);

  // 派生数据
  const currentStore: Store = STORES.find((s) => s.id === storeId) || STORES[0];
  const storeBookings = useMemo(
    () => bookings.filter((b) => b.storeId === storeId),
    [bookings, storeId],
  );

  const availablePackages = useMemo(
    () => PACKAGES.filter((p) => !p.storeIds || p.storeIds.includes(storeId)),
    [storeId],
  );

  const selectedPackage: PackageItem =
    availablePackages.find((p) => p.id === selectedPackageId) || availablePackages[0];

  const futureDates = useMemo(() => getFutureDates(90), []);
  const slots = useMemo(
    () =>
      selectedPackage && selectedDate
        ? getAvailableSlots(
            selectedDate,
            selectedPackage.duration,
            storeBookings,
            todayDate,
            nowMinutes,
            undefined,
            capacities,
          )
        : [],
    [selectedDate, selectedPackage, storeBookings, todayDate, nowMinutes, capacities],
  );
  const slotStats = useMemo(() => countSlots(slots), [slots]);

  // 切换门店后，若当前选中项目不在该门店列表，重置到第一个
  useEffect(() => {
    if (!availablePackages.find((p) => p.id === selectedPackageId)) {
      setSelectedPackageId(availablePackages[0].id);
      setSelectedTime(null);
    }
  }, [availablePackages, selectedPackageId]);

  // 套餐/日期变化时重置时段
  useEffect(() => {
    setSelectedTime(null);
  }, [selectedPackageId, selectedDate]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 1800);
  };

  const handleSubmit = () => {
    if (!selectedTime) {
      showToast('请先选择时段', 'error');
      return;
    }
    setShowPhoneModal(true);
  };

  const handlePhoneConfirm = () => {
    const phone = phoneInput.trim();
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      showToast('请输入正确的手机号', 'error');
      return;
    }
    const newB = addBooking({
      storeId,
      packageId: selectedPackage.id,
      service: selectedPackage.title,
      date: selectedDate,
      startTime: selectedTime!,
      endTime: calcEndTime(selectedTime!, selectedPackage.duration),
      duration: selectedPackage.duration,
      stylistId: null,
      price: selectedPackage.price,
      phone,
    });
    // 保存到手机号簿
    addPhone(phone, phoneNameInput.trim() || undefined);
    setShowPhoneModal(false);
    setPhoneInput('');
    setPhoneNameInput('');
    setSuccessBooking(newB);
    setSelectedTime(null);
  };

  const handleCancelBooking = (id: string) => {
    cancelBooking(id);
    showToast('已取消', 'success');
  };

  const confirmedCount = storeBookings.filter((b) => b.status === 'confirmed').length;
  const morningSlots = slots.filter((s) => s.time >= '06:00' && s.time <= '11:30');
  const noonSlots = slots.filter((s) => s.time === '12:00' || s.time === '12:30');
  const afternoonSlots = slots.filter((s) => s.time >= '13:00' && s.time <= '17:30');
  const eveningSlots = slots.filter((s) => s.time >= '18:00');
  const selectedDateInfo = futureDates.find((d) => d.date === selectedDate);

  // 周视图相关：把 futureDates 按 7 天一组分周
  const [weekIndex, setWeekIndex] = useState(0);
  const totalWeeks = Math.ceil(futureDates.length / 7);
  const currentWeekDates = futureDates.slice(weekIndex * 7, weekIndex * 7 + 7);
  // 本周第一天与最后一天（用于标题"X月Y日 - X月Z日"）
  const weekFirst = currentWeekDates[0];
  const weekLast = currentWeekDates[currentWeekDates.length - 1];
  const weekRangeText = weekFirst && weekLast
    ? (weekFirst.date.split('-')[1] === weekLast.date.split('-')[1]
        ? `${Number(weekFirst.date.split('-')[1])}月${Number(weekFirst.date.split('-')[2])}日 - ${Number(weekLast.date.split('-')[2])}日`
        : `${Number(weekFirst.date.split('-')[1])}月${Number(weekFirst.date.split('-')[2])}日 - ${Number(weekLast.date.split('-')[1])}月${Number(weekLast.date.split('-')[2])}日`)
    : '';
  const weekLabel = weekIndex === 0 ? '本周' : weekIndex === 1 ? '下周' : weekIndex === 2 ? '下下周' : `第 ${weekIndex + 1} 周`;

  // 切换日期时，如果跨周，自动同步 weekIndex
  useEffect(() => {
    if (!selectedDate) return;
    const idx = Math.floor(futureDates.findIndex((d) => d.date === selectedDate) / 7);
    if (idx >= 0 && idx !== weekIndex) setWeekIndex(idx);
  }, [selectedDate]);

  return (
    <View className={styles.page}>
      {/* ===== 顶栏（仅门店切换，整合到拱形内更协调） ===== */}
      <View className={styles.header}>
        <View className={styles.headerSpacer} />
      </View>

      {/* ===== 拱形主容器 ===== */}
      <View className={styles.archCard}>
        {/* 拱形顶部 - 仅保留门店切换（预约入口已在 tabBar） */}
        <View className={styles.archTopRow}>
          <View className={styles.archTopRowItem}>
            <Button className={styles.storeBtn} onClick={() => setShowStoreModal(true)}>
              <View className={styles.storePin}>
                <View className={styles.storePinDot} />
              </View>
              <Text className={styles.storeName}>{currentStore.name}</Text>
              <View className={styles.chevron} />
            </Button>
          </View>
        </View>

        <View className={styles.archTitle}>
          <Text className={styles.archMainTitle}>潇洒佳人美学空间</Text>
          <View className={styles.archSubTitle}>
            <Text>✦ 在 线 预 约 ✦</Text>
          </View>
          <Text className={styles.archSlogan}>— 热门团购 · 一键预约 —</Text>
        </View>

        {/* 套餐选择 */}
        <View className={styles.section}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>
              <View className={styles.sectionTitleBar} />
              选择项目
              <Text className={styles.sectionCount}>（{availablePackages.length} 款）</Text>
            </Text>
          </View>
          <View className={styles.packageGrid}>
            {(() => {
              // 按 2 个一组分行
              const rows = [];
              for (let i = 0; i < availablePackages.length; i += 2) {
                rows.push(availablePackages.slice(i, i + 2));
              }
              return rows.map((row, rowIdx) => (
                <View key={rowIdx} className={styles.packageRow}>
                  {row.map((p) => {
                    const active = p.id === selectedPackageId;
                    const discount = Math.round((1 - p.price / p.originalPrice) * 100);
                    return (
                      <Button
                        key={p.id}
                        className={classNames(
                          styles.packageCard,
                          active && styles.packageCardActive,
                        )}
                        onClick={() => setSelectedPackageId(p.id)}
                      >
                        {/* 信息区 */}
                        <View className={styles.packageBody}>
                          {discount >= 50 && (
                            <View
                              className={classNames(
                                styles.discountBadge,
                                active && styles.discountBadgeActive,
                              )}
                            >
                              <Text>{discount}%off</Text>
                            </View>
                          )}
                          <View className={styles.packagePriceRow}>
                            <Text
                              className={classNames(
                                styles.packageYuan,
                                active && styles.packageYuanActive,
                              )}
                            >
                              ¥
                            </Text>
                            <Text
                              className={classNames(
                                styles.packagePrice,
                                active && styles.packagePriceActive,
                              )}
                            >
                              {p.price % 1 === 0 ? p.price : p.price.toFixed(1)}
                            </Text>
                            <Text
                              className={classNames(
                                styles.packageOrigPrice,
                                active && styles.packageOrigPriceActive,
                              )}
                            >
                              ¥{p.originalPrice}
                            </Text>
                          </View>
                          <Text
                            className={classNames(
                              styles.packageTitle,
                              active && styles.packageTitleActive,
                            )}
                          >
                            {p.title}
                          </Text>
                          <View
                            className={classNames(
                              styles.packageMeta,
                              active && styles.packageMetaActive,
                            )}
                          >
                            <Text
                              className={classNames(
                                styles.packageTag,
                                active && styles.packageTagActive,
                              )}
                            >
                              {p.tags[0]}
                            </Text>
                            <Text className={styles.packageDuration}>🕐 {p.duration}分</Text>
                          </View>
                        </View>
                      </Button>
                    );
                  })}
                </View>
              ));
            })()}
          </View>
          <View className={styles.packageDesc}>
            <Text className={styles.packageDescArrow}>▸</Text>
            <Text className={styles.packageDescText}>{selectedPackage?.subtitle}</Text>
          </View>
        </View>

        {/* 日期选择 - 周视图 */}
        <View className={styles.section}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>
              <View className={styles.sectionTitleBar} />
              选择日期
            </Text>
            <Button className={styles.datePickerBtn} onClick={() => setShowDatePicker(true)}>
              <Text>📅 月历</Text>
            </Button>
          </View>

          {/* 选中日期大字号展示 */}
          <View className={styles.dateCurrent}>
            <Text className={styles.dateCurrentBig}>
              {selectedDateInfo?.date.split('-')[1]}月
              {selectedDateInfo?.date.split('-')[2]}日
            </Text>
            <Text className={styles.dateCurrentSub}>
              {selectedDateInfo?.weekday}
              {selectedDateInfo?.isToday ? ' · 今天' : ''}
            </Text>
          </View>

          {/* 周导航栏：左箭头 / 周标签 / 右箭头 */}
          <View className={styles.weekNav}>
            <Button
              className={styles.weekArrow}
              disabled={weekIndex === 0}
              onClick={() => setWeekIndex(Math.max(0, weekIndex - 1))}
            >
              <Text className={styles.weekArrowText}>‹</Text>
            </Button>
            <View className={styles.weekInfo}>
              <Text className={styles.weekLabel}>{weekLabel}</Text>
              <Text className={styles.weekRange}>{weekRangeText}</Text>
            </View>
            <Button
              className={styles.weekArrow}
              disabled={weekIndex >= totalWeeks - 1}
              onClick={() => setWeekIndex(Math.min(totalWeeks - 1, weekIndex + 1))}
            >
              <Text className={styles.weekArrowText}>›</Text>
            </Button>
          </View>

          {/* 周内 7 天 - 横向铺满 */}
          <View className={styles.dateWeek}>
            {currentWeekDates.map((d) => {
              const active = d.date === selectedDate;
              return (
                <Button
                  key={d.date}
                  className={classNames(
                    styles.dateItem,
                    active && styles.dateItemActive,
                    !active && d.isWeekend && styles.dateItemWeekend,
                    !active && d.isToday && styles.dateItemToday,
                  )}
                  onClick={() => setSelectedDate(d.date)}
                >
                  <Text
                    className={classNames(
                      styles.dateWeekday,
                      active && styles.dateWeekdayActive,
                    )}
                  >
                    {d.isToday ? '今天' : d.weekdayShort}
                  </Text>
                  <Text
                    className={classNames(styles.dateDay, active && styles.dateDayActive)}
                  >
                    {d.day}
                  </Text>
                </Button>
              );
            })}
          </View>

          {/* 周指示点 */}
          <View className={styles.weekDots}>
            {Array.from({ length: totalWeeks }).map((_, i) => (
              <View
                key={i}
                className={classNames(styles.weekDot, i === weekIndex && styles.weekDotActive)}
                onClick={() => setWeekIndex(i)}
              />
            ))}
          </View>

          {/* 远期日期提示 */}
          {selectedDateInfo &&
            selectedDateInfo.date !== futureDates[0].date && (
              <View className={styles.dateHint}>
                <Text className={styles.dateHintText}>
                  📅 已选 {Number(selectedDateInfo.date.split('-')[1])}月
                  {Number(selectedDateInfo.date.split('-')[2])}日 {selectedDateInfo.weekday}
                </Text>
                <Button
                  className={styles.dateHintLink}
                  onClick={() => {
                    setSelectedDate(futureDates[0].date);
                    setWeekIndex(0);
                  }}
                >
                  回到今天
                </Button>
              </View>
            )}
        </View>

        {/* 时段网格 */}
        <View className={styles.section}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>
              <View className={styles.sectionTitleBar} />
              选择时段
              <Text className={styles.sectionCount}>（{slotStats.total} 个可用）</Text>
            </Text>
            {/* 管理员入口 - 长按进入（隐藏按钮） */}
            <View
              className={styles.adminEntry}
              onLongPress={() => {
                Taro.navigateTo({ url: '/pages/admin/index' });
              }}
            >
              <Text>·</Text>
            </View>
          </View>

          {morningSlots.length > 0 && (
            <View className={styles.slotBlock}>
              <View className={styles.slotBlockLabel}>
                <View className={styles.slotBlockLabelLine} />
                <Text>上午</Text>
                <View className={styles.slotBlockLabelLine} />
              </View>
              <View className={styles.slotGrid}>
                {morningSlots.map((s) => {
                  const active = selectedTime === s.time;
                  return (
                    <View
                      key={s.time}
                      className={classNames(
                        styles.slotBtn,
                        active && styles.slotBtnActive,
                        !s.available && styles.slotBtnDisabled,
                      )}
                      onClick={() => s.available && setSelectedTime(s.time)}
                    >
                      <Text
                        className={styles.slotBtnTime}
                        style={{
                          color: !s.available
                            ? 'rgba(112, 54, 67, 0.4)'
                            : active
                              ? '#D4B87A'
                              : '#59202E',
                        }}
                      >
                        {s.time}
                      </Text>
                      {/* 容量角标：仅当容量 >1 或有已预约时显示 */}
                      {s.capacity !== undefined && (s.capacity > 1 || (s.booked ?? 0) > 0) && (
                        <Text
                          className={classNames(
                            styles.slotBadge,
                            active && styles.slotBadgeActive,
                          )}
                        >
                          {s.booked ?? 0}/{s.capacity}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {noonSlots.length > 0 && (
            <View className={styles.slotBlock}>
              <View className={styles.slotBlockLabel}>
                <View className={styles.slotBlockLabelLine} />
                <Text>中午</Text>
                <View className={styles.slotBlockLabelLine} />
              </View>
              <View className={styles.slotGrid}>
                {noonSlots.map((s) => {
                  const active = selectedTime === s.time;
                  return (
                    <View
                      key={s.time}
                      className={classNames(
                        styles.slotBtn,
                        active && styles.slotBtnActive,
                        !s.available && styles.slotBtnDisabled,
                      )}
                      onClick={() => s.available && setSelectedTime(s.time)}
                    >
                      <Text
                        className={styles.slotBtnTime}
                        style={{
                          color: !s.available
                            ? 'rgba(112, 54, 67, 0.4)'
                            : active
                              ? '#D4B87A'
                              : '#59202E',
                        }}
                      >
                        {s.time}
                      </Text>
                      {s.capacity !== undefined && (s.capacity > 1 || (s.booked ?? 0) > 0) && (
                        <Text
                          className={classNames(
                            styles.slotBadge,
                            active && styles.slotBadgeActive,
                          )}
                        >
                          {s.booked ?? 0}/{s.capacity}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {afternoonSlots.length > 0 && (
            <View className={styles.slotBlock}>
              <View className={styles.slotBlockLabel}>
                <View className={styles.slotBlockLabelLine} />
                <Text>下午</Text>
                <View className={styles.slotBlockLabelLine} />
              </View>
              <View className={styles.slotGrid}>
                {afternoonSlots.map((s) => {
                  const active = selectedTime === s.time;
                  return (
                    <View
                      key={s.time}
                      className={classNames(
                        styles.slotBtn,
                        active && styles.slotBtnActive,
                        !s.available && styles.slotBtnDisabled,
                      )}
                      onClick={() => s.available && setSelectedTime(s.time)}
                    >
                      <Text
                        className={styles.slotBtnTime}
                        style={{
                          color: !s.available
                            ? 'rgba(112, 54, 67, 0.4)'
                            : active
                              ? '#D4B87A'
                              : '#59202E',
                        }}
                      >
                        {s.time}
                      </Text>
                      {s.capacity !== undefined && (s.capacity > 1 || (s.booked ?? 0) > 0) && (
                        <Text
                          className={classNames(
                            styles.slotBadge,
                            active && styles.slotBadgeActive,
                          )}
                        >
                          {s.booked ?? 0}/{s.capacity}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {eveningSlots.length > 0 && (
            <View className={styles.slotBlock}>
              <View className={styles.slotBlockLabel}>
                <View className={styles.slotBlockLabelLine} />
                <Text>晚上</Text>
                <View className={styles.slotBlockLabelLine} />
              </View>
              <View className={styles.slotGrid}>
                {eveningSlots.map((s) => {
                  const active = selectedTime === s.time;
                  return (
                    <View
                      key={s.time}
                      className={classNames(
                        styles.slotBtn,
                        active && styles.slotBtnActive,
                        !s.available && styles.slotBtnDisabled,
                      )}
                      onClick={() => s.available && setSelectedTime(s.time)}
                    >
                      <Text
                        className={styles.slotBtnTime}
                        style={{
                          color: !s.available
                            ? 'rgba(112, 54, 67, 0.4)'
                            : active
                              ? '#D4B87A'
                              : '#59202E',
                        }}
                      >
                        {s.time}
                      </Text>
                      {s.capacity !== undefined && (s.capacity > 1 || (s.booked ?? 0) > 0) && (
                        <Text
                          className={classNames(
                            styles.slotBadge,
                            active && styles.slotBadgeActive,
                          )}
                        >
                          {s.booked ?? 0}/{s.capacity}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {slotStats.total === 0 && (
            <View className={styles.slotEmpty}>
              <Text>该日期暂无可用时段，请选择其他日期</Text>
            </View>
          )}
        </View>

        {/* 虚线分隔 */}
        <View className={styles.divider} />

        {/* 联系信息 + 预约须知 */}
        <View className={styles.contact}>
          <View className={styles.contactRow}>
            <Text>📞</Text>
            <Text className={styles.contactPhone}>{currentStore.phone}</Text>
            <Text className={styles.contactDot}>·</Text>
            <Text className={styles.contactHours}>{currentStore.businessHours}</Text>
          </View>
          <Text className={styles.contactAddr}>{currentStore.address}</Text>
          <Button className={styles.noticeBtn} onClick={() => setShowNoticeModal(true)}>
            <Text>📋 预约须知（迟到 / 改期 / 加班）</Text>
          </Button>
        </View>
      </View>

      {/* ===== 粘性 CTA ===== */}
      <View className={styles.cta}>
        <View className={styles.ctaInner}>
          <View className={styles.ctaLeft}>
            <Text className={styles.ctaSummary}>
              {selectedPackage?.title} · {selectedDate.slice(5)}{' '}
              {selectedTime || '请选时段'}
            </Text>
            <View className={styles.ctaPriceRow}>
              <Text className={styles.ctaPriceLabel}>合计</Text>
              <Text className={styles.ctaPrice}>¥{selectedPackage?.price}</Text>
              <Text className={styles.ctaPriceStrike}>¥{selectedPackage?.originalPrice}</Text>
            </View>
          </View>
          <Button
            className={classNames(styles.ctaBtn, !selectedTime && styles.ctaBtnDisabled)}
            disabled={!selectedTime}
            onClick={handleSubmit}
          >
            <Text>{selectedTime ? '立即预约' : '选时段'}</Text>
          </Button>
        </View>
      </View>

      {/* ===== 弹窗 ===== */}
      {showStoreModal && (
        <View className={styles.modalMask} onClick={() => setShowStoreModal(false)}>
          <View className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>选择门店</Text>
              <Button className={styles.modalClose} onClick={() => setShowStoreModal(false)}>
                <Text>×</Text>
              </Button>
            </View>
            {STORES.map((s) => {
              const active = s.id === storeId;
              return (
                <Button
                  key={s.id}
                  className={classNames(
                    styles.storeOption,
                    active && styles.storeOptionActive,
                  )}
                  onClick={() => {
                    setStoreId(s.id);
                    setShowStoreModal(false);
                    showToast('已切换门店');
                  }}
                >
                  <Text
                    className={classNames(
                      styles.storeOptionName,
                      active && styles.storeOptionNameActive,
                    )}
                  >
                    {s.name}
                  </Text>
                  <Text
                    className={classNames(
                      styles.storeOptionMeta,
                      active && styles.storeOptionMetaActive,
                    )}
                  >
                    📞 {s.phone} · 🕐 {s.businessHours}
                  </Text>
                  <Text
                    className={classNames(
                      styles.storeOptionMeta,
                      active && styles.storeOptionMetaActive,
                    )}
                  >
                    📍 {s.address}
                  </Text>
                </Button>
              );
            })}
          </View>
        </View>
      )}

      {showBookingsModal && (
        <View className={styles.modalMask} onClick={() => setShowBookingsModal(false)}>
          <View className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>我的预约</Text>
              <Button className={styles.modalClose} onClick={() => setShowBookingsModal(false)}>
                <Text>×</Text>
              </Button>
            </View>
            {storeBookings.length === 0 ? (
              <View className={styles.bookingEmpty}>
                <Text>暂无预约</Text>
              </View>
            ) : (
              storeBookings.map((b) => (
                <View key={b.id} className={styles.bookingItem}>
                  <View className={styles.bookingItemHeader}>
                    <Text className={styles.bookingItemTitle}>{b.service}</Text>
                    <Text
                      className={classNames(
                        styles.bookingItemStatus,
                        b.status === 'cancelled' && styles.bookingItemStatusCancelled,
                      )}
                    >
                      {b.status === 'confirmed' ? '已确认' : b.status === 'cancelled' ? '已取消' : '已完成'}
                    </Text>
                  </View>
                  <View className={styles.bookingItemMeta}>
                    <Text>📅 {b.date}</Text>
                    <Text>🕐 {b.startTime} - {b.endTime}</Text>
                  </View>
                  <View className={styles.bookingItemMeta}>
                    <Text>💰 ¥{b.price}</Text>
                    <Text>📞 {b.phone}</Text>
                  </View>
                  {b.status === 'confirmed' && (
                    <View className={styles.bookingItemActions}>
                      <Button
                        className={styles.cancelBtn}
                        onClick={() => handleCancelBooking(b.id)}
                      >
                        <Text>取消预约</Text>
                      </Button>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        </View>
      )}

      {showPhoneModal && (
        <View className={styles.modalMask}>
          <View className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>确认预约</Text>
              <Button
                className={styles.modalClose}
                onClick={() => {
                  setShowPhoneModal(false);
                  setPhoneInput('');
                }}
              >
                <Text>×</Text>
              </Button>
            </View>

            {/* 手机号簿 - 历史选择 */}
            {phones.length > 0 && (
              <View className={styles.phoneBook}>
                <View className={styles.phoneBookHeader}>
                  <Text>📱 常用手机号</Text>
                  <Text className={styles.phoneBookHint}>点击快速选择</Text>
                </View>
                <ScrollView scrollX className={styles.phoneBookScroll}>
                  <View className={styles.phoneBookList}>
                    {phones.slice(0, 10).map((p) => (
                      <View
                        key={p.id}
                        className={classNames(
                          styles.phoneBookItem,
                          phoneInput === p.phone && styles.phoneBookItemActive,
                        )}
                        onClick={() => setPhoneInput(p.phone)}
                      >
                        <Text className={styles.phoneBookPhone}>{p.phone}</Text>
                        {p.name && <Text className={styles.phoneBookName}>{p.name}</Text>}
                        <Text className={styles.phoneBookCount}>×{p.useCount}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            <Input
              className={styles.phoneInput}
              type="number"
              maxlength={11}
              placeholder="请输入手机号"
              value={phoneInput}
              onInput={(e) => setPhoneInput(e.detail.value)}
            />

            {/* 备注名（可选） */}
            <Input
              className={styles.phoneNameInput}
              maxlength={10}
              placeholder="备注名（可选，如：小美）"
              value={phoneNameInput}
              onInput={(e) => setPhoneNameInput(e.detail.value)}
            />

            <View className={styles.phoneHint}>
              <Text>
                预约项目：{selectedPackage?.title}
                {'\n'}预约时间：{selectedDate} {selectedTime} -{' '}
                {selectedTime && calcEndTime(selectedTime, selectedPackage!.duration)}
                {'\n'}预约门店：{currentStore.name}
              </Text>
            </View>
            <Button className={styles.modalActionBtn} onClick={handlePhoneConfirm}>
              <Text>确认预约</Text>
            </Button>
          </View>
        </View>
      )}

      {successBooking && (
        <View className={styles.modalMask}>
          <View className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <View className={styles.successWrap}>
              <View className={styles.successIcon}>
                <Text>✓</Text>
              </View>
              <Text className={styles.successTitle}>预约成功</Text>
              <Text className={styles.successSubTitle}>
                我们将提前 1 小时 / 30 分钟 提醒您
              </Text>
            </View>
            <View className={styles.successInfo}>
              <View className={styles.successInfoRow}>
                <Text className={styles.successInfoLabel}>服务项目</Text>
                <Text>{successBooking.service}</Text>
              </View>
              <View className={styles.successInfoRow}>
                <Text className={styles.successInfoLabel}>预约时间</Text>
                <Text>
                  {successBooking.date} {successBooking.startTime}-{successBooking.endTime}
                </Text>
              </View>
              <View className={styles.successInfoRow}>
                <Text className={styles.successInfoLabel}>预约门店</Text>
                <Text>{currentStore.name}</Text>
              </View>
              <View className={styles.successInfoRow}>
                <Text className={styles.successInfoLabel}>联系电话</Text>
                <Text>{successBooking.phone}</Text>
              </View>
            </View>
            <Button
              className={styles.modalActionBtn}
              onClick={() => {
                setSuccessBooking(null);
                setShowBookingsModal(true);
              }}
            >
              <Text>查看我的预约</Text>
            </Button>
            <Button
              className={styles.modalActionBtn}
              style={{ background: 'transparent', color: '#8B6914', marginTop: 16 }}
              onClick={() => setSuccessBooking(null)}
            >
              <Text>继续预约</Text>
            </Button>

            {/* 微信订阅授权 - 开启微信通知（避免错过） */}
            <Button
              className={styles.subscribeBtn}
              onClick={async () => {
                const { requestSubscribeMessage, WX_TMPL_IDS } = await import('@/services/wechat');
                const res = await requestSubscribeMessage([
                  WX_TMPL_IDS.reminder1h,
                  WX_TMPL_IDS.reminder30m,
                ]);
                if (res.accepted.length > 0) {
                  showToast(`✓ 已开启 ${res.accepted.length} 项微信通知`, 'success');
                } else {
                  showToast('未授权，可在「我的」中重新开启', 'error');
                }
              }}
            >
              <Text>🔔 开启微信通知（1小时/30分钟）</Text>
            </Button>
          </View>
        </View>
      )}

      {showNoticeModal && (
        <View className={styles.modalMask} onClick={() => setShowNoticeModal(false)}>
          <View className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>预约须知</Text>
              <Button className={styles.modalClose} onClick={() => setShowNoticeModal(false)}>
                <Text>×</Text>
              </Button>
            </View>
            <View className={styles.noticeContent}>
              <View className={styles.noticeSection}>
                <View className={styles.noticeHeading}>
                  <Text>🕐 关于迟到</Text>
                </View>
                <Text className={styles.noticeText}>
                  请准时到店，迟到超过 15 分钟化妆师可能已被安排其他顾客，建议提前改约。
                </Text>
              </View>
              <View className={styles.noticeSection}>
                <View className={styles.noticeHeading}>
                  <Text>📅 关于改期</Text>
                </View>
                <Text className={styles.noticeText}>
                  如需改期请提前 2 小时联系门店（{currentStore.phone}），避免占用名额。
                </Text>
              </View>
              <View className={styles.noticeSection}>
                <View className={styles.noticeHeading}>
                  <Text>💼 关于加班</Text>
                </View>
                <Text className={styles.noticeText}>
                  21:00 之后为加班时段，需加收 ¥50 加班费，请提前与门店沟通。
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {showDatePicker && (
        <View className={styles.modalMask} onClick={() => setShowDatePicker(false)}>
          <View className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>选择日期</Text>
              <Button className={styles.modalClose} onClick={() => setShowDatePicker(false)}>
                <Text>×</Text>
              </Button>
            </View>

            <DatePickerCalendar
              futureDates={futureDates}
              todayDate={todayDate}
              selectedDate={selectedDate}
              maxMonths={6}
              onSelect={(d) => {
                setSelectedDate(d);
                setSelectedTime(null);
                setShowDatePicker(false);
              }}
            />
          </View>
        </View>
      )}

      {/* Toast */}
      {toast && (
        <View
          className={classNames(
            styles.toast,
            toast.type === 'success' ? styles.toastSuccess : styles.toastError,
          )}
        >
          <Text>{toast.msg}</Text>
        </View>
      )}
    </View>
  );
};

export default IndexPage;