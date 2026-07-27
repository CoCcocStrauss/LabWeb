/**
 * 高信源：展示名与头像文件一一对应（public/avatars/ 下）。
 * 三议题（fertility/ai/eldercare）各自使用专属头像文件，互不复用。
 *
 * 头像风格分配原则（而非"每个昵称都配一张按身份定制的人像"）：
 * 真实社交平台里大多数账号并不用本人照片做头像，所以每个议题内只保留少数
 * 1～2 张贴合人设的真人风格头像（一张生活照 + 一张大头照），其余昵称使用
 * 风景 / 动漫 / 科技感 / 文艺 / （养老议题特有的）山水花卉等泛用头像，
 * 只在意境上与人设气质呼应，不要求逐一对应人脸。
 */
export const HIGH_SOURCE_AVATAR_MAP = {
  // ---------- fertility 议题（28 个昵称，专属 fert-01..28.jpg） ----------
  "安和产科林医生": "fert-01.jpg",
  "周予安产科札记": "fert-02.jpg",
  "叶澜妇产科观察": "fert-06.jpg",
  "三孩爸爸老许": "fert-04.jpg",
  "阿宁的三娃日常": "fert-05.jpg",
  "顾衡地产研究": "fert-13.jpg",
  "沈予CFA笔记": "fert-14.jpg",
  "陈知行心理学": "fert-11.jpg",
  "鹿鸣关系研究": "fert-08.jpg",
  "小满三孩日记": "fert-10.jpg",
  "赵然婚姻咨询": "fert-16.jpg",
  "修远关系笔记": "fert-27.jpg",
  "北岸时评": "fert-17.jpg",
  "向晚社会观察": "fert-25.jpg",
  "周砚社区笔记": "fert-18.jpg",
  "基层治理刘委员": "fert-12.jpg",
  "陆晨楼市观察": "fert-19.jpg",
  "方舟地产研究": "fert-07.jpg",
  "晚禾育儿说": "fert-22.jpg",
  "三宝家庭课": "fert-23.jpg",
  "许清社会工作笔记": "fert-24.jpg",
  "青梧社工课堂": "fert-26.jpg",
  "木兰权益观察": "fert-28.jpg",
  "知言女性支持": "fert-21.jpg",
  "远山政策观察": "fert-20.jpg",
  "沈知维比较研究": "fert-09.jpg",
  "明理法律笔记": "fert-15.jpg",
  "秦律师说法": "fert-03.jpg",

  // ---------- ai 议题（14 个昵称，专属 ai-01..14.jpg + 少量共享素材） ----------
  "安和招聘研究": "ai-04.jpg",
  "秋招上岸阿茶": "ai-01.jpg",
  "顾衡猎头笔记": "ai-02.jpg",
  "陈知行组织行为学": "ai-12.jpg",
  "鹿鸣算法产品笔记": "ai-13.jpg",
  "赵然招聘复盘": "ai-11.jpg",
  "修远海外HR观察": "ai-06.jpg",
  "秦律师说劳动法": "ai-08.jpg",
  "北岸职场观察": "ai-09.jpg",
  "周砚HR协会笔记": "ai-14.jpg",
  "向晚算法伦理观察": "ai-10.jpg",
  "晚禾职场说": "shared-tech-3.jpg",
  "许清就业指导笔记": "shared-anime-3.jpg",
  "木兰劳动权益观察": "shared-art-3.jpg",

  // ---------- eldercare 议题（14 个昵称，elder-*.jpg 精选 + 共享素材为主） ----------
  "安和养老运营笔记": "elder-03.jpg",
  "秋阳义工日记": "elder-02.jpg",
  "顾衡养老产业研究": "shared-tech-2.jpg",
  "陈知行老年心理学": "elder-04.jpg",
  "鹿鸣退休随笔": "elder-06.jpg",
  "赵然子女互助笔记": "shared-landscape-2.jpg",
  "修远海外养老观察": "shared-landscape-3.jpg",
  "秦律师说老年权益": "shared-art-2.jpg",
  "北岸社会观察": "shared-landscape-4.jpg",
  "周砚社区养老笔记": "shared-elderly-1.jpg",
  "向晚代际关系观察": "shared-anime-1.jpg",
  "晚禾养老说": "shared-anime-2.jpg",
  "许清社工课堂": "shared-elderly-2.jpg",
  "木兰老年权益观察": "shared-elderly-3.jpg",
} as const;

/** 用于随机分配高信源昵称时遍历（与 HIGH_SOURCE_AVATAR_MAP 键一致） */
export const HIGH_SOURCE_NAMES = Object.keys(
  HIGH_SOURCE_AVATAR_MAP
) as Array<keyof typeof HIGH_SOURCE_AVATAR_MAP>;

type HighSourceName = keyof typeof HIGH_SOURCE_AVATAR_MAP;

/**
 * 按议题 × 身份描述匹配高信源用户名，避免专业身份与昵称气质错配。
 * 三个议题（fertility / ai / eldercare）均已配好正式映射，
 * 需与对应 scripts/generate-materials-{topic}.mjs 里的
 * A_IDENTITY_MAP / B_HIGH_SOURCE_IDENTITIES 文案严格保持一致，
 * 否则匹配不上会静默落到 enrichPosts.ts 的通用兜底池。
 */
