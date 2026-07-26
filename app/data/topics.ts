export const TOPIC_KEYS = ["fertility", "ai", "eldercare"] as const;

export type TopicKey = (typeof TOPIC_KEYS)[number];

export function isTopicKey(value: string): value is TopicKey {
  return (TOPIC_KEYS as readonly string[]).includes(value);
}

/** 仅用于内部/日志展示，被试实际看到的标题来自各议题材料 JSON 的 topic 字段。 */
export const TOPIC_LABELS: Record<TopicKey, string> = {
  fertility: "生育政策（三胎购房补贴）",
  ai: "AI简历筛选",
  eldercare: "养老院年轻人入住计划",
};
