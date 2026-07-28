// 超级管理员后台 - 容量管理 / 批量操作 / 通知
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Button, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classNames from 'classnames';
import { useBookingStore } from '@/store/useBookingStore';
import {
  isAdminAuthed,
  setAdminAuthed,
  loadAdminConfig,
  saveAdminConfig,
  capKey,
} from '@/services/storage';
import { TIME_SLOTS } from '@/utils/scheduler';
import { bootstrapReminders } from '@/services/reminder';
import type { AdminNotification } from '@/types';
import styles from './index.module.scss';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const TIME_PERIODS = [
  { key: 'morning', label: '上午', range: ['09:00', '11:30'] },
  { key: 'noon', label: '中午', range: ['12:00', '12:30'] },
  { key: 'afternoon', label: '下午', range: ['13:00', '17:30'] },
  { key: 'evening', label: '晚上', range: ['18:00', '22:30'] },
] as const;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function getDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getFutureDates(days: number): string[] {
  const list: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    list.push(getDateStr(d));
  }
  return list;
}

function getTimeInRange(start: string, end: string): string[] {
  return TIME_SLOTS.filter((t) => t >= start && t <= end);
}

const AdminPage: React.FC = () => {
  // === 登录态 ===
  const [authed, setAuthed] = useState(false);
  const [pwd, setPwd] = useState('');

  // === 状态 ===
  const [selectedDate, setSelectedDate] = useState(() => getFutureDates(1)[0]);
  const [tab, setTab] = useState<'capacity' | 'bulk' | 'notifications' | 'settings'>('capacity');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // === Store ===
  const capacities = useBookingStore((s) => s.capacities);
  const setSlotCapacity = useBookingStore((s) => s.setSlotCapacity);
  const resetSlotCapacity = useBookingStore((s) => s.resetSlotCapacity);
  const copyDayCapacities = useBookingStore((s) => s.copyDayCapacities);
  const bulkUpdateSlots = useBookingStore((s) => s.bulkUpdateSlots);
  const applyWeekdayTemplate = useBookingStore((s) => s.applyWeekdayTemplate);
  const applyWeekendTemplate = useBookingStore((s) => s.applyWeekendTemplate);
  const clearDateCapacities = useBookingStore((s) => s.clearDateCapacities);
  const bookings = useBookingStore((s) => s.bookings);
  const notifications = useBookingStore((s) => s.notifications);
  const unreadCount = useBookingStore((s) => s.unreadCount);
  const markNotificationRead = useBookingStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useBookingStore((s) => s.markAllNotificationsRead);
  const clearNotifications = useBookingStore((s) => s.clearNotifications);

  // === 批量操作 ===
  const [bulkDates, setBulkDates] = useState<string[]>([]);
  const [bulkTimeStart, setBulkTimeStart] = useState('13:00');
  const [bulkTimeEnd, setBulkTimeEnd] = useState('18:00');
  const [bulkCapacity, setBulkCapacity] = useState(2);
  const [bulkMode, setBulkMode] = useState<'overwrite' | 'increment'>('overwrite');

  // === 管理员配置 ===
  const [adminCfg, setAdminCfg] = useState(() => loadAdminConfig());

  useEffect(() => {
    setAuthed(isAdminAuthed());
  }, []);

  useEffect(() => {
    if (authed) {
      bootstrapReminders();
    }
  }, [authed]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 1800);
  };

  const handleLogin = () => {
    if (pwd === adminCfg.password) {
      setAuthed(true);
      setAdminAuthed(true);
      showToast('✓ 登录成功', 'success');
    } else {
      showToast('密码错误', 'error');
    }
  };

  const handleLogout = () => {
    setAuthed(false);
    setAdminAuthed(false);
    setPwd('');
  };

  // === 容量编辑 ===
  const handleSetCap = (time: string, val: number) => {
    const v = Math.max(0, Math.min(20, Math.floor(val)));
    setSlotCapacity(selectedDate, time, v);
  };

  // === 批量操作 ===
  const toggleBulkDate = (d: string) => {
    setBulkDates((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  };

  const selectAllWeekdays = () => {
    const list = getFutureDates(90).filter((d) => {
      const dow = new Date(d + 'T00:00:00').getDay();
      return dow >= 1 && dow <= 5;
    });
    setBulkDates(list);
  };

  const selectAllWeekends = () => {
    const list = getFutureDates(90).filter((d) => {
      const dow = new Date(d + 'T00:00:00').getDay();
      return dow === 0 || dow === 6;
    });
    setBulkDates(list);
  };

  const selectNext7Days = () => {
    setBulkDates(getFutureDates(7));
  };

  const clearBulkSelection = () => setBulkDates([]);

  const handleApplyBulk = () => {
    if (bulkDates.length === 0) {
      showToast('请先选择日期', 'error');
      return;
    }
    const times = getTimeInRange(bulkTimeStart, bulkTimeEnd);
    if (times.length === 0) {
      showToast('时段范围无效', 'error');
      return;
    }
    bulkUpdateSlots(bulkDates, times, bulkCapacity, bulkMode);
    showToast(
      `✓ 已${bulkMode === 'overwrite' ? '覆盖' : '追加'} ${bulkDates.length}天 × ${times.length}时段 = ${bulkCapacity}人`,
      'success',
    );
  };

  const handleApplyTemplate = (type: 'weekday' | 'weekend') => {
    if (bulkDates.length === 0) {
      showToast('请先选择日期', 'error');
      return;
    }
    if (type === 'weekday') {
      applyWeekdayTemplate(bulkDates);
      showToast(`✓ 已应用工作日模板到 ${bulkDates.length} 天`);
    } else {
      applyWeekendTemplate(bulkDates);
      showToast(`✓ 已应用周末模板到 ${bulkDates.length} 天`);
    }
  };

  const handleCopyFromDate = () => {
    const dates = bulkDates.filter((d) => d !== selectedDate);
    if (dates.length === 0) {
      showToast('请选择除源日期外的其他日期', 'error');
      return;
    }
    copyDayCapacities(selectedDate, dates);
    showToast(`✓ 已复制 ${selectedDate} 的容量到 ${dates.length} 天`);
  };

  const handleClearDate = (date: string) => {
    Taro.showModal({
      title: '确认清空',
      content: `清空 ${date} 的所有容量设置（恢复默认）？`,
      success: (res) => {
        if (res.confirm) {
          clearDateCapacities(date);
          showToast('✓ 已清空');
        }
      },
    });
  };

  // === 设置保存 ===
  const handleSaveConfig = () => {
    saveAdminConfig(adminCfg);
    showToast('✓ 设置已保存');
  };

  const futureDateList = useMemo(() => {
    return getFutureDates(14).map((d) => {
      const dow = new Date(d + 'T00:00:00').getDay();
      const dateObj = new Date(d + 'T00:00:00');
      return {
        date: d,
        day: dateObj.getDate(),
        weekday: WEEKDAYS[dow],
        isWeekend: dow === 0 || dow === 6,
      };
    });
  }, []);

  // === 渲染登录页 ===
  if (!authed) {
    return (
      <View className={styles.page}>
        <View className={styles.loginCard}>
          <View className={styles.loginHeader}>
            <Text className={styles.loginIcon}>🔐</Text>
            <Text className={styles.loginTitle}>超级管理员</Text>
            <Text className={styles.loginSub}>潇洒佳人美学空间 · 后台</Text>
          </View>
          <Input
            className={styles.loginInput}
            type="password"
            placeholder="请输入管理密码"
            value={pwd}
            onInput={(e) => setPwd(e.detail.value)}
            onConfirm={handleLogin}
          />
          <Button className={styles.loginBtn} onClick={handleLogin}>
            <Text>登 录</Text>
          </Button>
          <Text className={styles.loginHint}>默认密码：admin888</Text>
        </View>
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
  }

  // === 渲染后台 ===
  return (
    <View className={styles.page}>
      {/* 顶栏 */}
      <View className={styles.adminHeader}>
        <View className={styles.adminHeaderLeft}>
          <Text className={styles.adminTitle}>🛠 管理员后台</Text>
          <Text className={styles.adminSub}>
            容量 · 批量 · 通知 · 设置
          </Text>
        </View>
        <Button className={styles.logoutBtn} onClick={handleLogout}>
          <Text>退出</Text>
        </Button>
      </View>

      {/* 数据概览 */}
      <View className={styles.stats}>
        <View className={styles.statItem}>
          <Text className={styles.statNum}>{bookings.filter((b) => b.status === 'confirmed').length}</Text>
          <Text className={styles.statLabel}>已确认</Text>
        </View>
        <View className={styles.statItem}>
          <Text className={styles.statNum}>{bookings.length}</Text>
          <Text className={styles.statLabel}>总预约</Text>
        </View>
        <View className={styles.statItem}>
          <Text className={styles.statNum}>{Object.keys(capacities).length}</Text>
          <Text className={styles.statLabel}>容量配置</Text>
        </View>
        <View className={styles.statItem}>
          <Text className={styles.statNum}>{unreadCount}</Text>
          <Text className={styles.statLabel}>未读通知</Text>
        </View>
      </View>

      {/* Tab 切换 */}
      <View className={styles.tabs}>
        {[
          { key: 'capacity', label: '📊 单日编辑' },
          { key: 'bulk', label: '⚡ 批量操作' },
          { key: 'notifications', label: `🔔 通知${unreadCount > 0 ? `(${unreadCount})` : ''}` },
          { key: 'settings', label: '⚙️ 设置' },
        ].map((t) => (
          <Button
            key={t.key}
            className={classNames(styles.tab, tab === t.key && styles.tabActive)}
            onClick={() => setTab(t.key as any)}
          >
            <Text>{t.label}</Text>
          </Button>
        ))}
      </View>

      {/* 内容区 */}
      <ScrollView scrollY className={styles.body}>
        {tab === 'capacity' && (
          <View>
            {/* 日期选择 */}
            <View className={styles.datePickerRow}>
              <Text className={styles.datePickerLabel}>编辑日期：</Text>
              <ScrollView scrollX className={styles.datePickerScroll}>
                <View className={styles.datePickerList}>
                  {futureDateList.map((d) => (
                    <View
                      key={d.date}
                      className={classNames(
                        styles.datePickerItem,
                        selectedDate === d.date && styles.datePickerItemActive,
                        d.isWeekend && styles.datePickerItemWeekend,
                      )}
                      onClick={() => setSelectedDate(d.date)}
                    >
                      <Text className={styles.datePickerWeekday}>{d.weekday}</Text>
                      <Text className={styles.datePickerDay}>{d.day}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View className={styles.dateActions}>
              <Button
                className={styles.miniBtn}
                onClick={() => handleClearDate(selectedDate)}
              >
                <Text>🗑 清空此日容量</Text>
              </Button>
              <Text className={styles.dateActionsHint}>
                当前编辑：{selectedDate} · 共 {Object.keys(capacities).filter((k) => k.startsWith(selectedDate + '|')).length} 个自定义时段
              </Text>
            </View>

            {/* 按时段分组编辑 */}
            {TIME_PERIODS.map((period) => {
              const times = getTimeInRange(period.range[0], period.range[1]);
              return (
                <View key={period.key} className={styles.periodBlock}>
                  <View className={styles.periodHeader}>
                    <Text className={styles.periodTitle}>{period.label}</Text>
                    <Text className={styles.periodRange}>{period.range[0]} - {period.range[1]}</Text>
                  </View>
                  <View className={styles.capGrid}>
                    {times.map((t) => {
                      const k = capKey(selectedDate, t);
                      const cap = capacities[k];
                      const isCustom = cap !== undefined;
                      const booked = bookings.filter(
                        (b) =>
                          b.date === selectedDate &&
                          b.status !== 'cancelled' &&
                          b.startTime === t,
                      ).length;
                      return (
                        <View key={t} className={styles.capCell}>
                          <View className={styles.capTime}>
                            <Text>{t}</Text>
                          </View>
                          <View className={styles.capControl}>
                            <View
                              className={styles.capBtn}
                              onClick={() => handleSetCap(t, (cap ?? 1) - 1)}
                            >
                              <Text>−</Text>
                            </View>
                            <View
                              className={classNames(
                                styles.capValue,
                                isCustom && styles.capValueCustom,
                              )}
                            >
                              <Text>{cap ?? 1}</Text>
                            </View>
                            <View
                              className={styles.capBtn}
                              onClick={() => handleSetCap(t, (cap ?? 0) + 1)}
                            >
                              <Text>+</Text>
                            </View>
                          </View>
                          {isCustom && (
                            <View
                              className={styles.capReset}
                              onClick={() => resetSlotCapacity(selectedDate, t)}
                            >
                              <Text>重置</Text>
                            </View>
                          )}
                          {booked > 0 && (
                            <Text className={styles.capBooked}>已约 {booked}</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {tab === 'bulk' && (
          <View>
            <View className={styles.bulkSection}>
              <Text className={styles.bulkSectionTitle}>① 选择日期</Text>
              <View className={styles.bulkQuickActions}>
                <Button className={styles.bulkQuickBtn} onClick={selectNext7Days}>
                  <Text>未来7天</Text>
                </Button>
                <Button className={styles.bulkQuickBtn} onClick={selectAllWeekdays}>
                  <Text>全部工作日</Text>
                </Button>
                <Button className={styles.bulkQuickBtn} onClick={selectAllWeekends}>
                  <Text>全部周末</Text>
                </Button>
                <Button className={styles.bulkClearBtn} onClick={clearBulkSelection}>
                  <Text>清空</Text>
                </Button>
              </View>
              <Text className={styles.bulkHint}>已选 {bulkDates.length} 天</Text>
              <View className={styles.bulkDateChips}>
                {bulkDates.map((d) => (
                  <View
                    key={d}
                    className={styles.bulkDateChip}
                    onClick={() => toggleBulkDate(d)}
                  >
                    <Text>{d.slice(5)} ×</Text>
                  </View>
                ))}
              </View>
            </View>

            <View className={styles.bulkSection}>
              <Text className={styles.bulkSectionTitle}>② 时段范围</Text>
              <View className={styles.bulkTimeRange}>
                <View className={styles.bulkTimeCol}>
                  <Text className={styles.bulkTimeLabel}>开始</Text>
                  <Input
                    className={styles.bulkTimeInput}
                    type="text"
                    value={bulkTimeStart}
                    onInput={(e) => setBulkTimeStart(e.detail.value)}
                  />
                </View>
                <Text className={styles.bulkTimeDash}>→</Text>
                <View className={styles.bulkTimeCol}>
                  <Text className={styles.bulkTimeLabel}>结束</Text>
                  <Input
                    className={styles.bulkTimeInput}
                    type="text"
                    value={bulkTimeEnd}
                    onInput={(e) => setBulkTimeEnd(e.detail.value)}
                  />
                </View>
              </View>
              <View className={styles.bulkPresets}>
                {[
                  { label: '下午高峰 13-18', s: '13:00', e: '18:00' },
                  { label: '上午 9-12', s: '09:00', e: '12:00' },
                  { label: '晚间 18-22', s: '18:00', e: '22:00' },
                  { label: '全天 9-22', s: '09:00', e: '22:00' },
                ].map((p) => (
                  <Button
                    key={p.label}
                    className={styles.bulkPresetBtn}
                    onClick={() => {
                      setBulkTimeStart(p.s);
                      setBulkTimeEnd(p.e);
                    }}
                  >
                    <Text>{p.label}</Text>
                  </Button>
                ))}
              </View>
            </View>

            <View className={styles.bulkSection}>
              <Text className={styles.bulkSectionTitle}>③ 容量设置</Text>
              <View className={styles.bulkCapacityRow}>
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <View
                    key={n}
                    className={classNames(
                      styles.bulkCapChip,
                      bulkCapacity === n && styles.bulkCapChipActive,
                    )}
                    onClick={() => setBulkCapacity(n)}
                  >
                    <Text>{n === 0 ? '关' : n}</Text>
                  </View>
                ))}
                <Input
                  className={styles.bulkCapInput}
                  type="number"
                  value={String(bulkCapacity)}
                  onInput={(e) => setBulkCapacity(Number(e.detail.value) || 0)}
                />
              </View>
              <View className={styles.bulkModeRow}>
                <View
                  className={classNames(
                    styles.bulkModeChip,
                    bulkMode === 'overwrite' && styles.bulkModeChipActive,
                  )}
                  onClick={() => setBulkMode('overwrite')}
                >
                  <Text>覆盖（推荐）</Text>
                </View>
                <View
                  className={classNames(
                    styles.bulkModeChip,
                    bulkMode === 'increment' && styles.bulkModeChipActive,
                  )}
                  onClick={() => setBulkMode('increment')}
                >
                  <Text>追加 +</Text>
                </View>
              </View>
            </View>

            <Button className={styles.bulkApplyBtn} onClick={handleApplyBulk}>
              <Text>✓ 应用到 {bulkDates.length} 天 × {getTimeInRange(bulkTimeStart, bulkTimeEnd).length} 时段</Text>
            </Button>

            <View className={styles.bulkDivider} />
            <Text className={styles.bulkSectionTitle}>④ 一键模板</Text>
            <View className={styles.bulkTemplateRow}>
              <Button
                className={styles.bulkTemplateBtn}
                onClick={() => handleApplyTemplate('weekday')}
              >
                <Text>📅 应用工作日模板</Text>
                <Text className={styles.bulkTemplateHint}>13-18点=2人班</Text>
              </Button>
              <Button
                className={styles.bulkTemplateBtn}
                onClick={() => handleApplyTemplate('weekend')}
              >
                <Text>🎉 应用周末模板</Text>
                <Text className={styles.bulkTemplateHint}>13-18点=3人班</Text>
              </Button>
            </View>

            <View className={styles.bulkDivider} />
            <Text className={styles.bulkSectionTitle}>⑤ 复制某日</Text>
            <View className={styles.bulkCopyRow}>
              <Text className={styles.bulkCopyLabel}>源日期：{selectedDate}</Text>
              <Button className={styles.bulkApplyBtn} onClick={handleCopyFromDate}>
                <Text>📋 复制到已选 {bulkDates.filter((d) => d !== selectedDate).length} 天</Text>
              </Button>
            </View>
          </View>
        )}

        {tab === 'notifications' && (
          <View>
            <View className={styles.notifActions}>
              <Button
                className={styles.miniBtn}
                onClick={() => markAllNotificationsRead()}
              >
                <Text>全部标为已读</Text>
              </Button>
              <Button
                className={styles.miniBtnDanger}
                onClick={() => {
                  Taro.showModal({
                    title: '清空通知',
                    content: '确认清空所有通知？',
                    success: (r) => r.confirm && clearNotifications(),
                  });
                }}
              >
                <Text>清空</Text>
              </Button>
            </View>
            {notifications.length === 0 ? (
              <View className={styles.notifEmpty}>
                <Text>📭 暂无通知</Text>
              </View>
            ) : (
              notifications.map((n: AdminNotification) => (
                <View
                  key={n.id}
                  className={classNames(
                    styles.notifItem,
                    !n.read && styles.notifItemUnread,
                  )}
                  onClick={() => markNotificationRead(n.id)}
                >
                  <View className={styles.notifHead}>
                    <Text className={styles.notifTitle}>{n.title}</Text>
                    <Text className={styles.notifTime}>
                      {new Date(n.createdAt).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <Text className={styles.notifContent}>{n.content}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {tab === 'settings' && (
          <View>
            <View className={styles.settingGroup}>
              <Text className={styles.settingGroupTitle}>管理员密码</Text>
              <Input
                className={styles.settingInput}
                type="text"
                value={adminCfg.password}
                onInput={(e) => setAdminCfg({ ...adminCfg, password: e.detail.value })}
              />
            </View>
            <View className={styles.settingGroup}>
              <Text className={styles.settingGroupTitle}>门店接收通知</Text>
              <View className={styles.settingToggle}>
                <View
                  className={classNames(
                    styles.settingSwitch,
                    adminCfg.notificationsEnabled && styles.settingSwitchOn,
                  )}
                  onClick={() =>
                    setAdminCfg({ ...adminCfg, notificationsEnabled: !adminCfg.notificationsEnabled })
                  }
                >
                  <View className={styles.settingSwitchDot} />
                </View>
                <Text>{adminCfg.notificationsEnabled ? '开启' : '关闭'}</Text>
              </View>
              <Text className={styles.settingHint}>新预约 / 取消时通知管理员</Text>
            </View>
            <View className={styles.settingGroup}>
              <Text className={styles.settingGroupTitle}>预约提醒</Text>
              <View className={styles.settingToggle}>
                <View
                  className={classNames(
                    styles.settingSwitch,
                    adminCfg.reminderEnabled && styles.settingSwitchOn,
                  )}
                  onClick={() =>
                    setAdminCfg({ ...adminCfg, reminderEnabled: !adminCfg.reminderEnabled })
                  }
                >
                  <View className={styles.settingSwitchDot} />
                </View>
                <Text>{adminCfg.reminderEnabled ? '开启' : '关闭'}</Text>
              </View>
              <Text className={styles.settingHint}>提前 1 小时 + 30 分钟 提醒顾客</Text>
            </View>
            <Button className={styles.bulkApplyBtn} onClick={handleSaveConfig}>
              <Text>💾 保存设置</Text>
            </Button>

            <View className={styles.bulkDivider} />

            <View className={styles.settingGroup}>
              <Text className={styles.settingGroupTitle}>📊 数据统计</Text>
              <View className={styles.statRow}>
                <Text>累计预约</Text>
                <Text>{bookings.length}</Text>
              </View>
              <View className={styles.statRow}>
                <Text>已确认</Text>
                <Text>{bookings.filter((b) => b.status === 'confirmed').length}</Text>
              </View>
              <View className={styles.statRow}>
                <Text>已取消</Text>
                <Text>{bookings.filter((b) => b.status === 'cancelled').length}</Text>
              </View>
              <View className={styles.statRow}>
                <Text>容量自定义</Text>
                <Text>{Object.keys(capacities).length} 个时段</Text>
              </View>
            </View>

            <View className={styles.bulkDivider} />

            {/* 微信生态对接说明 */}
            <View className={styles.settingGroup}>
              <Text className={styles.settingGroupTitle}>📡 微信通知配置</Text>
              <View className={styles.wxHintRow}>
                <Text className={styles.wxHintLabel}>小程序订阅模板：</Text>
                <Text className={styles.wxHintValue}>需在微信公众平台申请</Text>
              </View>
              <View className={styles.wxHintRow}>
                <Text className={styles.wxHintLabel}>公众号模板：</Text>
                <Text className={styles.wxHintValue}>需服务号 + 微信认证</Text>
              </View>
              <View className={styles.wxHintRow}>
                <Text className={styles.wxHintLabel}>店员通知：</Text>
                <Text className={styles.wxHintValue}>unionid 关联后推送</Text>
              </View>
              <Text className={styles.wxHintDesc}>
                📖 完整对接文档：docs/WECHAT_NOTIFICATION_ARCHITECTURE.md
              </Text>
            </View>

            {/* 店员管理 */}
            <View className={styles.settingGroup}>
              <Text className={styles.settingGroupTitle}>👥 店员管理（演示）</Text>
              <View className={styles.staffItem}>
                <View className={styles.staffAvatar}><Text>👩</Text></View>
                <View className={styles.staffInfo}>
                  <Text className={styles.staffName}>小美（化妆师）</Text>
                  <Text className={styles.staffOpenid}>openid: 未绑定</Text>
                </View>
                <View className={styles.staffStatus}>
                  <Text>未绑定</Text>
                </View>
              </View>
              <View className={styles.staffItem}>
                <View className={styles.staffAvatar}><Text>👨</Text></View>
                <View className={styles.staffInfo}>
                  <Text className={styles.staffName}>阿杰（店长）</Text>
                  <Text className={styles.staffOpenid}>openid: 未绑定</Text>
                </View>
                <View className={styles.staffStatus}>
                  <Text>未绑定</Text>
                </View>
              </View>
              <Text className={styles.wxHintDesc}>
                店员扫码"店员绑定码"后会自动关联，本模块将自动同步绑定状态。
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

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

export default AdminPage;