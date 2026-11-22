import type { ReadingEndData } from "../../../lib/experimentSession";
import type { PostItem } from "../../../lib/blockRandomize";
import type { PostCardData } from "../../../components/PostCard";
import { storedLabelSelection } from "../../../lib/labelSelection";
import { shuffleArray } from "../../../lib/blockRandomize";
import { canonicalJson } from "../../../lib/submissionValidation";
export const INTERACTION_COMPARISON_VERSION = "interaction-support-v1";
export type ReviewCandidate = PostCardData & {
  postId: string;
  readingOrder: number;
  liked: boolean;
  shared: boolean;
};
export type InteractionComparison = {
  version: typeof INTERACTION_COMPARISON_VERSION;
  generatedAt: number;
  startedAt: number;
  completedAt: number | null;
  activeLikedIds: string[];
  sharedIds: string[];
  candidatePostIds: string[];
  candidates: ReviewCandidate[];
  order: string[];
  strongestPostId: string | null;
  weakestPostId: string | null;
  status:
    | "pending"
    | "ranked"
    | "similar_support"
    | "no_support"
    | "single_candidate"
    | "no_interacted_posts";
  expandedIds: string[];
  reviewEvents: {
    postId: string;
    type: "expand" | "collapse";
    timestamp: number;
  }[];
  reviewIntervals: { postId: string; startedAt: number; endedAt: number }[];
};
type Data = Pick<ReadingEndData, "postOrder" | "actions" | "presentedPosts">;
export function interactionCandidates(
  data: Data,
  posts: Map<string, PostItem>,
) {
  const liked = new Set<string>(),
    sharedIds: string[] = [];
  for (const a of data.actions) {
    if (a.type === "like") liked.add(a.postId);
    else if (a.type === "unlike") liked.delete(a.postId);
    else if (a.type === "share") sharedIds.push(a.postId);
  }
  const activeLikedIds = data.postOrder.filter((id) => liked.has(id)),
    candidatePostIds = data.postOrder.filter(
      (id) => liked.has(id) || sharedIds.includes(id),
    );
  const candidates = candidatePostIds.map((id) => {
    const post = posts.get(id)!,
      author = data.presentedPosts.find((x) => x.postId === id)!;
    return {
      id,
      postId: id,
      content: post.content,
      displayName: author.displayName,
      ...(author.avatarFile ? { avatarFile: author.avatarFile } : {}),
      identityLabel: author.identityLabel,
      platformLabel: author.platformLabel,
      ...storedLabelSelection(author),
      sourceLevel: post.sourceLevel,
      readingOrder: data.postOrder.indexOf(id) + 1,
      liked: liked.has(id),
      shared: sharedIds.includes(id),
    };
  });
  return { activeLikedIds, sharedIds, candidatePostIds, candidates };
}
export function newInteractionComparison(
  data: Data,
  posts: Map<string, PostItem>,
  now = Date.now(),
): InteractionComparison {
  const base = interactionCandidates(data, posts);
  return {
    ...base,
    version: INTERACTION_COMPARISON_VERSION,
    generatedAt: now,
    startedAt: now,
    completedAt: base.candidates.length ? null : now,
    order: shuffleArray([...base.candidatePostIds]),
    strongestPostId: null,
    weakestPostId: null,
    status:
      base.candidates.length > 1
        ? "pending"
        : base.candidates.length
          ? "single_candidate"
          : "no_interacted_posts",
    expandedIds: [...base.candidatePostIds],
    reviewEvents: [],
    reviewIntervals: [],
  };
}
export const interactionCanContinue = (r: InteractionComparison) =>
  r.status === "single_candidate" ||
  r.status === "similar_support" ||
  r.status === "no_support" ||
  (r.status === "ranked" &&
    !!r.strongestPostId &&
    !!r.weakestPostId &&
    r.strongestPostId !== r.weakestPostId);
const time = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v > 0;
export function validInteractionComparison(
  value: unknown,
  data: Data,
  posts: Map<string, PostItem>,
  earliest: number,
  latest: number,
  complete = true,
): value is InteractionComparison {
  if (!value || typeof value !== "object") return false;
  const r = value as InteractionComparison,
    expected = interactionCandidates(data, posts),
    ids = expected.candidatePostIds;
  if (
    r.version !== INTERACTION_COMPARISON_VERSION ||
    !time(r.generatedAt) ||
    r.generatedAt < earliest ||
    r.startedAt !== r.generatedAt ||
    (complete && !time(r.completedAt)) ||
    (r.completedAt !== null &&
      (!time(r.completedAt) ||
        r.completedAt < r.startedAt ||
        r.completedAt > latest))
  )
    return false;
  for (const k of [
    "activeLikedIds",
    "sharedIds",
    "candidatePostIds",
    "candidates",
  ] as const)
    if (canonicalJson(r[k]) !== canonicalJson(expected[k])) return false;
  if (
    !Array.isArray(r.order) ||
    r.order.length !== ids.length ||
    new Set(r.order).size !== ids.length ||
    !r.order.every((id) => ids.includes(id))
  )
    return false;
  if (!ids.length) {
    if (r.status !== "no_interacted_posts") return false;
  } else if (ids.length === 1) {
    if (r.status !== "single_candidate") return false;
  } else if (
    (complete && !interactionCanContinue(r)) ||
    ![
      "ranked",
      "similar_support",
      "no_support",
      ...(!complete ? ["pending"] : []),
    ].includes(r.status)
  )
    return false;
  if (r.status === "ranked") {
    if (
      (r.strongestPostId !== null && !ids.includes(r.strongestPostId)) ||
      (r.weakestPostId !== null && !ids.includes(r.weakestPostId)) ||
      (r.strongestPostId !== null && r.strongestPostId === r.weakestPostId)
    )
      return false;
  } else if (r.strongestPostId !== null || r.weakestPostId !== null)
    return false;
  if (
    !Array.isArray(r.expandedIds) ||
    new Set(r.expandedIds).size !== r.expandedIds.length ||
    !r.expandedIds.every((id) => ids.includes(id)) ||
    !Array.isArray(r.reviewEvents) ||
    r.reviewEvents.length > 20000 ||
    !Array.isArray(r.reviewIntervals) ||
    r.reviewIntervals.length > 20000
  )
    return false;
  let cursor = r.startedAt;
  for (const e of r.reviewEvents) {
    if (
      !e ||
      !ids.includes(e.postId) ||
      !["expand", "collapse"].includes(e.type) ||
      !time(e.timestamp) ||
      e.timestamp < cursor ||
      e.timestamp > (r.completedAt ?? latest)
    )
      return false;
    cursor = e.timestamp;
  }
  const endById = new Map<string, number>();
  for (const interval of r.reviewIntervals) {
    if (
      !interval ||
      !ids.includes(interval.postId) ||
      !time(interval.startedAt) ||
      !time(interval.endedAt) ||
      interval.startedAt < r.startedAt ||
      interval.endedAt < interval.startedAt ||
      interval.endedAt > (r.completedAt ?? latest) ||
      interval.startedAt < (endById.get(interval.postId) ?? 0)
    )
      return false;
    endById.set(interval.postId, interval.endedAt);
  }
  return true;
}
