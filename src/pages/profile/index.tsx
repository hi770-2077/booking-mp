import React from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { STORES } from '@/data/stores';
import styles from './index.module.scss';

const ProfilePage: React.FC = () => {
  const handleCall = (phone: string) => {
    Taro.makePhoneCall({ phoneNumber: phone, fail: () => {} });
  };

  const handleCopy = (text: string, label: string) => {
    Taro.setClipboardData({
      data: text,
      success: () => {
        Taro.showToast({ title: `${label}已复制`, icon: 'success' });
      },
    });
  };

  const handleOpenMap = (address: string) => {
    // 微信小程序内置 map 组件无法触发；这里使用 Taro.openLocation
    Taro.openLocation({
      latitude: 23.369,
      longitude: 104.215,
      name: address,
      address,
      scale: 16,
    });
  };

  return (
    <View className={styles.page}>
      {/* 品牌头 */}
      <View className={styles.brandCard}>
        <View>
          <Text className={styles.brandIcon}>💄</Text>
        </View>
        <View>
          <Text className={styles.brandName}>潇洒佳人美学空间</Text>
        </View>
        <View>
          <Text className={styles.brandSlogan}>— 让每个你，都是最美的自己 —</Text>
        </View>
      </View>

      {/* 门店信息 */}
      <View className={styles.section}>
        <View>
          <Text className={styles.sectionTitle}>门店信息</Text>
        </View>
        {STORES.map((s, idx) => (
          <View
            key={s.id}
            className={`${styles.cell} ${idx === STORES.length - 1 ? styles.cellLast : ''}`}
          >
            <View className={styles.cellLabel}>
              <Text className={styles.cellIcon}>🏪</Text>
              <Text>{s.name}</Text>
            </View>
            <View>
              <Text className={styles.cellValue}>{s.businessHours}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* 联系方式 */}
      <View className={styles.section}>
        <View>
          <Text className={styles.sectionTitle}>联系我们</Text>
        </View>
        {STORES.map((s, idx) => (
          <View key={s.id}>
            <View
              className={`${styles.cell} ${idx === STORES.length - 1 ? styles.cellLast : ''}`}
            >
              <View className={styles.cellLabel}>
                <Text className={styles.cellIcon}>📞</Text>
                <Text>{s.name}</Text>
              </View>
              <View style={{ display: 'flex', alignItems: 'center' }}>
                <Text className={styles.cellValue}>{s.phone}</Text>
                <View className={styles.copyBtn} onClick={() => handleCopy(s.phone, '电话')}>
                  <Text>复制</Text>
                </View>
                <View
                  className={styles.copyBtn}
                  style={{ marginLeft: 12 }}
                  onClick={() => handleCall(s.phone)}
                >
                  <Text>拨打</Text>
                </View>
              </View>
            </View>
            <View
              className={`${styles.cell} ${idx === STORES.length - 1 ? styles.cellLast : ''}`}
            >
              <View className={styles.cellLabel}>
                <Text className={styles.cellIcon}>📍</Text>
                <Text>门店地址</Text>
              </View>
              <View>
                <Text
                  className={styles.cellValue}
                  onClick={() => handleOpenMap(s.address)}
                  style={{ textDecoration: 'underline', color: '#8B6914' }}
                >
                  {s.address}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* 关于 */}
      <View className={styles.about}>
        <View>
          <Text className={styles.aboutVersion}>潇洒佳人美学空间 · 预约系统</Text>
        </View>
        <View>
          <Text>v1.0.0 · 多端统一版本</Text>
        </View>
        <View>
          <Text>覆盖：微信小程序 / 抖音小程序 / H5</Text>
        </View>
      </View>
    </View>
  );
};

export default ProfilePage;