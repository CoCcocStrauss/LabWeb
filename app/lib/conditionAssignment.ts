import { TOPIC_KEYS, type TopicKey } from "../data/topics";

export const CONDITION_N_VALUES = [8, 16, 48] as const;
export type ConditionN = (typeof CONDITION_N_VALUES)[number];

/**
 * FNV-1a 32 位哈希：纯函数、跨浏览器/服务端稳定输出，
 * 不依赖 crypto API，避免 SSR/CSR 结果不一致。
 */
function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * 按 uid 确定性分配到 3(N) × 3(topic) = 9 个被试间条件之一。
 *
 * - 同一 uid 无论刷新页面还是重新打开链接，永远分到同一组，
 *   避免"中途换组"打断实验或污染数据；
 * - 不同 uid 之间基于哈希值近似均匀散列到 9 个桶，问卷平台侧无需
 *   自己实现随机分组逻辑，只要把每个被试唯一的 uid 传过来即可；
 * - 大样本（5000~10000）下等价于完全随机分配；如未来需要严格的
 *   逐桶配额平衡，可以在此基础上升级为服务端计数的区组随机化。
 */
export function assignCondition(uid: string): {
  conditionN: ConditionN;
  topic: TopicKey;
} {
  const cell = hashString(uid) % 9;
  const conditionN = CONDITION_N_VALUES[cell % 3]!;
  const topic = TOPIC_KEYS[Math.floor(cell / 3) % 3]!;
  return { conditionN, topic };
}
