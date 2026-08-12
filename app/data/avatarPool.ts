/**
 * 高信源：展示名与头像文件一一对应（public/avatars/ 下）。
 * 三议题（fertility/ai/eldercare）各自使用专属头像文件，互不复用。
 *
 * 头像风格分配原则（而非"每个昵称都配一张按身份定制的人像"）：
 * 真实社交平台里大多数账号并不用本人照片做头像，所以每个议题内只保留少数
 * 1～2 张贴合人设的真人风格头像（一张生活照 + 一张大头照），其余昵称使用
 * 风景 / 动漫 / 科技感 / 文艺 / （养老议题特有的）山水花卉等泛用头像，
 * 只在意境上与人设气质呼应，不要求逐一对应人脸。
 *
 * 昵称风格原则：昵称本身与认证身份标签（identityLabel / platformLabel）故意不挂钩——
 * 参考现在网络上常见的网名风格（文艺/俏皮/中英混杂/成年人的淡泊感），
 * 只在极少数「头像是真人肖像」的情况下，避免昵称与头像气质产生明显冲突
 * （比如老年人像头像不配特别Z世代的网络热词昵称）。低信源用户昵称同理，
 * 见下方 LOW_SOURCE_NICKNAME_POOL——高低信源之间只通过头像与认证标区分，
 * 昵称风格不做区分。
 */
