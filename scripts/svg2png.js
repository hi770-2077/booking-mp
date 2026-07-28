#!/usr/bin/env node
/**
 * 构建后自动 SVG → PNG 转换
 * 微信小程序 tabBar 图标必须是 .png/.jpg/.jpeg 格式
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const DIST_TABBAR = path.join(__dirname, '..', 'dist', 'assets', 'tabbar');

if (!fs.existsSync(DIST_TABBAR)) {
  console.log('⚠️  未找到 tabbar 目录，跳过 SVG 转 PNG');
  process.exit(0);
}

console.log('🎨 开始 SVG → PNG 转换...');

try {
  execSync('pip install cairosvg --quiet 2>&1 || true', { stdio: 'inherit' });

  const script = `
import os, sys
os.chdir('${DIST_TABBAR}')
import cairosvg
for svg in [f for f in os.listdir('.') if f.endswith('.svg')]:
    png = svg.replace('.svg', '.png')
    cairosvg.svg2png(url=svg, write_to=png, output_width=81, output_height=81)
    print(f'  ✓ {svg} → {png}')
`;
  const tmpFile = '/tmp/_svg2png_inline.py';
  fs.writeFileSync(tmpFile, script);
  execSync(`python3 ${tmpFile}`, { stdio: 'inherit' });
  fs.unlinkSync(tmpFile);

  // 更新 app.json 指向 .png
  const APP_JSON = path.join(__dirname, '..', 'dist', 'app.json');
  const appJson = JSON.parse(fs.readFileSync(APP_JSON, 'utf-8'));
  if (appJson.tabBar && appJson.tabBar.list) {
    for (const item of appJson.tabBar.list) {
      if (item.iconPath && item.iconPath.endsWith('.svg')) {
        item.iconPath = item.iconPath.replace('.svg', '.png');
      }
      if (item.selectedIconPath && item.selectedIconPath.endsWith('.svg')) {
        item.selectedIconPath = item.selectedIconPath.replace('.svg', '.png');
      }
    }
    fs.writeFileSync(APP_JSON, JSON.stringify(appJson, null, 2));
    console.log('  ✓ app.json 已更新');
  }

  console.log('✅ 转换完成！');
} catch (e) {
  console.error('❌ 转换失败:', e.message);
  process.exit(1);
}