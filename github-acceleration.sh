#!/bin/bash
# GitHub 国内访问一键加速（修改 /etc/hosts）
# 适用于 Linux / macOS（需要 sudo 权限）

echo "=========================================="
echo "  GitHub 国内访问加速 - 修改 hosts 文件"
echo "=========================================="
echo ""

# GitHub 官方 IP（从 GitHub 公开文档获取）
# 参考：https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-githubs-ip-addresses
# 这些是 GitHub 提供的固定 IP，相对稳定

declare -A GITHUB_IPS=(
  ["github.com"]="20.205.243.166"
  ["github.io"]="185.199.108.133"
  ["api.github.com"]="20.205.243.166"
  ["raw.githubusercontent.com"]="185.199.108.133"
  ["codeload.github.com"]="20.205.243.166"
  ["gist.github.com"]="20.205.243.166"
  ["githubusercontent.com"]="185.199.108.133"
  ["avatars.githubusercontent.com"]="185.199.108.133"
)

echo "📝 将要添加以下 hosts 解析："
for domain in "${!GITHUB_IPS[@]}"; do
  echo "   ${GITHUB_IPS[$domain]}  $domain"
done
echo ""

# 备份原文件
if [ ! -f /etc/hosts.bak.github ]; then
  echo "💾 备份原 hosts 到 /etc/hosts.bak.github ..."
  sudo cp /etc/hosts /etc/hosts.bak.github 2>/dev/null || cp /etc/hosts /etc/hosts.bak.github 2>/dev/null || echo "  (跳过备份)"
fi

echo ""
echo "⚙️  写入 hosts（需要 sudo 密码）..."
for domain in "${!GITHUB_IPS[@]}"; do
  ip=${GITHUB_IPS[$domain]}
  # 先删除旧的
  sudo sed -i "/github\.com\|github\.io\|githubusercontent/d" /etc/hosts 2>/dev/null || sed -i "/github\.com\|github\.io\|githubusercontent/d" /etc/hosts 2>/dev/null
done

# 一次性写入（避免多次 sudo）
{
  echo ""
  echo "# GitHub 国内加速 - 由 booking-mp 项目添加"
  for domain in "${!GITHUB_IPS[@]}"; do
    echo "${GITHUB_IPS[$domain]}  $domain"
  done
} >> /tmp/hosts_addition

sudo sh -c 'cat /tmp/hosts_addition >> /etc/hosts' 2>/dev/null || cat /tmp/hosts_addition >> /etc/hosts
rm -f /tmp/hosts_addition

echo ""
echo "🔄 刷新 DNS 缓存..."
sudo systemctl restart nscd 2>/dev/null
sudo systemctl restart systemd-resolved 2>/dev/null
# macOS 用 dscacheutil
if [ "$(uname)" == "Darwin" ]; then
  sudo dscacheutil -flushcache
  sudo killall -HUP mDNSResponder
fi

echo ""
echo "=========================================="
echo "  ✅ 加速完成！"
echo "=========================================="
echo ""
echo "🧪 测试："
echo "   ping github.com          # 应该 < 100ms"
echo "   ping raw.githubusercontent.com"
echo ""
echo "📖 如果想恢复："
echo "   sudo cp /etc/hosts.bak.github /etc/hosts"
echo ""
echo "💡 更激进的方案：换 DNS 服务器"
echo "   sudo systemctl stop systemd-resolved"
echo "   sudo sh -c 'echo \"nameserver 223.5.5.5\" > /etc/resolv.conf'  # 阿里 DNS"
echo "   sudo systemctl start systemd-resolved"
echo ""
echo "🚀 现在直接部署，无需打开 GitHub："
echo "   cd /home/shun/TRAE/output/2026-07-28/代码/booking-mp"
echo "   ./deploy-vercel.sh prod"
echo ""