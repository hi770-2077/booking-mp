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
  // === 微信隐私协议（2023-09 后必须声明）===
  // 注：chooseContact / addPhoneContact 不需要在 requiredPrivateInfos 中声明
  // 它们通过 button open-type 触发，隐私由用户主动确认
  // requiredPrivateInfos: [],  // 暂未使用位置 API，保持空数组
  permission: {
    'scope.userLocation': {
      desc: '用于显示附近门店',
    },
  },
  // tabBar 图标说明：
  //   - H5 构建：使用 .svg（webpack 自动支持）
  //   - 小程序构建：scripts/svg2png.js 自动转 .png，并修改 dist/app.json
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