import { activeShares, finalLikes } from "./blinded";
import type { ActionLog } from "../../../lib/dataSubmit";
import type { PostItem, Stance } from "../../../lib/blockRandomize";
import { canonicalJson } from "../../../lib/submissionValidation";

export const COMPARISON_VERSION = "blind-best-worst-v1";
type Data = {
  postOrder: string[];
  actions: ActionLog[];
  pretest: { answers: { value: number }[] };
  readingMetrics: { detailEvents: { postId: string; type: string }[] };
};
export type CandidateSource = "shared" | "liked_only" | "same_stance_uninteracted" | "fallback";
export type BestWorstComparison = {
  version: typeof COMPARISON_VERSION;
  seed: number;
  generatedAt: number;
  presentedAt: number | null;
  activeQuestion?: "most" | "least";
  candidateIds: string[];
  candidateSources: Record<string, CandidateSource>;
  referenceStance: Stance;
  referenceStanceRule: "shared_majority" | "pretest_tiebreak" | "random_tiebreak";
  controlRule: "unopened_uninteracted" | "same_stance_final_uninteracted" | "any_final_uninteracted" | "unavailable";
  fallbackReasons: string[];
  mostAlignedPostId: string | null;
  leastAlignedPostId: string | null;
  durationMs: number;
  answeredAt: string | null;
};
function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
}
function shuffle<T>(input: T[], random: () => number) {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Seeded once and persisted; the server reproduces the exact pool and order. */
export function sampleComparison(d: Data, posts: Map<string, PostItem>, seed: number) {
  const random = rng(seed), shares = activeShares(d.actions), likes = finalLikes(d.actions);
  const support = shares.filter((id) => posts.get(id)?.stance === "support").length;
  const oppose = shares.length - support, pre = d.pretest.answers[0].value;
  const referenceStance: Stance = support !== oppose ? (support > oppose ? "support" : "oppose") :
    pre !== 3 ? (pre >= 4 ? "support" : "oppose") : random() < 0.5 ? "support" : "oppose";
  const referenceStanceRule = support !== oppose ? "shared_majority" : pre !== 3 ? "pretest_tiebreak" : "random_tiebreak";
  const selected = shuffle(shares, random).slice(0, 3);
  const sources: Record<string, CandidateSource> = Object.fromEntries(selected.map((id) => [id, "shared"]));
  for (const id of shuffle(likes.filter((id) => !shares.includes(id)), random).slice(0, 5 - selected.length)) {
    selected.push(id); sources[id] = "liked_only";
  }
  const unselected = d.postOrder.filter((id) => !shares.includes(id) && !likes.includes(id));
  const same = unselected.filter((id) => posts.get(id)?.stance === referenceStance);
  const everInteracted = new Set(d.actions.filter((a) => a.type === "like" || a.type === "share").map((a) => a.postId));
  const expanded = new Set(d.readingMetrics.detailEvents.filter((e) => e.type === "open").map((e) => e.postId));
  const fresh = same.filter((id) => !everInteracted.has(id) && !expanded.has(id));
  const controlRule = fresh.length ? "unopened_uninteracted" : same.length ? "same_stance_final_uninteracted" :
    unselected.length ? "any_final_uninteracted" : "unavailable";
  const control = shuffle(fresh.length ? fresh : same.length ? same : unselected, random)[0];
  if (control) { selected.push(control); sources[control] = "same_stance_uninteracted"; }
  const fallbackReasons: string[] = control ? [] : ["no_uninteracted_control"];
  if (selected.length < 3) {
    fallbackReasons.push("insufficient_interaction_candidates");
    for (const id of shuffle(d.postOrder.filter((id) => !selected.includes(id)), random)) {
      if (selected.length >= 3) break;
      selected.push(id); sources[id] = "fallback";
    }
  }
  const candidateIds = shuffle(selected, random);
  return { candidateIds, candidateSources: Object.fromEntries(candidateIds.map((id) => [id, sources[id]])),
    referenceStance, referenceStanceRule, controlRule, fallbackReasons } as Pick<BestWorstComparison,
      "candidateIds" | "candidateSources" | "referenceStance" | "referenceStanceRule" | "controlRule" | "fallbackReasons">;
}
export function newComparison(d: Data, posts: Map<string, PostItem>, now = Date.now(), seed = crypto.getRandomValues(new Uint32Array(1))[0]): BestWorstComparison {
  return { version: COMPARISON_VERSION, seed, generatedAt: now, presentedAt: null, activeQuestion: "most", ...sampleComparison(d, posts, seed),
    mostAlignedPostId: null, leastAlignedPostId: null, durationMs: 0, answeredAt: null };
}
export function chooseComparison(c: BestWorstComparison, field: "mostAlignedPostId" | "leastAlignedPostId", id: string): BestWorstComparison {
  if (!c.candidateIds.includes(id)) return c;
  const other = field === "mostAlignedPostId" ? "leastAlignedPostId" : "mostAlignedPostId";
  return { ...c, [field]: id, ...(c[other] === id ? { [other]: null } : {}) };
}
export function finishComparison(c: BestWorstComparison, now = Date.now()): BestWorstComparison {
  if (!c.mostAlignedPostId || !c.leastAlignedPostId || c.mostAlignedPostId === c.leastAlignedPostId || c.presentedAt === null)
    throw new Error("请分别选择两条不同的内容");
  return { ...c, durationMs: now - c.presentedAt, answeredAt: new Date(now).toISOString() };
}
export function validComparison(raw: unknown, d: Data, posts: Map<string, PostItem>, min: number, max: number, draft = false): raw is BestWorstComparison {
  if (!raw || typeof raw !== "object") return false;
  const c = raw as BestWorstComparison;
  if (c.version !== COMPARISON_VERSION || !Number.isInteger(c.seed) || c.seed < 0 || c.seed > 4294967295 ||
    !Number.isSafeInteger(c.generatedAt) || c.generatedAt < min || c.generatedAt > max ||
    !Array.isArray(c.candidateIds) || c.candidateIds.length < 3 || c.candidateIds.length > 6 ||
    new Set(c.candidateIds).size !== c.candidateIds.length) return false;
  if (c.activeQuestion !== undefined && (!["most", "least"].includes(c.activeQuestion) || (c.activeQuestion === "least" && !c.mostAlignedPostId))) return false;
  const expected = sampleComparison(d, posts, c.seed);
  for (const key of Object.keys(expected) as (keyof typeof expected)[])
    if (canonicalJson(c[key]) !== canonicalJson(expected[key])) return false;
  if (![c.mostAlignedPostId, c.leastAlignedPostId].every((id) => id === null || c.candidateIds.includes(id)) ||
    (c.mostAlignedPostId !== null && c.mostAlignedPostId === c.leastAlignedPostId) ||
    !Number.isSafeInteger(c.durationMs) || c.durationMs < 0 ||
    (c.presentedAt !== null && (!Number.isSafeInteger(c.presentedAt) || c.presentedAt < c.generatedAt || c.presentedAt > max))) return false;
  if (draft && c.answeredAt === null) return c.durationMs === 0;
  if (typeof c.answeredAt !== "string" || c.presentedAt === null || !c.mostAlignedPostId || !c.leastAlignedPostId) return false;
  const answered = Date.parse(c.answeredAt);
  return Number.isSafeInteger(answered) && new Date(answered).toISOString() === c.answeredAt && answered >= c.presentedAt &&
    answered <= max && c.durationMs === answered - c.presentedAt;
}
