import { activeShares } from "./blinded";
import {
  LABEL_SELECTION_VERSION,
  validDisplayedLabel,
} from "../../../lib/labelSelection";
import { TUTORIAL_POSTS } from "../data/tutorial";
import {
  RULES,
  PREVIEW_VERSION,
  READING_UI_VERSION,
  PANEL_READING_UI_VERSION,
  SINGLE_INLINE_READING_UI_VERSION,
  COVERAGE_RULE,
  DETAIL_VISIBILITY_VERSION,
  TUTORIAL_VERSION,
  TUTORIAL_STEPS,
  ATTENTION_VERSION,
  SINGLE_OPEN_COMPARISON_VERSION,
  previewText,
  type ReadingMetrics,
  type RulesResponse,
} from "./readingProtocol";
import type { SubmitExperimentDataInput } from "../../../lib/dataSubmit";
import type { PostItem } from "../../../lib/blockRandomize";
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
    r = b.rules as RulesResponse,
    m = b.readingMetrics as ReadingMetrics;
  if (m?.interactionVersion !== undefined && m.interactionVersion !== SINGLE_OPEN_COMPARISON_VERSION) return false;
  if (
    !obj(r) ||
    !ts(r.startedAt) ||
    !ts(r.completedAt) ||
    r.startedAt < b.pretest.completedAt! ||
    r.completedAt < r.startedAt ||
    r.completedAt > b.comprehension[0].timestamp ||
    !Array.isArray(r.items) ||
    (r.presentationVersion !== undefined &&
      r.presentationVersion !== TUTORIAL_VERSION) ||
    r.items.length !==
      (r.presentationVersion === TUTORIAL_VERSION ? TUTORIAL_STEPS.length : RULES.length) ||
    r.items.some(
      (v, i) =>
        !obj(v) ||
        v.id !== (r.presentationVersion === TUTORIAL_VERSION ? TUTORIAL_STEPS[i].id : RULES[i][0]) ||
        v.checked !== true ||
        !ts(v.changedAt) ||
        v.changedAt < r.startedAt ||
        v.changedAt > r.completedAt!,
    )
  )
    return false;
  if (r.presentationVersion === TUTORIAL_VERSION) {
    if (r.activeStep !== "step_3") return false;
    let previous = r.startedAt;
    for (let i = 0; i < r.items.length; i++) {
      const item = r.items[i];
      if (
        !ts(item.enteredAt) ||
        !ts(item.completedAt) ||
        item.enteredAt < previous ||
        item.completedAt < item.enteredAt ||
        item.completedAt > r.completedAt! ||
        item.changedAt !== item.completedAt ||
        item.demoPostId !== (i < 2 ? String(TUTORIAL_POSTS[0].id) : null)
      ) return false;
      previous = item.completedAt;
    }
  }
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
    (m.attentionVersion !== undefined &&
      (m.attentionVersion !== ATTENTION_VERSION ||
        !Number.isSafeInteger(m.hiddenCount) ||
        m.hiddenCount! < 0 ||
        !Number.isSafeInteger(m.totalHiddenMs) ||
        m.totalHiddenMs! < 0 ||
        m.totalHiddenMs! > b.endTime - b.startTime ||
        m.hiddenAtMs !== null)) ||
    (m.detailVisibilityVersion !== undefined &&
      m.detailVisibilityVersion !== DETAIL_VISIBILITY_VERSION) ||
    ![
      READING_UI_VERSION,
      PANEL_READING_UI_VERSION,
      SINGLE_INLINE_READING_UI_VERSION,
    ].includes(m.version) ||
    ![2, 3, 4].includes(m.columns) ||
    !obj(m.coverageRule) ||
    m.coverageRule.minimumRatio !== COVERAGE_RULE.minimumRatio ||
    m.coverageRule.continuousMs !== COVERAGE_RULE.continuousMs ||
    !Array.isArray(m.cards) ||
    m.cards.length !== b.conditionN ||
    m.openDetailId !== null ||
    (m.version === READING_UI_VERSION &&
      (!Array.isArray(m.openDetailIds) || m.openDetailIds.length !== 0))
  )
    return false;
  if (
    m.labelSelectionVersion !== undefined &&
    m.labelSelectionVersion !== LABEL_SELECTION_VERSION
  )
    return false;
  if (
    r.demoLabelSelectionVersion !== undefined &&
    r.demoLabelSelectionVersion !== LABEL_SELECTION_VERSION
  )
    return false;
  if (
    (r.demoLabelSelectionVersion === LABEL_SELECTION_VERSION ||
      r.demoLabelSelections !== undefined) &&
    (!obj(r.demoLabelSelections) ||
      TUTORIAL_POSTS.some(
        (p) =>
          !obj(r.demoLabelSelections![String(p.id)]) ||
          !validDisplayedLabel(p, r.demoLabelSelections![String(p.id)]),
      ))
  )
    return false;
  if (
    m.packingVersion !== undefined &&
    !["free-rect-top-first-v1", "dual-zone-grid-v1"].includes(m.packingVersion)
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
      (m.version === READING_UI_VERSION &&
        (![1, 2].includes(c.columnSpan!) ||
          c.column + c.columnSpan! > m.columns)) ||
      (m.packingVersion === "dual-zone-grid-v1" && m.columns === 4 &&
        (Math.floor(c.column / 2) !== Math.floor(i / 2) % 2 ||
          c.column % 2 + (c.columnSpan ?? 1) > 2)) ||
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
      c.layouts.at(-1)?.columns !== m.columns ||
      (m.version === READING_UI_VERSION &&
        c.columnSpan !== c.layouts.at(-1)?.columnSpan)
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
        (m.version === READING_UI_VERSION &&
          (![1, 2].includes(p.columnSpan!) ||
            p.column + p.columnSpan! > p.columns)) ||
        (m.packingVersion === "dual-zone-grid-v1" && p.columns === 4 &&
          (Math.floor(p.column / 2) !== Math.floor(i / 2) % 2 ||
            p.column % 2 + (p.columnSpan ?? 1) > 2)) ||
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
    enters = new Map<string, number>(),
    previewRanges = new Map<string, { start: number; end: number }[]>();
  for (const e of b.scrollEvents) {
    if (e.action === "enter_viewport") enters.set(e.postId, e.timestamp);
    else {
      const start = enters.get(e.postId);
      if (start !== undefined)
        previewRanges.set(e.postId, [
          ...(previewRanges.get(e.postId) ?? []),
          { start, end: e.timestamp },
        ]);
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
  const active = new Map<string, number>(),
    ranges = new Map<string, { start: number; end: number }[]>();
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
      if (
        active.has(e.postId) ||
        ((m.version !== READING_UI_VERSION || m.interactionVersion === SINGLE_OPEN_COMPARISON_VERSION) && active.size)
      )
        return false;
      visits.set(e.postId, (visits.get(e.postId) ?? 0) + 1);
      active.set(e.postId, e.timestamp);
    } else if (!active.has(e.postId)) return false;
    if (e.visit !== visits.get(e.postId)) return false;
    if (e.type === "close") {
      ranges.set(e.postId, [
        ...(ranges.get(e.postId) ?? []),
        { start: active.get(e.postId)!, end: e.timestamp },
      ]);
      active.delete(e.postId);
    }
  }
  if (active.size) return false;
  const previousEnds = new Map<string, number>();
  for (const interval of m.detailIntervals) {
    if (
      !obj(interval) ||
      !ids.has(interval.postId) ||
      !within(interval.startedAt) ||
      !within(interval.endedAt) ||
      interval.endedAt < interval.startedAt ||
      interval.startedAt < (previousEnds.get(interval.postId) ?? b.startTime) ||
      ((m.detailVisibilityVersion === DETAIL_VISIBILITY_VERSION ||
        interval.startMs !== undefined ||
        interval.endMs !== undefined ||
        interval.durationMs !== undefined) &&
        (interval.startMs !== interval.startedAt ||
          interval.endMs !== interval.endedAt ||
          interval.durationMs !== interval.endedAt - interval.startedAt ||
          interval.durationMs <= 0)) ||
      (m.detailVisibilityVersion === DETAIL_VISIBILITY_VERSION &&
        previewRanges
          .get(interval.postId)
          ?.some(
            (r) => interval.startedAt < r.end && interval.endedAt > r.start,
          )) ||
      !ranges
        .get(interval.postId)
        ?.some(
          (r) => interval.startedAt >= r.start && interval.endedAt <= r.end,
        )
    )
      return false;
    previousEnds.set(interval.postId, interval.endedAt);
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
      a.flashes > (m.version === PANEL_READING_UI_VERSION ? 2 : 5) ||
      (a.kind === "three_seconds" && a.flashes !== 0) ||
      (a.completedAt !== null &&
        (!within(a.completedAt) || a.completedAt < a.shownAt)) ||
      b.endTime - a.shownAt > (a.kind === "thirty_seconds" ? 30000 : 3000)
    )
      return false;
  }
  const shares = activeShares(b.actions).length;
  return (
    obj(m.taskGoal) &&
    m.alerts.length === 0 &&
    m.taskGoal.requiredShares === 2 &&
    m.taskGoal.actualShares === shares &&
    m.taskGoal.achieved === shares >= 2
  );
}
