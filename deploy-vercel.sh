#!/bin/bash
#
# 潇洒佳人预约系统 - Vercel 一键部署脚本
# 用法：./deploy-vercel.sh [preview|prod]
#

set -e

cd "$(dirname "$0")"

echo "==========================================="
echo "  🚀 潇洒佳人预约系统 - Vercel 部署"
echo "==========================================="
echo ""

# 检查必要工具
if ! command -v vercel &> /dev/null; then
    echo "❌ 未安装 Vercel CLI"
    echo "   安装: npm install -g vercel"
    exit 1
fi

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install --legacy-peer-deps
fi

# 检查环境变量是否已配置
echo ""
echo "🔍 检查环境变量配置..."
required_vars=("MP_APPID" "MP_SECRET" "MINI_APPID" "MINI_SECRET" "STAFF_TMPL_ID" "CRON_SECRET")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo "⚠️  以下环境变量未设置："
    for var in "${missing_vars[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "请前往 https://vercel.com/dashboard 配置后重新运行"
    echo ""
    echo "或在终端设置后运行："
    for var in "${missing_vars[@]}"; do
        echo "   export $var=\"your_value\""
    done
    echo ""
    exit 1
fi

# 构建 H5（用于 Vercel 部署）
echo ""
echo "🏗️  构建 H5 版本..."
npm run build:h5

# 检查是否登录
echo ""
echo "🔐 检查 Vercel 登录状态..."
if ! vercel whoami &> /dev/null; then
    echo "请登录 Vercel..."
    vercel login
fi

# 部署
MODE=${1:-preview}
if [ "$MODE" = "prod" ]; then
    echo ""
    echo "🚀 部署到生产环境..."
    vercel --prod
else
    echo ""
    echo "🚀 部署到预览环境..."
    vercel
fi

echo ""
echo "==========================================="
echo "  ✅ 部署完成！"
echo "==========================================="
echo ""
echo "📋 部署后必做："
echo "  1. 复制部署返回的 URL"
echo "  2. 微信小程序后台 → 服务器域名 → 添加该 URL"
echo "  3. 微信服务号 → 网页授权域名 → 添加该 URL"
echo "  4. 微信开发者工具上传小程序代码"
echo ""