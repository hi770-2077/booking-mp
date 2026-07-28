// 微信生态对接封装
// 包含：
//   - requestSubscribeMessage: 订阅消息授权（前端发起，订阅后由后端发送）
//   - login: 获取 openid（小程序身份标识）
//   - getPhoneNumber: 一键获取手机号（需 button open-type=getPhoneNumber）
//   - generateMiniCode: 生成小程序码（让顾客扫码绑定）
//
// 注：所有"发送通知"的接口必须经过服务端，前端只能"请求授权"和"上报订阅凭证"。

import Taro from '@tarojs/taro';
import type { CustomerPhone, AdminNotification } from '@/types';

// === 配置：模板 ID（需要在微信公众平台后台申请）===
export const WX_TMPL_IDS = {
  reminder1h: '请替换为你的 1小时前提醒 模板 ID',
  reminder30m: '请替换为你的 30分钟前提醒 模板 ID',
  newBookingAdmin: '请替换为你的 新预约通知店员 模板 ID',
};

// === 1. 用户登录（获取 code，后端换 openid）===
export async function wxLogin(): Promise<string | null> {
  try {
    const res = await Taro.login();
    if (res.code) {
      console.info('[WxLogin] code=', res.code);
      // TODO: 上报到后端换取 openid + session_key
      // await api.post('/auth/wechat-login', { code: res.code });
      return res.code;
    }
  } catch (e) {
    console.error('[WxLogin] failed', e);
  }
  return null;
}

// === 2. 一键获取手机号（必须用 button open-type=getPhoneNumber）===
// 调用方式：
//   <Button openType="getPhoneNumber" onGetPhoneNumber={handleGetPhone}>
//     <Text>📱 一键获取手机号</Text>
//   </Button>
//
// handleGetPhoneNumber = async (e) => {
//   if (e.detail.errMsg === 'getPhoneNumber:ok') {
//     // e.detail.cloudID 或 e.detail.encryptedData + iv 上报后端解密
//     console.log(e.detail);
//   }
// }
export interface PhoneAuthResult {
  errMsg: string;
  encryptedData?: string;
  iv?: string;
  cloudID?: string;
}

export function handleGetPhoneNumber(
  e: { detail: PhoneAuthResult },
  onSuccess: (phone: string) => void,
  onFail?: (msg: string) => void,
): void {
  if (e.detail.errMsg !== 'getPhoneNumber:ok') {
    const msg = e.detail.errMsg || '用户取消授权';
    console.warn('[WxPhone]', msg);
    onFail?.(msg);
    return;
  }
  // 前端无法直接解密（需要 session_key）
  // 真实做法：把 encryptedData/iv 上报后端解密
  // 这里先保存到 storage，后端轮询时取走
  const payload = {
    encryptedData: e.detail.encryptedData,
    iv: e.detail.iv,
    cloudID: e.detail.cloudID,
    ts: Date.now(),
  };
  Taro.setStorageSync('xiaosa_pending_phone_auth', payload);
  console.info('[WxPhone] 已保存加密数据，等待后端解密', payload);

  // 本地开发环境：模拟一个手机号（仅用于演示）
  if (process.env.NODE_ENV === 'development') {
    const fakePhone = '138' + String(Date.now()).slice(-8);
    onSuccess(fakePhone);
  }
}

// === 3. 请求订阅消息授权（用户主动触发）===
export async function requestSubscribeMessage(
  tmplIds: string[],
): Promise<{ accepted: string[]; rejected: string[] }> {
  try {
    const res = await Taro.requestSubscribeMessage({ tmplIds });
    const accepted: string[] = [];
    const rejected: string[] = [];
    for (const id of tmplIds) {
      if (res[id] === 'accept') accepted.push(id);
      else rejected.push(id);
    }
    // 上报后端（让后端知道哪些用户授权了哪些模板）
    saveSubscribeAuth(accepted, rejected);
    console.info('[WxSubscribe]', { accepted, rejected });
    return { accepted, rejected };
  } catch (e) {
    console.error('[WxSubscribe] failed', e);
    return { accepted: [], rejected: tmplIds };
  }
}

// === 订阅授权持久化（后端查询时使用）===
const SUBSCRIBE_KEY = 'xiaosa_subscribe_auth_v1';

interface SubscribeAuth {
  openid: string;
  tmplIds: string[];
  acceptedAt: string;
}

export function saveSubscribeAuth(accepted: string[], rejected: string[]): void {
  const all = [...accepted, ...rejected];
  try {
    const existing = (Taro.getStorageSync(SUBSCRIBE_KEY) as SubscribeAuth[] | undefined) ?? [];
    // 去重保留最新
    const filtered = existing.filter((e) => !all.includes(e.openid));
    const updated: SubscribeAuth[] = [
      ...accepted.map((id) => ({
        openid: id, // 实际应该是真实 openid（需后端换）
        tmplIds: [id],
        acceptedAt: new Date().toISOString(),
      })),
      ...filtered,
    ].slice(0, 100);
    Taro.setStorageSync(SUBSCRIBE_KEY, updated);
  } catch (e) {
    console.error('[WxSubscribe] save failed', e);
  }
}

export function getSubscribeAuthList(): SubscribeAuth[] {
  try {
    return (Taro.getStorageSync(SUBSCRIBE_KEY) as SubscribeAuth[] | undefined) ?? [];
  } catch {
    return [];
  }
}

// === 4. 公众号关注链接（用于引导顾客关注公众号）===
export const OAUTH_ACCOUNT_URL = '请替换为你的公众号关注链接';

// === 5. 店员绑定 - 通过 unionid 关联公众号+小程序 ===
// 业务流程：
//   1. 店员用小程序扫"店员绑定码"
//   2. 跳转小程序携带参数（如 staff_id=xxx）
//   3. 小程序获取 openid + unionid
//   4. 上报到后端，后端把 staff_id 和 unionid 关联
//   5. 后台有新预约时，调用公众号模板消息 API 推送

export async function bindStaffByCode(qrcodeParam: string): Promise<boolean> {
  // qrcodeParam 是扫码进入携带的 scene 参数
  console.info('[BindStaff]', qrcodeParam);
  // TODO: 上报到后端
  // await api.post('/staff/bind', { code: wxLoginCode, staff_id: qrcodeParam });
  return true;
}

// === 6. 一键生成小程序码（让顾客扫码绑定，用于店员通知）===
// 必须后端调用，access_token 不能放到前端
// 前端只负责跳转扫码
export function navigateToMiniCode(scene: string): void {
  Taro.navigateTo({
    url: `/pages/qrcode/index?scene=${encodeURIComponent(scene)}`,
  });
}