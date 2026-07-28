export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/bookings/index',
    'pages/profile/index',
    'pages/admin/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#59202E',
    navigationBarTitleText: '潇洒佳人·在线预约',
    navigationBarTextStyle: 'white',
    backgroundColor: '#59202E',
  },
  tabBar: {
    color: '#999999',
    selectedColor: '#59202E',
    backgroundColor: '#F7F2E9',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '预约',
        iconPath: 'assets/tabbar/home.svg',
        selectedIconPath: 'assets/tabbar/home-selected.svg',
      },
      {
        pagePath: 'pages/bookings/index',
        text: '我的预约',
        iconPath: 'assets/tabbar/bookings.svg',
        selectedIconPath: 'assets/tabbar/bookings-selected.svg',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/tabbar/profile.svg',
        selectedIconPath: 'assets/tabbar/profile-selected.svg',
      },
    ],
  },
});