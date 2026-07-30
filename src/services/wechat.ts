// 微信生态对接封装
// 包含：
//   - requestSubscribeMessage: 订阅消息授权（前端发起，订阅后由后端发送）
//   - login: 获取 openid（小程序身份标识）
//   - getPhoneNumber: 一键获取手机号（需 button open-type=getPhoneNumber）
//   - generateMiniCode: 生成小程序码（让顾客扫码绑定）
//   - getUserProfile: 获取微信昵称+头像（用户主动授权）
//   - chooseContact: 拉起手机通讯录选择联系人
//   - addPhoneContact: 添加门店电话到通讯录
//   - makePhoneCall: 一键拨打门店电话
//   - requirePrivacyAuthorize: 隐私协议授权（合规）
//
// 注：所有"发送通知"的接口必须经过服务端，前端只能"请求授权"和"上报订阅凭证"。

import Taro from '@tarojs/taro';
import type { CustomerPhone, AdminNotification } from '@/types';

// === 平台判断 ===
export function isWechatMp(): boolean {
  // #ifdef MP-WEIXIN
  return true;
  // #endif
  // #ifndef MP-WEIXIN
  return false;
  // #endif
}

export function isH5(): boolean {
  // #ifdef H5
  return true;
  // #endif
  // #ifndef H5
  return false;
  // #endif
}

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

// ============================================================
// === 以下为 2026 年微信新增能力扩展 ===
// ============================================================

// === 7. 获取微信用户信息（昵称 + 头像） ===
// 新版：2023-04 后推荐使用 chooseAvatar + 用户主动输入昵称
// 旧版：getUserProfile 仍可用
//
// 优先使用新版，失败回退到旧版
export interface UserProfile {
  nickName: string;
  avatarUrl: string;
  gender?: 0 | 1 | 2;
  country?: string;
  province?: string;
  city?: string;
}

/** chooseAvatar 事件处理（新版） */
export function parseChooseAvatarEvent(
  detail: any,
): { avatarUrl: string } | null {
  if (!detail) return null;
  const url = detail.avatarUrl || '';
  return url ? { avatarUrl: url } : null;
}

/** 旧版 getUserProfile（兜底） */
export async function wxGetUserProfile(
  desc = '用于显示您的预约人昵称和头像',
): Promise<UserProfile | null> {
  // #ifdef MP-WEIXIN
  try {
    if (typeof Taro.getUserProfile !== 'function') return null;
    const res = await Taro.getUserProfile({ desc });
    if (res.userInfo) {
      console.info('[WxProfile] 成功', res.userInfo.nickName);
      return res.userInfo as UserProfile;
    }
  } catch (e: any) {
    console.warn('[WxProfile] 失败', e?.errMsg || e);
  }
  // #endif
  return null;
}

// === 8. 从手机通讯录选择联系人 ===
// 用法：
//   <Button openType="chooseContact" onChooseContact={handleChooseContact}>从通讯录选择</Button>
//   const handleChooseContact = (e) => {
//     const { phoneNumber, displayName } = e.detail;
//     // 自动填充手机号 + 姓名
//   }
//
// 注：此 API 必须通过 <button open-type="chooseContact"> 触发，不能用 JS 直接调用
export interface ContactInfo {
  phoneNumber: string;       // 主手机号
  displayName: string;       // 联系人姓名
  phoneNumberList: string[]; // 所有手机号（部分 Android 只有列表）
}

export function parseChooseContactEvent(
  detail: any,
): ContactInfo | null {
  if (!detail) return null;
  return {
    phoneNumber: detail.phoneNumber || '',
    displayName: detail.displayName || '',
    phoneNumberList: detail.phoneNumberList || [],
  };
}

// === 9. 添加门店到通讯录（让顾客一键保存到手机） ===
// 用法：
//   wxAddPhoneContact({ firstName: '潇洒佳人美学空间', mobilePhoneNumber: '021-xxxx' })
export async function wxAddPhoneContact(opts: {
  firstName: string;          // 联系人姓名
  mobilePhoneNumber?: string; // 手机号
  workPhoneNumber?: string;   // 工作电话（门店座机）
  organization?: string;      // 公司/门店名
  title?: string;             // 职位/标签
  remark?: string;            // 备注
}): Promise<boolean> {
  // #ifdef MP-WEIXIN
  return new Promise((resolve) => {
    Taro.addPhoneContact({
      ...opts,
      success: () => {
        console.info('[WxContact] 添加成功');
        resolve(true);
      },
      fail: (e: any) => {
        console.warn('[WxContact] 添加失败', e?.errMsg);
        resolve(false);
      },
    });
  });
  // #endif
  // #ifndef MP-WEIXIN
  return false;
  // #endif
}

