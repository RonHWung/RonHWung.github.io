export const site = {
  title: '茸磺 / RonHWung',
  description: '茸磺的个人主页：绘画、兽装制作、毛毛龙设定与沿途记录。',
  author: '茸磺 / RonHWung',
  birthday: '5 月 22 日',
  links: [
    { label: 'Bilibili', href: 'https://space.bilibili.com/440386902' },
    { label: 'GitHub', href: 'https://github.com/RonHWung' },
    { label: 'Steam', href: 'https://steamcommunity.com/id/ronhwung/' },
  ],
};

export const navigation = [
  { label: '首页', href: '/' },
  { label: '画室', href: '/art/' },
  { label: '做毛', href: '/making/' },
  { label: '茸磺档案', href: '/character/' },
  { label: '沿途记录', href: '/journey/' },
  { label: '时间线', href: '/timeline/' },
  { label: '友链', href: '/friends/' },
];

export const collectionMeta = {
  making: {
    eyebrow: 'A · MAKING',
    title: '把毛毛龙带到现实',
    description: '从一张张裁片到可以拥抱的茸磺，也记录和朋友一起动手的日子。',
  },
  campus: {
    eyebrow: 'B · CAMPUS',
    title: '校园里的毛茸茸日常',
    description: '草坪、湖边、舞蹈房和毕业季，因为朋友们而有了另一种记忆。',
  },
  journeys: {
    eyebrow: 'C · JOURNEYS',
    title: '去更远的地方相见',
    description: '一次次收拾行李去见熟悉的毛茸茸，相聚本身就是旅途的目的。',
  },
  celebrations: {
    eyebrow: 'D · TOGETHER',
    title: '朋友们与小小庆典',
    description: '蛋糕、桌游、礼物和相聚，生活被这些小小仪式认真地标记下来。',
  },
  portraits: {
    eyebrow: 'E · PORTRAITS',
    title: '茸磺在现实中',
    description: '从活动合照到单独拍摄：关于这只毛毛龙如何出现在现实里的照片小辑。',
  },
} as const;

export type CollectionKey = keyof typeof collectionMeta;
