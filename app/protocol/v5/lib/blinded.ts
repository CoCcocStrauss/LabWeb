import type {
  ActionLog,
  SubmitExperimentDataInput,
} from "../../../lib/dataSubmit";
import type { PostItem } from "../../../lib/blockRandomize";
import { storedLabelSelection } from "../../../lib/labelSelection";
import { canonicalJson } from "../../../lib/submissionValidation";
export function activeShares(actions: ActionLog[]) {
  const ids = new Set<string>();
  for (const a of actions) {
    if (a.type === "share") ids.add(a.postId);
    else if (a.type === "unshare") ids.delete(a.postId);
  }
  return [...ids];
}
export function finalLikes(actions: ActionLog[]) {
  const ids = new Set<string>();
  for (const a of actions) {
    if (a.type === "like") ids.add(a.postId);
    else if (a.type === "unlike") ids.delete(a.postId);
  }
  return [...ids];
}
type Data = Pick<
  SubmitExperimentDataInput,
  | "actions"
  | "postOrder"
  | "presentedPosts"
  | "postVisibilitySummary"
  | "readingMetrics"
>;
export type BlindItem = {
  postId: string;
  id: string;
  content: string;
  displayName: string;
  avatarFile?: string;
  sourceLevel: "high" | "low";
  identityLabel: string | null;
  platformLabel: string | null;
  labelSelectionVersion?: "one-source-label-50-50-v1";
  displayedLabelType?: "identity" | "platform" | null;
  displayedLabelText?: string | null;
  sampleRole: "shared" | "liked_only" | "seen_uninteracted" | "fallback_unseen";
  totalVisibleMs: number;
  wasExpanded: boolean;
};
export type BlindAnswer = {
  postId: string;
  endorsementScore: number | null;
  argumentQualityScore: number | null;
  presentedAt: number | null;
  answeredAt: number | null;
  visibleMs: number;
};
export type BlindResponse = {
  version: "blind-four-v1";
  seed: number;
  generatedAt: number;
  completedAt: number | null;
  items: BlindItem[];
  order: string[];
  answers: BlindAnswer[];
};
function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}
function shuffle<T>(a: T[], r: () => number) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function sampleBlind(
  d: Data,
  posts: Map<string, PostItem>,
  seed: number,
) {
  const rand = rng(seed),
    a = activeShares(d.actions),
    likes = finalLikes(d.actions),
    seen = (id: string) => d.postVisibilitySummary[id]?.totalVisibleMs ?? 0,
    expanded = (id: string) =>
      d.readingMetrics.detailEvents.some(
        (e) => e.postId === id && e.type === "open",
      ),
    tie = (x: string, y: string) =>
      d.postOrder.indexOf(x) - d.postOrder.indexOf(y);
  const A = shuffle([...a], rand),
    B = d.postOrder
      .filter((id) => !a.includes(id) && likes.includes(id))
      .sort((x, y) => seen(y) - seen(x) || tie(x, y)),
    C = d.postOrder
      .filter((id) => !a.includes(id) && !likes.includes(id) && seen(id) > 0)
      .sort(
        (x, y) =>
          Number(expanded(y)) - Number(expanded(x)) ||
          seen(y) - seen(x) ||
          tie(x, y),
      );
  let ids: string[] = [];
  if (A.length >= 2)
    ids = [...A.slice(0, 2), ...B.slice(0, 1), ...C.slice(0, B.length ? 1 : 2)];
  else if (A.length === 1)
    ids = [...A, ...B.slice(0, 1), ...C.slice(0, B.length ? 2 : 3)];
  else ids = [...B.slice(0, 2), ...C.slice(0, 4 - Math.min(B.length, 2))];
  for (const id of [...B, ...C, ...A])
    if (ids.length < 4 && !ids.includes(id)) ids.push(id);
  const unseen = shuffle(
    d.postOrder.filter(
      (id) =>
        !ids.includes(id) &&
        !a.includes(id) &&
        !likes.includes(id) &&
        seen(id) === 0,
    ),
    rand,
  );
  for (const id of unseen) if (ids.length < 4) ids.push(id);
  const items = ids.map((id) => {
    const p = posts.get(id)!,
      u = d.presentedPosts.find((x) => x.postId === id)!;
    return {
      id,
      postId: id,
      content: p.content,
      displayName: u.displayName,
      ...(u.avatarFile ? { avatarFile: u.avatarFile } : {}),
      sourceLevel: p.sourceLevel,
      identityLabel: u.identityLabel,
      platformLabel: u.platformLabel,
      ...storedLabelSelection(u),
      sampleRole: a.includes(id)
        ? "shared"
        : likes.includes(id)
          ? "liked_only"
          : seen(id) > 0
            ? "seen_uninteracted"
            : "fallback_unseen",
      totalVisibleMs: seen(id),
      wasExpanded: expanded(id),
    } as BlindItem;
  });
  return { items, order: shuffle([...ids], rand) };
}
export function newBlind(
  d: Data,
  posts: Map<string, PostItem>,
  now = Date.now(),
  seed = crypto.getRandomValues(new Uint32Array(1))[0],
): BlindResponse {
  const sample = sampleBlind(d, posts, seed);
  return {
    version: "blind-four-v1",
    seed,
    generatedAt: now,
    completedAt: null,
    ...sample,
    answers: sample.order.map((postId) => ({
      postId,
      endorsementScore: null,
      argumentQualityScore: null,
      presentedAt: null,
      answeredAt: null,
      visibleMs: 0,
    })),
  };
}
export function validBlind(
  v: unknown,
  d: Data,
  posts: Map<string, PostItem>,
  min: number,
  max: number,
) {
  if (!v || typeof v !== "object") return false;
  const r = v as BlindResponse;
  if (
    r.version !== "blind-four-v1" ||
    !Number.isInteger(r.seed) ||
    r.seed < 0 ||
    r.seed > 4294967295 ||
    !Number.isSafeInteger(r.generatedAt) ||
    r.generatedAt < min ||
    !Number.isSafeInteger(r.completedAt) ||
    r.completedAt! < r.generatedAt ||
    r.completedAt! > max
  )
    return false;
  const s = sampleBlind(d, posts, r.seed);
  if (
    canonicalJson(s.items) !== canonicalJson(r.items) ||
    canonicalJson(s.order) !== canonicalJson(r.order) ||
    !Array.isArray(r.answers) ||
    r.answers.length !== 4
  )
    return false;
  let t = r.generatedAt;
  for (let i = 0; i < 4; i++) {
    const a = r.answers[i];
    if (
      !a ||
      a.postId !== r.order[i] ||
      !Number.isInteger(a.endorsementScore) ||
      a.endorsementScore! < 1 ||
      a.endorsementScore! > 5 ||
      !Number.isInteger(a.argumentQualityScore) ||
      a.argumentQualityScore! < 1 ||
      a.argumentQualityScore! > 5 ||
      !Number.isSafeInteger(a.presentedAt) ||
      a.presentedAt! < t ||
      !Number.isSafeInteger(a.answeredAt) ||
      a.answeredAt! < a.presentedAt! ||
      a.answeredAt! > r.completedAt! ||
      !Number.isSafeInteger(a.visibleMs) ||
      a.visibleMs < 0 ||
      a.visibleMs > a.answeredAt! - a.presentedAt!
    )
      return false;
    t = a.answeredAt!;
  }
  return true;
}
