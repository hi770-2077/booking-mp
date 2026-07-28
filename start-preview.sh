#!/bin/bash
# Taro 小程序预览服务一键启动脚本
# 解决"正在启动预览服务"卡死问题：确保依赖安装 + node_modules 存在 + dist 已构建

set -e
PROJECT_DIR="/home/shun/TRAE/output/2026-07-28/代码/booking-mp"
SCRIPT="/home/shun/TRAE/.pai/skill-update/generate-mini-app/scripts/preview-server.js"
cd "$PROJECT_DIR" || exit 1

# 1. 清理残留进程
echo "[1/5] 清理残留进程..."
pkill -9 -f "preview-server.js" 2>/dev/null || true
sleep 2

# 2. 确保 node_modules 存在
if [ ! -d "node_modules" ]; then
  echo "[2/5] 安装依赖 (首次较慢，约 1-2 分钟)..."
  npm install --no-audit --no-fund --prefer-offline --legacy-peer-deps >/dev/null 2>&1
  # ajv 兼容修复
  npm install ajv@^8 --no-audit --no-fund --legacy-peer-deps >/dev/null 2>&1
else
  echo "[2/5] 依赖已存在，跳过"
fi

# 3. 清理旧锁文件
rm -f .pai/pai-preview-server.lock .pai/pai.log
mkdir -p .pai

# 4. 启动预览服务
echo "[3/5] 启动预览服务..."
node "$SCRIPT" "$PROJECT_DIR" &
SERVER_PID=$!
sleep 5

# 5. 读取新端口
if [ -f .pai/pai-preview-server.lock ]; then
  PORT=$(cat .pai/pai-preview-server.lock | grep -oP '"port":\K[0-9]+')
  echo "[4/5] 预览服务已启动，端口 $PORT"
  echo "[5/5] 等待云端编译（首次约 15-30 秒）..."

  # 等待编译成功（最多 90 秒）
  for i in {1..18}; do
    if grep -q "编译成功" .pai/pai.log 2>/dev/null; then
      echo ""
      echo "============================================"
      echo "✅ 预览就绪！"
      echo "🔗 https://trae.mobile.volcapp.com/preview/?ws=ws://localhost:$PORT"
      echo "============================================"
      exit 0
    fi
    sleep 5
  done
  echo ""
  echo "⚠️  云端编译超时（90秒），请检查网络或手动查看 .pai/pai.log"
  exit 1
else
  echo "❌ 锁文件未生成，启动失败"
  exit 1
fi