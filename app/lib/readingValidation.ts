import {
  RULES,
  PREVIEW_VERSION,
  READING_UI_VERSION,
  COVERAGE_RULE,
  previewText,
} from "./readingProtocol";
import type { SubmitExperimentDataInput } from "./dataSubmit";
import type { PostItem } from "./blockRandomize";
const obj = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const ts = (x: unknown): x is number =>
  typeof x === "number" && Number.isSafeInteger(x) && x > 0;
export function validPermission(x: unknown): boolean {
  if (
    !obj(x) ||
    !["checking", "granted", "denied", "unavailable", "error"].includes(
      x.state as string,
    ) ||
    !ts(x.requestedAt)
  )
    return false;
  return x.state === "checking"
    ? x.completedAt === null
    : ts(x.completedAt) && x.completedAt >= x.requestedAt;
}
export function validReadingProtocol(
  raw: unknown,
  posts: Map<string, PostItem>,
): boolean {
  const b = raw as SubmitExperimentDataInput,
    r = b.rules,
    m = b.readingMetrics;
  if (
    !obj(r) ||
    !ts(r.startedAt) ||
    !ts(r.completedAt) ||
    r.startedAt < b.pretest.completedAt! ||
    r.completedAt < r.startedAt ||
    r.completedAt > b.comprehension[0].timestamp ||
    !Array.isArray(r.items) ||
    r.items.length !== RULES.length ||
    r.items.some(
      (v, i) =>
        !obj(v) ||
        v.id !== RULES[i][0] ||
        v.checked !== true ||
        !ts(v.changedAt) ||
        v.changedAt < r.startedAt ||
        v.changedAt > r.completedAt!,
    )
  )
    return false;
  if (
    !validPermission(b.microphonePermission) ||
    b.microphonePermission.requestedAt! > b.pretest.startedAt ||
    (b.microphonePermission.completedAt !== null &&
      b.microphonePermission.completedAt > b.posttest.completedAt!)
  )
    return false;
  const within = (t: unknown) => ts(t) && t >= b.startTime && t <= b.endTime;
  if (
    !obj(m) ||
    m.version !== READING_UI_VERSION ||
    ![2, 3, 4].includes(m.columns) ||
    !obj(m.coverageRule) ||
    m.coverageRule.minimumRatio !== COVERAGE_RULE.minimumRatio ||
    m.coverageRule.continuousMs !== COVERAGE_RULE.continuousMs ||
    !Array.isArray(m.cards) ||
    m.cards.length !== b.conditionN ||
    m.openDetailId !== null
  )
    return false;
  for (let i = 0; i < m.cards.length; i++) {
    const c = m.cards[i];
    if (
      !obj(c) ||
      c.postId !== b.postOrder[i] ||
      c.order !== i + 1 ||
      !Number.isInteger(c.column) ||
      c.column < 0 ||
      c.column >= m.columns ||
      !obj(c.preview) ||
      c.preview.ruleVersion !== PREVIEW_VERSION
    )
      return false;
    const expected = previewText(posts.get(c.postId)!.content);
    if (
      c.preview.text !== expected.text ||
      c.preview.lengthTruncated !== expected.lengthTruncated ||
      !Array.isArray(c.layouts) ||
      c.layouts.length < 1 ||
      c.layouts.length > 128
    )
      return false;
    if (
      c.column !== c.layouts.at(-1)?.column ||
      c.layouts.at(-1)?.columns !== m.columns
    )
      return false;
    let prev = b.startTime;
    for (const p of c.layouts) {
      if (
        !obj(p) ||
        !within(p.timestamp) ||
        ![2, 3, 4].includes(p.columns) ||
        !Number.isInteger(p.column) ||
        p.column < 0 ||
        p.column >= p.columns ||
        p.timestamp < prev ||
        !(["left", "top"] as const).every(
          (k) =>
            typeof p[k] === "number" &&
            Number.isFinite(p[k]) &&
            (p[k] as number) >= 0,
        ) ||
        !(
          ["width", "height", "viewportWidth", "viewportHeight"] as const
        ).every(
          (k) =>
            typeof p[k] === "number" &&
            Number.isFinite(p[k]) &&
            (p[k] as number) > 0,
        )
      )
        return false;
      prev = p.timestamp;
    }
  }
  const ids = new Set(b.postOrder);
  if (
    !Array.isArray(m.viewedPostIds) ||
    new Set(m.viewedPostIds).size !== m.viewedPostIds.length ||
    !m.viewedPostIds.every((id) => ids.has(id)) ||
    !Array.isArray(m.detailEvents) ||
    m.detailEvents.length > 10000 ||
    !Array.isArray(m.detailIntervals) ||
    m.detailIntervals.length > 10000 ||
    !Array.isArray(m.alerts) ||
    m.alerts.length > 2 ||
    new Set(m.alerts.map((a) => a?.kind)).size !== m.alerts.length
  )
    return false;
  const qualifies = new Set<string>(),
    enters = new Map<string, number>();
  for (const e of b.scrollEvents) {
    if (e.action === "enter_viewport") enters.set(e.postId, e.timestamp);
    else {
      const start = enters.get(e.postId);
      if (
        start !== undefined &&
        e.timestamp - start >= COVERAGE_RULE.continuousMs
      )
        qualifies.add(e.postId);
      enters.delete(e.postId);
    }
  }
  if (
    m.viewedPostIds.length !== qualifies.size ||
    m.viewedPostIds.some((id) => !qualifies.has(id))
  )
    return false;
  let previous = b.startTime;
  const visits = new Map<string, number>();
  let active: string | null = null;
  for (const e of m.detailEvents) {
    if (
      !obj(e) ||
      !ids.has(e.postId) ||
      !within(e.timestamp) ||
      e.timestamp < previous ||
      !["open", "close", "resume"].includes(e.type)
    )
      return false;
    previous = e.timestamp;
    if (e.type === "open") {
      if (active !== null) return false;
      visits.set(e.postId, (visits.get(e.postId) ?? 0) + 1);
      active = e.postId;
    } else if (active !== e.postId) return false;
    if (e.visit !== visits.get(e.postId)) return false;
    if (e.type === "close") active = null;
  }
  if (active !== null) return false;
  previous = b.startTime;
  for (const interval of m.detailIntervals) {
    if (
      !obj(interval) ||
      !ids.has(interval.postId) ||
      !within(interval.startedAt) ||
      !within(interval.endedAt) ||
      interval.endedAt < interval.startedAt ||
      interval.startedAt < previous ||
      !visits.has(interval.postId)
    )
      return false;
    previous = interval.endedAt;
  }
  for (const a of b.actions) {
    if (a.type === "user_post") continue;
    if (
      !obj(a.interaction) ||
      !["preview", "detail"].includes(a.interaction.surface) ||
      typeof a.interaction.detailOpenedBefore !== "boolean"
    )
      return false;
    const opened = m.detailEvents.some(
      (e) =>
        e.postId === a.postId &&
        e.type === "open" &&
        e.timestamp <= a.timestamp,
    );
    if (
      a.interaction.detailOpenedBefore !== opened ||
      (a.interaction.surface === "detail" && !opened)
    )
      return false;
  }
  for (const a of m.alerts) {
    if (
      !obj(a) ||
      !["thirty_seconds", "three_seconds"].includes(a.kind) ||
      !within(a.shownAt) ||
      !["threshold", "restored_below_threshold"].includes(a.reason) ||
      !Number.isInteger(a.flashes) ||
      a.flashes < 0 ||
      a.flashes > 2 ||
      (a.kind === "three_seconds" && a.flashes !== 0) ||
      (a.completedAt !== null &&
        (!within(a.completedAt) || a.completedAt < a.shownAt)) ||
      b.endTime - a.shownAt > (a.kind === "thirty_seconds" ? 30000 : 3000)
    )
      return false;
  }
  const shares = b.actions.filter((a) => a.type === "share").length;
  return (
    obj(m.taskGoal) &&
    m.taskGoal.requiredShares === 2 &&
    m.taskGoal.actualShares === shares &&
    m.taskGoal.achieved === (shares === 2)
  );
}
