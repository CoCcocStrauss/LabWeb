import before from "../data/materials/labels-before-20261122.json";
import type { TopicKey } from "../data/topics";
type Labels = { identityLabel?: string | null; platformLabel?: string | null };
/** Legacy records may contain the reviewed labels that were visible before shortening. */
export function matchesStoredLabelPair(
  topic: TopicKey,
  post: Labels & { id: string },
  shown: Labels,
): boolean {
  const same = (candidate: Labels) =>
    shown.identityLabel === (candidate.identityLabel ?? null) &&
    shown.platformLabel === (candidate.platformLabel ?? null);
  const historical = (before[topic] as Record<string, Labels>)[post.id];
  return same(post) || (!!historical && same(historical));
}
