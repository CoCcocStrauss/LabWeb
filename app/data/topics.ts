export const TOPIC_KEYS = ["fertility", "ai"] as const;

export type TopicKey = (typeof TOPIC_KEYS)[number];

export function isTopicKey(value: string): value is TopicKey {
  return (TOPIC_KEYS as readonly string[]).includes(value);
}

/** 仅用于内部/日志展示，被试实际看到的标题来自各议题材料 JSON 的 topic 字段。 */
export const TOPIC_LABELS: Record<TopicKey, string> = {
  fertility: "育儿补贴",
  ai: "AI就业",
};
