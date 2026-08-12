/** 高信源帖子在 BehaviorExperiment（教程 Demo）中随机分配的标签对 */
export type IdentityLabelPair = {
  identityLabel: string | null;
  platformLabel: string | null;
};

export const IDENTITY_LABEL_PAIRS: readonly IdentityLabelPair[] = [
  { identityLabel: "清华大学计算机系副教授", platformLabel: null },
  { identityLabel: "华为高级算法工程师", platformLabel: null },
  { identityLabel: null, platformLabel: "科技话题优质创作者" },
  { identityLabel: "复旦大学社会学系副教授", platformLabel: "社会议题话题答主" },
  { identityLabel: "中科院自动化所研究员", platformLabel: null },
  { identityLabel: null, platformLabel: "知名科技自媒体" },
  { identityLabel: "妇产科主治医师", platformLabel: null },
  { identityLabel: "资深人力资源顾问", platformLabel: "职场话题活跃用户" },
] as const;
