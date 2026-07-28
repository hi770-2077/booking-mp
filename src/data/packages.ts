// 套餐数据
import type { PackageItem } from '@/types';

export const PACKAGES: PackageItem[] = [
  {
    id: 'p1', title: '素颜提气妆',
    subtitle: '轻薄淡妆+专业修眉，男女通用',
    duration: 30, price: 39, originalPrice: 98, sold: 1200,
    tags: ['人气爆款', '男女通用'],
  },
  {
    id: 'p2', title: '精致全妆',
    subtitle: '眼妆+假睫毛+发型+修眉，一价全包',
    duration: 60, price: 99, originalPrice: 238, sold: 890,
    tags: ['超值全包', '热门推荐'],
  },
  {
    id: 'p3', title: '精致简妆',
    subtitle: '眼妆+修眉，假睫毛发型二选一',
    duration: 45, price: 69, originalPrice: 168, sold: 620,
    tags: ['性价比', '灵活搭配'],
  },
  {
    id: 'p4', title: '骨相定制妆',
    subtitle: '定制眼妆+五官精修+编发+假睫毛',
    duration: 90, price: 128, originalPrice: 298, sold: 650,
    tags: ['高级定制', '出片神器'],
  },
  {
    id: 'p5', title: '仪式场景妆',
    subtitle: '生日/领证/派对/写真，超长持妆',
    duration: 120, price: 168, originalPrice: 388, sold: 430,
    tags: ['超长持妆', '重要时刻'],
  },
  {
    id: 'p6', title: '精致修眉',
    subtitle: '专业眉型设计，一次性工具',
    duration: 15, price: 9.9, originalPrice: 38, sold: 2100,
    tags: ['体验价', '一客一换'],
  },
  {
    id: 'p7', title: '造型编发',
    subtitle: '宴会编发·日常造型·派对发型',
    duration: 25, price: 19.9, originalPrice: 68, sold: 1560,
    tags: ['超值体验', '快速变美'],
  },
  {
    id: 'p8', title: '到店新娘妆',
    subtitle: '婚礼全天跟妆·premium 服务',
    duration: 180, price: 598, originalPrice: 1280, sold: 86,
    tags: ['婚礼专属', '提前预约'],
  },
  {
    id: 'p9', title: '美妆课',
    subtitle: '老师带教1对1，0基础也能学会',
    duration: 120, price: 198, originalPrice: 398, sold: 320,
    tags: ['0基础可学', '小班带教'],
  },
  {
    id: 'p10', title: '皮肤护理',
    subtitle: '全程1对1，焕活肌肤自然光泽',
    duration: 120, price: 168, originalPrice: 388, sold: 240,
    tags: ['深度放松', '1对1服务'],
    storeIds: ['store_wenshan'],
  },
];