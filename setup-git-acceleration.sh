#!/bin/bash
# GitHub 国内访问加速配置（4 种方式，挑一个用）

echo "=========================================="
echo "  GitHub 国内访问加速配置"
echo "=========================================="
echo ""

echo "1️⃣  git 协议替换为 https（最简单）"
git config --global url."https://github.com/".insteadOf "git@github.com:"
git config --global url."https://".insteadOf "git://"
echo "  ✅ 已设置"

echo ""
echo "2️⃣  配置 git 缓冲区（避免大文件失败）"
git config --global http.postBuffer 524288000
git config --global core.compression 0
echo "  ✅ 已设置"

echo ""
echo "3️⃣  如果你有 HTTP 代理（梯子），可以配这个"
echo "   git config --global http.proxy http://127.0.0.1:7890"
echo "   git config --global https.proxy http://127.0.0.1:7890"

echo ""
echo "4️⃣  如果你用 SSR/V2Ray，socks5 代理"
echo "   git config --global http.proxy socks5://127.0.0.1:1080"
echo "   git config --global https.proxy socks5://127.0.0.1:1080"

echo ""
echo "=========================================="
echo "  推荐：直接用 Vercel CLI 部署，绕过 GitHub"
echo "  cd /home/shun/TRAE/output/2026-07-28/代码/booking-mp"
echo "  ./deploy-vercel.sh prod"
echo "=========================================="
