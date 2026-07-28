import React, { useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classNames from 'classnames';
import { useBookingStore } from '@/store/useBookingStore';
import { STORES } from '@/data/stores';
import styles from './index.module.scss';

const BookingsPage: React.FC = () => {
  const [storeId, setStoreId] = useState<string>(STORES[0].id);
  const bookings = useBookingStore((s) => s.bookings);
  const cancelBooking = useBookingStore((s) => s.cancelBooking);
  const init = useBookingStore((s) => s.init);

  const storeBookings = bookings.filter((b) => b.storeId === storeId);
  const confirmed = storeBookings.filter((b) => b.status === 'confirmed');
  const history = storeBookings.filter((b) => b.status !== 'confirmed');

  const handleCancel = (id: string) => {
    Taro.showModal({
      title: '提示',
      content: '确定取消该预约吗？',
      success: (res) => {
        if (res.confirm) {
          cancelBooking(id);
          Taro.showToast({ title: '已取消', icon: 'success' });
        }
      },
    });
  };

  const handleBook = () => {
    Taro.switchTab({ url: '/pages/index/index' });
  };

  const renderCard = (b: (typeof bookings)[number]) => {
    const statusText =
      b.status === 'confirmed' ? '已确认' : b.status === 'cancelled' ? '已取消' : '已完成';
    return (
      <View key={b.id} className={styles.bookingCard}>
        <View className={styles.cardHeader}>
          <Text className={styles.cardTitle}>{b.service}</Text>
          <Text
            className={classNames(
              styles.statusBadge,
              b.status === 'cancelled' && styles.statusCancelled,
              b.status === 'completed' && styles.statusCompleted,
            )}
          >
            {statusText}
          </Text>
        </View>
        <View className={styles.metaRow}>
          <Text className={styles.metaLabel}>📅 日期</Text>
          <Text className={styles.metaValue}>{b.date}</Text>
        </View>
        <View className={styles.metaRow}>
          <Text className={styles.metaLabel}>🕐 时段</Text>
          <Text className={styles.metaValue}>
            {b.startTime} - {b.endTime}
          </Text>
        </View>
        <View className={styles.metaRow}>
          <Text className={styles.metaLabel}>💰 金额</Text>
          <Text className={styles.priceValue}>¥{b.price}</Text>
        </View>
        <View className={styles.metaRow}>
          <Text className={styles.metaLabel}>📞 手机</Text>
          <Text className={styles.metaValue}>{b.phone}</Text>
        </View>
        {b.status === 'confirmed' && (
          <View className={styles.actions}>
            <View className={styles.cancelBtn} onClick={() => handleCancel(b.id)}>
              <Text>取消预约</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View className={styles.page}>
      <View className={styles.storeTabs}>
        {STORES.map((s) => {
          const active = s.id === storeId;
          return (
            <View
              key={s.id}
              className={classNames(styles.storeTab, active && styles.storeTabActive)}
              onClick={() => {
                setStoreId(s.id);
                init();
              }}
            >
              <Text>{s.name.replace('潇洒佳人·', '')}</Text>
            </View>
          );
        })}
      </View>

      {storeBookings.length === 0 ? (
        <View className={styles.empty}>
          <View>
            <Text className={styles.emptyIcon}>📋</Text>
          </View>
          <View>
            <Text>暂无预约记录</Text>
          </View>
          <View className={styles.bookBtn} onClick={handleBook}>
            <Text>立即预约</Text>
          </View>
        </View>
      ) : (
        <>
          {confirmed.length > 0 && (
            <View>
              {confirmed.map(renderCard)}
            </View>
          )}
          {history.length > 0 && (
            <View>
              {history.map(renderCard)}
            </View>
          )}
        </>
      )}
    </View>
  );
};

export default BookingsPage;