#!/usr/bin/env node
/**
 * 微信小程序一键上传脚本
 * 用法：npm run upload:weapp
 */
const ci = require('miniprogram-ci');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const KEY = process.env.WX_KEY_PATH || '/home/shun/微信小程序上传密钥/private.wx75c67a79820b9a4f.key';

if (!require('fs').existsSync(KEY)) {
  console.error('❌ 密钥文件不存在:', KEY);
  console.error('   请在微信公众平台 → 开发管理 → 开发设置 → 生成"小程序代码上传"密钥');
  process.exit(1);
}

const project = new ci.Project({
  appid: 'wx75c67a79820b9a4f',
  type: 'miniProgram',
  projectPath: path.join(ROOT, 'dist'),
  privateKeyPath: KEY,
  ignores: ['node_modules/**/*'],
});

const version = process.env.WX_VERSION || '1.0.4';
const desc = process.env.WX_DESC || '潇洒佳人美学空间预约系统';

(async () => {
  try {
    const result = await ci.upload({
      project,
      version,
      desc,
      setting: { es6: true, minify: true },
      robot: 1,
    });
    console.log('✅ 上传成功！');
    console.log('版本:', version);
    console.log('描述:', desc);
    console.log('包大小:', result.subPackageInfo?.[0]?.size, 'bytes');
    console.log('\n下一步：登录 https://mp.weixin.qq.com → 版本管理 → 提交审核');
  } catch (err) {
    console.error('❌ 上传失败:', err.message);
    if (err.response) console.error('微信返回:', err.response);
    process.exit(1);
  }
})();