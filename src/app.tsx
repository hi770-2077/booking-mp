import React, { useEffect } from 'react';
import { useDidShow } from '@tarojs/taro';
import { useBookingStore } from '@/store/useBookingStore';
import { bootstrapReminders } from '@/services/reminder';
import './app.scss';

function App(props: React.PropsWithChildren) {
  const init = useBookingStore((s) => s.init);

  useEffect(() => {
    init();
    bootstrapReminders();
  }, [init]);

  useDidShow(() => {
    // 每次回到前台时重新加载 + 调度提醒（应对页面期间触发的）
    init();
    bootstrapReminders();
  });

  return props.children;
}

export default App;