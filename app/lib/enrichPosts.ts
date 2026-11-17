import type { TopicKey } from "../data/topics";
import {
  HIGH_SOURCE_AVATAR_MAP,
  HIGH_SOURCE_NAMES,
  HIGH_SOURCE_NAMES_BY_IDENTITY_BY_TOPIC,
  randomLowSourceNickname,
} from "../data/avatarPool";
import { shuffleArray, type PostItem } from "./blockRandomize";

export type PostItemWithDisplay = PostItem & {
  displayName: string;
  avatarFile?: string;
  /** enrichPosts 写入；与材料里的 identityLabel/platformLabel 相同 */
  identityLabel?: string | null;
  platformLabel?: string | null;
};

/** 为每条帖子分配展示名与头像（会话内固定）；身份描述来自材料 JSON，按当前议题查找专属身份池。 */
export function enrichPostsForDisplay(
  posts: PostItem[],
  topic: TopicKey
): PostItemWithDisplay[] {
  const namesByIdentity: Record<
    string,
    ReadonlyArray<keyof typeof HIGH_SOURCE_AVATAR_MAP>
  > = HIGH_SOURCE_NAMES_BY_IDENTITY_BY_TOPIC[topic];
  const identityQueues = new Map<
    string,
    Array<keyof typeof HIGH_SOURCE_AVATAR_MAP>
  >(
    Object.entries(namesByIdentity).map(([identity, names]) => [
      identity,
      shuffleArray([...names]),
    ])
  );
  // 兜底池优先用本议题已配置的昵称（避免跨议题串味）；
  // 若某议题尚未配置任何身份映射（如占位材料），退回全局昵称池，保证不崩溃。
  const topicNamePool = Object.values(namesByIdentity).flat();
  const fallbackHighNames = shuffleArray(
    topicNamePool.length > 0 ? [...topicNamePool] : [...HIGH_SOURCE_NAMES]
  );
  const usedHighNames = new Set<keyof typeof HIGH_SOURCE_AVATAR_MAP>();
  const usedLowNames = new Set<string>();
  const usedCandidateNames = new Set<string>();

  // identityLabel 优先；仅有 platformLabel 时用 platformLabel 作 lookup key
  const takeHighSourceName = (
    identityLabel?: string | null,
    platformLabel?: string | null
  ): keyof typeof HIGH_SOURCE_AVATAR_MAP => {
    const lookupKey = identityLabel ?? platformLabel ?? undefined;
    const identityQueue = lookupKey
      ? identityQueues.get(lookupKey)
      : undefined;
    const matchedName = identityQueue?.find((name) => !usedHighNames.has(name));
    if (matchedName) {
      usedHighNames.add(matchedName);
      return matchedName;
    }

    const fallbackName = fallbackHighNames.find(
      (name) => !usedHighNames.has(name)
    );
    if (fallbackName) {
      usedHighNames.add(fallbackName);
      return fallbackName;
    }

    // 理论上只有高信源超过 24 条时才会触发；保底轮换，避免崩溃。
    const recycledName =
      fallbackHighNames[usedHighNames.size % fallbackHighNames.length]!;
    return recycledName;
  };

  return posts.map((p) => {
    if (p.sourceLevel === "high") {
      if (p.sourceCandidates?.length) {
        // Keep the workbook's name/avatar pairs. If an author appears again,
        // reuse a candidate for that source instead of borrowing another identity.
        const candidate =
          p.sourceCandidates.find((c) => !usedCandidateNames.has(c.displayName)) ??
          p.sourceCandidates[Math.floor(Math.random() * p.sourceCandidates.length)]!;
        usedCandidateNames.add(candidate.displayName);
        return { ...p, ...candidate };
      }
      const displayName = takeHighSourceName(p.identityLabel, p.platformLabel);
      const avatarFile = HIGH_SOURCE_AVATAR_MAP[displayName];
      return { ...p, displayName, avatarFile };
    }

    let displayName = randomLowSourceNickname();
    while (usedLowNames.has(displayName)) {
      displayName = randomLowSourceNickname();
    }
    usedLowNames.add(displayName);
    return { ...p, displayName };
  });
}