export const HIGH_SOURCE_NAMES_BY_IDENTITY_BY_TOPIC = {
  fertility: {
    "某三甲医院妇产科副主任医师": [
      "安和产科林医生",
      "周予安产科札记",
      "叶澜妇产科观察",
    ],
    "三胎家庭 · 知乎优秀答主": [
      "三孩爸爸老许",
      "阿宁的三娃日常",
    ],
    "注册金融分析师（CFA）· 某券商房地产研究员": [
      "顾衡地产研究",
      "沈予CFA笔记",
    ],
    "某985大学应用心理学副教授": [
      "陈知行心理学",
      "鹿鸣关系研究",
    ],
    "育儿博主 · 三孩妈妈": ["小满三孩日记"],
    "婚姻关系咨询师 · 二级心理咨询师": [
      "赵然婚姻咨询",
      "修远关系笔记",
    ],
    "某大学公共政策研究中心副研究员": [
      "远山政策观察",
      "沈知维比较研究",
    ],
    "执业律师 · 某律师事务所合伙人": [
      "明理法律笔记",
      "秦律师说法",
    ],
    "资深社会评论员 · 时评专栏作者": [
      "北岸时评",
      "向晚社会观察",
    ],
    "某区政协委员 · 社区治理研究者": [
      "周砚社区笔记",
      "基层治理刘委员",
    ],
    "某房地产集团市场研究总监": [
      "陆晨楼市观察",
      "方舟地产研究",
    ],
    "知名家庭教育博主 · 粉丝50万+": [
      "晚禾育儿说",
      "三宝家庭课",
    ],
    "某大学社会工作系讲师": [
      "许清社会工作笔记",
      "青梧社工课堂",
    ],
    "注册营养师 · 孕产营养方向": [
      "木兰权益观察",
      "知言女性支持",
    ],
  },
  ai: {
    "某互联网大厂HRBP · 招聘信息化产品负责人": ["安和招聘研究"],
    "秋招求职博主 · 知乎优秀答主": ["秋招上岸阿茶"],
    "资深猎头顾问 · 某猎头公司合伙人": ["顾衡猎头笔记"],
    "组织行为学研究者 · 某高校劳动关系副教授": ["陈知行组织行为学"],
    "大厂招聘算法产品经理": ["鹿鸣算法产品笔记"],
    "企业招聘负责人 · 前求职者": ["赵然招聘复盘"],
    "海外人力资源政策观察者 · 硅谷HR": ["修远海外HR观察"],
    "执业律师 · 劳动与雇佣法律师": ["秦律师说劳动法"],
    // B_HIGH_SOURCE_IDENTITIES（scripts/generate-materials-ai.mjs）对应的通用高信源身份池
    "资深职场评论员 · 时评专栏作者": ["北岸职场观察"],
    "注册人力资源管理师（一级）": ["周砚HR协会笔记"],
    "科技行业观察员 · 算法伦理研究者": ["向晚算法伦理观察"],
    "知名职场博主 · 粉丝80万+": ["晚禾职场说"],
    "某高校就业指导中心讲师": ["许清就业指导笔记"],
    "国家认证生涯规划师": ["木兰劳动权益观察"],
  },
  eldercare: {
    "某民办养老机构运营负责人": ["安和养老运营笔记"],
    "养老义工博主 · 知乎优秀答主": ["秋阳义工日记"],
    "养老产业研究员 · 某地产研究院分析师": ["顾衡养老产业研究"],
    "老年心理学研究者 · 某高校社会工作系副教授": ["陈知行老年心理学"],
    "养老院住户 · 退休教师": ["鹿鸣退休随笔"],
    "养老决策亲历者 · 子女互助交流版主": ["赵然子女互助笔记"],
    "海外养老模式观察者 · 荷兰生活多年": ["修远海外养老观察"],
    "执业律师 · 老年人权益与劳动法律师": ["秦律师说老年权益"],
    // B_HIGH_SOURCE_IDENTITIES（scripts/generate-materials-eldercare.mjs）对应的通用高信源身份池
    "资深社会观察员 · 时评专栏作者": ["北岸社会观察"],
    "某社区养老服务中心负责人": ["周砚社区养老笔记"],
    "国家二级心理咨询师 · 老年心理疏导方向": ["向晚代际关系观察"],
    "知名养老话题博主 · 粉丝60万+": ["晚禾养老说"],
    "某高校社会工作系讲师": ["许清社工课堂"],
    "国家二级公共营养师 · 老年膳食方向": ["木兰老年权益观察"],
  },
} as const satisfies Record<
  string,
  Record<string, ReadonlyArray<HighSourceName>>
>;

/** 低信源随机用户名：5～8 位，仅英文大小写与数字 */
export function randomAlphanumericDisplayName(): string {
  const len = 5 + Math.floor(Math.random() * 4);
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(Math.random() * chars.length)]!;
  }
  return s;
}

/** 根据展示用「用户名」字符串生成稳定、可读的背景色（HSL） */
export function hashDisplayNameToAvatarBg(displayName: string): string {
  let h = 0;
  for (let i = 0; i < displayName.length; i++) {
    h = (Math.imul(31, h) + displayName.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 58% 44%)`;
}
