/** 高信源帖子随机分配的身份描述（灰色小字，仅 sourceLevel: "high" 时展示） */
export const IDENTITY_DESCRIPTIONS = [
  "清华大学计算机系副教授",
  "某互联网大厂高级算法工程师",
  "中科院自动化所研究员",
  "知名科技自媒体主编",
  "复旦大学社会学系副教授",
  "某三甲医院妇产科主治医师",
  "资深人力资源管理顾问",
  "某央企人工智能事业部总监",
] as const;

export type IdentityDescription = (typeof IDENTITY_DESCRIPTIONS)[number];
