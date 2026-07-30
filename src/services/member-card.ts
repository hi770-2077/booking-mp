// 会员卡 + 上次预约快照（一键复用）
// 管理用户画像：昵称/头像/手机号/unionid + 上次选择的门店/项目

import {
  loadMemberCard,
  saveMemberCard,
  loadLastBooking,
  saveLastBooking,
  clearLastBooking,
} from './storage';
import type { MemberCard, LastBookingSnapshot, UserProfile } from '@/types';
import type { UserProfile as WxUserProfile } from './wechat';

// === 1. 会员卡管理 ===

/** 获取当前会员卡（可能为 null） */
export function getMemberCard(): MemberCard | null {
  return loadMemberCard();
}

/** 是否已有会员卡（昵称或手机号） */
export function hasMemberCard(): boolean {
  const card = getMemberCard();
  return !!(card && (card.nickname || card.phone));
}

/** 用微信用户信息更新会员卡 */
export function updateCardFromWechat(profile: WxUserProfile): MemberCard {
  const now = new Date().toISOString().slice(0, 10);
  const existing = loadMemberCard();
  const card: MemberCard = {
    ...existing,
    nickname: profile.nickName,
    avatarUrl: profile.avatarUrl,
    gender: profile.gender,
    country: profile.country,
    province: profile.province,
    city: profile.city,
    firstUsedAt: existing?.firstUsedAt || now,
    lastUsedAt: now,
    bookingCount: existing?.bookingCount || 0,
  };
  saveMemberCard(card);
  console.info('[MemberCard] 已更新微信信息', profile.nickName);
  return card;
}

/** 仅更新头像（新版 chooseAvatar 场景） */
export function updateCardAvatar(avatarUrl: string): MemberCard {
  const now = new Date().toISOString().slice(0, 10);
  const existing = loadMemberCard();
  const card: MemberCard = {
    ...existing,
    avatarUrl,
    firstUsedAt: existing?.firstUsedAt || now,
    lastUsedAt: now,
    bookingCount: existing?.bookingCount || 0,
  };
  saveMemberCard(card);
  return card;
}

/** 仅更新昵称（用户在输入框填入） */
export function updateCardNickname(nickname: string): MemberCard {
  const now = new Date().toISOString().slice(0, 10);
  const existing = loadMemberCard();
  const card: MemberCard = {
    ...existing,
    nickname,
    firstUsedAt: existing?.firstUsedAt || now,
    lastUsedAt: now,
    bookingCount: existing?.bookingCount || 0,
  };
  saveMemberCard(card);
  return card;
}

/** 用手机号更新会员卡 */
export function updateCardPhone(phone: string): MemberCard {
  const now = new Date().toISOString().slice(0, 10);
  const existing = loadMemberCard();
  const card: MemberCard = {
    ...existing,
    phone,
    firstUsedAt: existing?.firstUsedAt || now,
    lastUsedAt: now,
    bookingCount: existing?.bookingCount || 0,
  };
  saveMemberCard(card);
  return card;
}

/** 完成一次预约后 +1 */
export function incrementBookingCount(): MemberCard {
  const card = loadMemberCard();
  if (!card) {
    return saveMemberCard({
      firstUsedAt: new Date().toISOString().slice(0, 10),
      lastUsedAt: new Date().toISOString().slice(0, 10),
      bookingCount: 1,
    });
  }
  const updated: MemberCard = {
    ...card,
    bookingCount: (card.bookingCount || 0) + 1,
    lastUsedAt: new Date().toISOString().slice(0, 10),
  };
  saveMemberCard(updated);
  return updated;
}

/** 清空会员卡（隐私要求：用户主动清空） */
export function clearMemberCardAll(): void {
  saveMemberCard({
    firstUsedAt: new Date().toISOString().slice(0, 10),
    lastUsedAt: new Date().toISOString().slice(0, 10),
    bookingCount: 0,
  });
  clearLastBooking();
}

// === 2. 上次预约快照 ===

/** 保存预约快照（用于一键复用） */
export function saveLastSnapshot(snap: Omit<LastBookingSnapshot, 'savedAt'>): void {
  saveLastBooking({ ...snap, savedAt: new Date().toISOString() });
}

/** 获取上次预约快照 */
export function getLastSnapshot(): LastBookingSnapshot | null {
  return loadLastBooking();
}

/** 是否可以一键复用（30 天内的快照） */
export function canReuseSnapshot(): boolean {
  const snap = loadLastBooking();
  if (!snap) return false;
  const days = (Date.now() - new Date(snap.savedAt).getTime()) / (1000 * 60 * 60 * 24);
  return days <= 30;
}