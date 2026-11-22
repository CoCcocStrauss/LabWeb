import pools from "../data/reason-pools.json";
import type { TopicKey } from "../../../data/topics";
import { shuffleArray } from "../../../lib/blockRandomize";
export const REASON_POOL_VERSION = "2026-11-23-reasons-v1";
export type ReasonCandidate = { id: string; text: string; direction: string };
const SUPPLEMENTS: ReasonCandidate[] = [
  { id: "other", text: "其他理由（可填写）。", direction: "supplement" },
  {
    id: "feeling",
    text: "没有明确理由，主要凭整体感觉。",
    direction: "supplement",
  },
];
export type ComparisonState = "pending" | "selected" | "unable";
export type Timing = { startedAt: number; completedAt: number | null };
export type ReasonResponse = {
  reasonPoolVersion: typeof REASON_POOL_VERSION;
  stage: "pretest" | "posttest";
  candidateIds: string[];
  candidates: ReasonCandidate[];
  order: string[];
  selectedIds: string[];
  otherText: string;
  bestId: string | null;
  worstId: string | null;
  bestStatus: ComparisonState;
  worstStatus: ComparisonState;
  page: "select" | "best" | "worst" | "done";
  pages: { select: Timing; best: Timing | null; worst: Timing | null };
  startedAt: number;
  completedAt: number | null;
};
export function reasonCandidates(topic: TopicKey): ReasonCandidate[] {
  return pools[topic].map((x) => ({ ...x }));
}
export function newReasonResponse(
  topic: TopicKey,
  stage: ReasonResponse["stage"],
  now = Date.now(),
  previous?: ReasonResponse,
): ReasonResponse {
  const substantive = reasonCandidates(topic),
    candidates = [...substantive, ...SUPPLEMENTS.map((x) => ({ ...x }))];
  return {
    reasonPoolVersion: REASON_POOL_VERSION,
    stage,
    candidates,
    candidateIds: candidates.map((x) => x.id),
    order: previous
      ? [...previous.order]
      : [...shuffleArray(substantive.map((x) => x.id)), "other", "feeling"],
    selectedIds: [],
    otherText: "",
    bestId: null,
    worstId: null,
    bestStatus: "pending",
    worstStatus: "pending",
    page: "select",
    pages: {
      select: { startedAt: now, completedAt: null },
      best: null,
      worst: null,
    },
    startedAt: now,
    completedAt: null,
  };
}
export function toggleReason(
  response: ReasonResponse,
  id: string,
): ReasonResponse {
  const chosen = response.selectedIds.includes(id);
  const selectedIds = chosen
    ? response.selectedIds.filter((x) => x !== id)
    : id === "feeling"
      ? ["feeling"]
      : [...response.selectedIds.filter((x) => x !== "feeling"), id];
  return { ...response, selectedIds };
}
export function reasonCanContinue(r: ReasonResponse): boolean {
  if (r.page === "select") return r.selectedIds.length > 0;
  const which = r.page === "best" ? "best" : "worst",
    status = r[`${which}Status`],
    id = r[`${which}Id`];
  return (
    status === "unable" ||
    (status === "selected" &&
      !!id &&
      id !== r[which === "best" ? "worstId" : "bestId"])
  );
}
export function advanceReasons(
  r: ReasonResponse,
  now = Date.now(),
): ReasonResponse {
  if (!reasonCanContinue(r)) return r;
  if (r.page === "select")
    return {
      ...r,
      page: "best",
      pages: {
        ...r.pages,
        select: { ...r.pages.select, completedAt: now },
        best: { startedAt: now, completedAt: null },
      },
    };
  if (r.page === "best")
    return {
      ...r,
      page: "worst",
      pages: {
        ...r.pages,
        best: { ...r.pages.best!, completedAt: now },
        worst: { startedAt: now, completedAt: null },
      },
    };
  return {
    ...r,
    page: "done",
    completedAt: now,
    pages: { ...r.pages, worst: { ...r.pages.worst!, completedAt: now } },
  };
}
const time = (v: unknown): v is number =>
  Number.isSafeInteger(v) && Number(v) > 0;
export function validReasonResponse(
  value: unknown,
  topic: TopicKey,
  stage: ReasonResponse["stage"],
  complete = true,
  earliest = 1,
  latest = Infinity,
  previous?: ReasonResponse,
): value is ReasonResponse {
  if (!value || typeof value !== "object") return false;
  const r = value as ReasonResponse,
    substantive = reasonCandidates(topic),
    candidates = [...substantive, ...SUPPLEMENTS],
    ids = substantive.map((x) => x.id),
    all = candidates.map((x) => x.id);
  if (
    r.reasonPoolVersion !== REASON_POOL_VERSION ||
    r.stage !== stage ||
    !Array.isArray(r.candidates) ||
    r.candidates.length !== 38 ||
    !r.candidates.every(
      (x, i) =>
        x &&
        x.id === candidates[i].id &&
        x.text === candidates[i].text &&
        x.direction === candidates[i].direction,
    ) ||
    JSON.stringify(r.candidateIds) !== JSON.stringify(all) ||
    !Array.isArray(r.order) ||
    r.order.length !== 38 ||
    new Set(r.order).size !== 38 ||
    !r.order.every((x) => all.includes(x)) ||
    r.order[36] !== "other" ||
    r.order[37] !== "feeling" ||
    (previous && JSON.stringify(previous.order) !== JSON.stringify(r.order)) ||
    !Array.isArray(r.selectedIds) ||
    new Set(r.selectedIds).size !== r.selectedIds.length ||
    !r.selectedIds.every((x) => all.includes(x)) ||
    (r.selectedIds.includes("feeling") && r.selectedIds.length !== 1) ||
    typeof r.otherText !== "string" ||
    r.otherText.length > 500 ||
    !time(r.startedAt) ||
    r.startedAt < earliest ||
    r.startedAt > latest ||
    !r.pages ||
    !["select", "best", "worst", "done"].includes(r.page)
  )
    return false;
  for (const which of ["best", "worst"] as const) {
    const status = r[`${which}Status`],
      id = r[`${which}Id`];
    if (
      !["pending", "selected", "unable"].includes(status) ||
      (status === "selected" ? !ids.includes(id!) : id !== null)
    )
      return false;
  }
  if (r.bestId !== null && r.bestId === r.worstId) return false;
  const expected = ["select", "best", "worst", "done"].indexOf(r.page);
  let cursor = r.startedAt;
  for (const [index, key] of (["select", "best", "worst"] as const).entries()) {
    const p = r.pages[key];
    if (index > expected) {
      if (p !== null) return false;
      continue;
    }
    if (
      !p ||
      !time(p.startedAt) ||
      p.startedAt < cursor ||
      p.startedAt > latest
    )
      return false;
    if (index < expected) {
      if (
        !time(p.completedAt) ||
        p.completedAt < p.startedAt ||
        p.completedAt > latest
      )
        return false;
      cursor = p.completedAt;
    } else if (p.completedAt !== null) return false;
  }
  if (
    r.pages.select.startedAt !== r.startedAt ||
    (expected > 0 && !r.selectedIds.length) ||
    (expected > 1 && r.bestStatus === "pending") ||
    (expected > 2 && r.worstStatus === "pending")
  )
    return false;
  return complete
    ? r.page === "done" &&
        time(r.completedAt) &&
        r.completedAt === r.pages.worst?.completedAt &&
        r.completedAt <= latest
    : r.page === "done"
      ? time(r.completedAt) && r.completedAt === r.pages.worst?.completedAt
      : r.completedAt === null;
}