// === 10. 一键拨打门店电话 ===
export async function wxMakePhoneCall(phoneNumber: string): Promise<boolean> {
  // #ifdef MP-WEIXIN
  return new Promise((resolve) => {
    Taro.makePhoneCall({
      phoneNumber,
      success: () => resolve(true),
      fail: (e: any) => {
        console.warn('[WxCall] 拨打失败', e?.errMsg);
        resolve(false);
      },
    });
  });
  // #endif
  // #ifndef MP-WEIXIN
  console.log('[WxCall] H5 暂不支持拨打', phoneNumber);
  return false;
  // #endif
}

// === 11. 隐私协议授权（合规必备） ===
// 微信要求 2023 年 9 月起所有小程序必须接入隐私协议弹窗
// 必须在调用 getUserProfile/chooseContact/getPhoneNumber 等敏感接口前确认用户已同意

export interface PrivacySetting {
  needAuthorization: boolean;
  privacyContractName?: string;
}

export async function wxGetPrivacySetting(): Promise<PrivacySetting> {
  // #ifdef MP-WEIXIN
  return new Promise((resolve) => {
    if (typeof Taro.getPrivacySetting !== 'function') {
      resolve({ needAuthorization: false });
      return;
    }
    Taro.getPrivacySetting({
      success: (res: any) =>
        resolve({
          needAuthorization: !!res.needAuthorization,
          privacyContractName: res.privacyContractName,
        }),
      fail: () => resolve({ needAuthorization: false }),
    });
  });
  // #endif
  // #ifndef MP-WEIXIN
  return { needAuthorization: false };
  // #endif
}

export async function wxRequirePrivacyAuthorize(): Promise<boolean> {
  // #ifdef MP-WEIXIN
  return new Promise((resolve) => {
    if (typeof Taro.requirePrivacyAuthorize !== 'function') {
      resolve(true);
      return;
    }
    Taro.requirePrivacyAuthorize({
      success: () => {
        console.info('[WxPrivacy] 用户已同意隐私协议');
        resolve(true);
      },
      fail: (e: any) => {
        console.warn('[WxPrivacy] 用户拒绝隐私协议', e?.errMsg);
        resolve(false);
      },
    });
  });
  // #endif
  // #ifndef MP-WEIXIN
  return true;
  // #endif
}

export async function wxOpenPrivacyContract(): Promise<void> {
  // #ifdef MP-WEIXIN
  if (typeof Taro.openPrivacyContract === 'function') {
    Taro.openPrivacyContract({});
  }
  // #endif
}

// === 12. 一键获取手机号（Button openType="getPhoneNumber"） ===
// 此接口必须在 <Button openType="getPhoneNumber"> 的回调中触发
// 微信返回 encryptedData + iv 或 cloudID，需要后端解密才能拿到真实手机号
//
// H5 / 其他环境降级：手动输入
export interface PhoneAuthEvent {
  detail: {
    errMsg: string;
    encryptedData?: string;
    iv?: string;
    cloudID?: string;
    code?: string;          // 微信新版返回 code
  };
}

/** 调用后端解密手机号 */
export async function wxDecryptPhone(opts: {
  encryptedData: string;
  iv: string;
  sessionKey?: string;        // 可选
  code?: string;              // 微信新版（推荐）
}): Promise<string | null> {
  try {
    const r = await Taro.request({
      url: 'https://booking-mp-xiaosa.vercel.app/api/wechat-mp',
      method: 'POST',
      data: {
        action: 'decrypt-phone',
        ...opts,
      },
      header: { 'Content-Type': 'application/json' },
    });
    if ((r.data as any)?.phone) return (r.data as any).phone;
    console.warn('[WxDecryptPhone] 后端未返回 phone', r.data);
  } catch (e: any) {
    console.warn('[WxDecryptPhone] 失败', e?.errMsg || e);
  }
  return null;
}

// === 13. 统一的"拉取会员卡"流程（先隐私协议 → 再 getUserProfile）===
export async function fetchMemberCardWithProfile(): Promise<UserProfile | null> {
  // 1. 先检查隐私协议
  const privacy = await wxGetPrivacySetting();
  if (privacy.needAuthorization) {
    const accepted = await wxRequirePrivacyAuthorize();
    if (!accepted) {
      Taro.showToast({ title: '需要先同意隐私协议', icon: 'none' });
      return null;
    }
  }
  // 2. 拉取用户信息
  return await wxGetUserProfile();
}

// === 14. 模拟手机号（开发环境） ===
export function mockPhone(): string {
  return '138' + String(Date.now()).slice(-8);
}