export const HIGH_SOURCE_AVATAR_MAP = {
  // ---------- fertility 议题（28 个昵称，专属 fert-01..28.jpg） ----------
  "陆地行走的鱼": "fert-01.jpg",
  "岁月如歌": "fert-02.jpg",
  "云边有个小卖部": "fert-06.jpg",
  "Rainy Days": "fert-04.jpg",
  "半糖去冰": "fert-05.jpg",
  "闲云野鹤": "fert-13.jpg",
  "人间清醒本人": "fert-14.jpg",
  "Vintage Soul": "fert-11.jpg",
  "姜黄色的猫": "fert-08.jpg",
  "清风徐来": "fert-10.jpg",
  "白日梦想家": "fert-16.jpg",
  "Moonlight_": "fert-27.jpg",
  "栀子花开了吗": "fert-17.jpg",
  "一壶浊酒": "fert-25.jpg",
  "故事没有那么多": "fert-18.jpg",
  "Chill Mode": "fert-12.jpg",
  "深夜十点半": "fert-19.jpg",
  "知足常乐": "fert-07.jpg",
  "把日子过成诗": "fert-22.jpg",
  "Sunny.": "fert-23.jpg",
  "今天也要开心呀": "fert-24.jpg",
  "淡然一笑": "fert-26.jpg",
  "慢生活研究所": "fert-28.jpg",
  "Dreamer_": "fert-21.jpg",
  "月亮不见了": "fert-20.jpg",
  "静水流深": "fert-09.jpg",
  "请回答1998": "fert-15.jpg",
  "Lemon Tea": "fert-03.jpg",

  // ---------- ai 议题（14 个昵称，专属 ai-01..14.jpg + 少量共享素材） ----------
  "熬夜冠军选手": "ai-04.jpg",
  "且行且珍惜": "ai-01.jpg",
  "摸鱼选手本人": "ai-02.jpg",
  "April.": "ai-12.jpg",
  "奶茶不加冰": "ai-13.jpg",
  "随遇而安": "ai-11.jpg",
  "社恐本人上线": "ai-06.jpg",
  "Wanderlust": "ai-08.jpg",
  "追风的少年": "ai-09.jpg",
  "半亩方塘": "ai-14.jpg",
  "咕咕咕了": "ai-10.jpg",
  "Coco的日常": "shared-tech-3.jpg",
  "拖延症晚期患者": "shared-anime-3.jpg",
  "云卷云舒": "shared-art-3.jpg",

  // ---------- eldercare 议题（14 个昵称，elder-*.jpg 精选 + 共享素材为主） ----------
  "快乐水战士": "elder-03.jpg",
  "Kiwi不吃奇异果": "elder-02.jpg",
  "蹲一个好运": "shared-tech-2.jpg",
  "心宽路自宽": "elder-04.jpg",
  "夕阳正好": "elder-06.jpg",
  "Mono no aware": "shared-landscape-2.jpg",
  "废柴少女": "shared-landscape-3.jpg",
  "平淡是真": "shared-art-2.jpg",
  "芒果冰沙": "shared-landscape-4.jpg",
  "Peachy.": "shared-elderly-1.jpg",
  "一只安静的猫": "shared-anime-1.jpg",
  "粗茶淡饭也是福": "shared-anime-2.jpg",
  "山野间": "shared-elderly-2.jpg",
  "Nova_": "shared-elderly-3.jpg",
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
// key = identityLabel（有身份类标签时）或 platformLabel（仅有平台类标签时）
// 与 generate-materials-*.mjs 里的 identityKey 字段保持一一对应
export const HIGH_SOURCE_NAMES_BY_IDENTITY_BY_TOPIC = {
  fertility: {
    // A 类
    "妇产科副主任医师": [
      "陆地行走的鱼",
      "岁月如歌",
      "云边有个小卖部",
    ],
    "知乎三孩话题优质答主": [
      "Rainy Days",
      "半糖去冰",
    ],
    "注册金融分析师": [
      "闲云野鹤",
      "人间清醒本人",
    ],
    "应用心理学副教授": [
      "Vintage Soul",
      "姜黄色的猫",
    ],
    "三孩家庭成员": ["清风徐来"],
    "二级心理咨询师": [
      "白日梦想家",
      "Moonlight_",
    ],
    "中国人民大学公共政策副研究员": [
      "月亮不见了",
      "静水流深",
    ],
    "执业律师": [
      "请回答1998",
      "Lemon Tea",
    ],
    // B 类
    "时评话题优质创作者": [
      "栀子花开了吗",
      "一壶浊酒",
    ],
    "苏州市政协委员": [
      "故事没有那么多",
      "Chill Mode",
    ],
    "市场研究总监": [
      "深夜十点半",
      "知足常乐",
    ],
    "家庭教育话题博主 · 50万粉丝": [
      "把日子过成诗",
      "Sunny.",
    ],
    "华东理工大学社会工作系讲师": [
      "今天也要开心呀",
      "淡然一笑",
    ],
    "孕产健康话题活跃用户": [
      "慢生活研究所",
      "Dreamer_",
    ],
  },
  ai: {
    // A 类
    "大型互联网公司招聘负责人": ["熬夜冠军选手"],
    "知乎秋招话题优质答主": ["且行且珍惜"],
    "资深猎头顾问": ["摸鱼选手本人"],
    "中国人民大学劳动关系副教授": ["April."],
    "大厂招聘算法产品经理": ["奶茶不加冰"],
    "企业招聘负责人": ["随遇而安"],
    "硅谷科技公司HR": ["社恐本人上线"],
    "劳动法执业律师": ["Wanderlust"],
    // B 类
    "职场话题优质创作者": ["追风的少年"],
    "注册人力资源管理师（一级）": ["半亩方塘"],
    "算法伦理话题活跃用户": ["咕咕咕了"],
    "职场话题博主 · 80万粉丝": ["Coco的日常"],
    "同济大学就业指导中心讲师": ["拖延症晚期患者"],
    "国家认证生涯规划师": ["云卷云舒"],
  },
  eldercare: {
    // A 类
    "泰康之家养老院运营负责人": ["快乐水战士"],
    "知乎养老话题优质答主": ["Kiwi不吃奇异果"],
    "中指研究院养老产业分析师": ["蹲一个好运"],
    "老年心理学研究者": ["心宽路自宽"],
    "退休教师": ["夕阳正好"],
    "子女互助养老交流圈管理员": ["Mono no aware"],
    "旅居荷兰华人": ["废柴少女"],
    "老年权益执业律师": ["平淡是真"],
    // B 类
    "养老话题优质创作者": ["芒果冰沙"],
    "社区养老服务中心负责人": ["Peachy."],
    "国家二级心理咨询师（老年方向）": ["一只安静的猫"],
    "养老话题博主 · 60万粉丝": ["粗茶淡饭也是福"],
    "厦门大学社会工作系讲师": ["山野间"],
    "国家二级公共营养师（老年膳食）": ["Nova_"],
  },
} as const satisfies Record<
  string,
  Record<string, ReadonlyArray<HighSourceName>>
>;

/**
 * 低信源随机昵称池：风格与高信源昵称一致（文艺/俏皮/中英混杂/成熟淡泊），
 * 与 HIGH_SOURCE_AVATAR_MAP 里的昵称完全不重复，避免同一场会话里撞名。
 * 低信源账号没有头像图片、没有认证标，靠这一点昵称也看不出"没身份"，
 * 因为高低信源现在只通过头像与认证标区分，昵称风格上完全一致。
 */
export const LOW_SOURCE_NICKNAME_POOL = [
  "江南有雨",
  "一日三餐",
  "风很温柔",
  "无所事事的周末",
  "猫是液体",
  "抱一整个冬天",
  "阳光正好微风不燥",
  "说走就走的旅行",
  "有点甜",
  "星星糖",
  "一只自由的鱼",
  "白开水加糖",
  "慢半拍",
  "一点点热爱",
  "云朵味的糖",
  "半个夏天",
  "灰色地带",
  "平行时空的我",
  "一只安静的鹅",
  "摸鱼日记",
  "生活很好玩",
  "一杯温水",
  "顺其自然吧",
  "岁岁平安",
  "云淡风轻",
  "且看云卷云舒",
  "世事无常",
  "一念之间",
  "见路不平",
  "不慌不忙",
  "Peaceful.",
  "Serene_",
  "Quiet Days",
  "Little Star",
  "Ocean View",
  "Misty Morning",
  "Gentle Breeze",
  "Amber.",
  "Willow_",
  "Sage.",
  "悠然见南山",
  "心如止水",
  "岁月不惊",
  "山水之间",
  "一叶知秋",
  "云深不知处",
  "归去来兮",
  "采菊东篱下",
  "一蓑烟雨",
  "天地一沙鸥",
  "且听风吟",
  "落日与晚风",
  "一场雨的距离",
  "半山听雨",
  "灯火向晚",
  "一段旧时光",
  "光阴不负",
  "平凡日子",
  "微光不灭",
  "时光正好",
] as const;

/** 随机取一个低信源昵称（会话内由调用方保证不重复） */
export function randomLowSourceNickname(): string {
  const pool = LOW_SOURCE_NICKNAME_POOL;
  return pool[Math.floor(Math.random() * pool.length)]!;
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
