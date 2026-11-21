"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import type { TopicKey } from "../data/topics";
import type { ActionLog, EndReason } from "../lib/dataSubmit";
import {
  ReadingTracker,
  COVERAGE_RULE,
  type ReadingAlert,
} from "../lib/readingProtocol";
import {
  readingEndData,
  remainingReadingMs,
  type ReadingSnapshot,
  type ReadingEndData,
} from "../lib/experimentSession";
import { getMaterialsForTopic } from "../lib/materialsRegistry";
import { MasonryFeed } from "./MasonryFeed";
import { CompactPostCard } from "./CompactPostCard";
import { PostDetail } from "./PostDetail";
import { ReadingStatus } from "./ReadingStatus";
import { ShareModal } from "./ShareModal";
export type ExperimentPageProps = {
  uid: string;
  conditionN: 8 | 16 | 48;
  topic: TopicKey;
  initialReading: ReadingSnapshot;
  onSnapshot: (r: ReadingSnapshot) => void;
  onEnd: (r: ReadingEndData) => boolean;
};
export function ExperimentPage({
  uid,
  conditionN,
  topic,
  initialReading,
  onSnapshot,
  onEnd,
}: ExperimentPageProps) {
  const initial = useRef(initialReading).current,
    posts = initial.posts;
  const materials = useMemo(() => getMaterialsForTopic(topic), [topic]);
  const tracker = useMemo(
    () => new ReadingTracker(posts, initial),
    [posts, initial],
  );
  const [actions, setActions] = useState(initial.actions),
    actionsRef = useRef(initial.actions);
  const [remaining, setRemaining] = useState(() => remainingReadingMs(initial)),
    [viewed, setViewed] = useState(tracker.metrics.viewedPostIds.length);
  const [opened, setOpened] = useState<string | null>(
      tracker.metrics.openDetailId,
    ),
    openedRef = useRef(tracker.metrics.openDetailId);
  const [sharePending, setSharePending] = useState<{
    id: string;
    surface: "preview" | "detail";
  } | null>(null);
  const [borderAlert, setBorderAlert] = useState(false);
  const ended = useRef(false),
    scroller = useRef<HTMLElement | null>(null),
    elements = useRef(new Map<string, HTMLElement>()),
    observer = useRef<IntersectionObserver | null>(null),
    refs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const maxScroll = useRef(initial.maxScrollY),
    lastSave = useRef(0),
    stableAt = useRef(Date.now() + 150);
  const now = useCallback(
    () => Math.min(Date.now(), initial.deadline),
    [initial.deadline],
  );
  const scrollY = useCallback(
    () =>
      Math.max(0, Math.round(scroller.current?.scrollTop ?? initial.scrollY)),
    [initial.scrollY],
  );
  const capture = useCallback(() => {
    const time = now(),
      y = scrollY();
    maxScroll.current = Math.max(maxScroll.current, y);
    const snapshot = tracker.snapshot(time, y, actionsRef.current);
    return {
      ...initial,
      savedAt: time,
      actions: actionsRef.current,
      scrollY: y,
      maxScrollY: maxScroll.current,
      metrics: snapshot.metrics,
      scrollEvents: snapshot.events,
      postVisibilitySummary: snapshot.visibility,
    };
  }, [initial, now, scrollY, tracker]);
  const checkpoint = useCallback(() => {
    if (!ended.current) onSnapshot(capture());
  }, [capture, onSnapshot]);
  const observe = useCallback(() => {
    observer.current?.disconnect();
    if (
      !scroller.current ||
      openedRef.current ||
      document.visibilityState === "hidden" ||
      Date.now() >= initial.deadline
    )
      return;
    observer.current = new IntersectionObserver(
      (entries) => {
        if (
          openedRef.current ||
          document.visibilityState === "hidden" ||
          Date.now() < stableAt.current
        )
          return;
        const time = now(),
          y = scrollY();
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.postId!;
          tracker.setVisible(
            id,
            e.isIntersecting &&
              e.intersectionRatio >= COVERAGE_RULE.minimumRatio,
            time,
            y,
          );
        }
      },
      { root: scroller.current, threshold: [0, COVERAGE_RULE.minimumRatio] },
    );
    elements.current.forEach((el) => observer.current?.observe(el));
  }, [initial.deadline, now, scrollY, tracker]);
  const register = useCallback((id: string) => {
    if (!refs.current.has(id))
      refs.current.set(id, (el) => {
        const old = elements.current.get(id);
        if (old) observer.current?.unobserve(old);
        if (el) {
          elements.current.set(id, el);
          observer.current?.observe(el);
        } else elements.current.delete(id);
      });
    return refs.current.get(id)!;
  }, []);
  const layoutReady = useRef(false);
  const measure = useCallback(() => {
    const root = scroller.current;
    if (!root || !layoutReady.current) return;
    const rect = root.getBoundingClientRect();
    for (const card of tracker.metrics.cards) {
      const el = elements.current.get(card.postId);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const layout = {
        timestamp: now(),
        column: card.column,
        columns: tracker.metrics.columns,
        left: Math.round(r.left - rect.left),
        top: Math.round(r.top - rect.top + root.scrollTop),
        width: Math.round(r.width),
        height: Math.round(r.height),
        viewportWidth: root.clientWidth,
        viewportHeight: root.clientHeight,
      };
      const last = card.layouts.at(-1);
      if (
        !last ||
        Object.entries(layout).some(
          ([k, v]) => k !== "timestamp" && last[k as keyof typeof last] !== v,
        )
      ) {
        // Keep initial and settled geometry without filling storage during window drags.
        if (
          card.layouts.length > 1 &&
          last &&
          layout.timestamp - last.timestamp < 500
        ) {
          card.layouts[card.layouts.length - 1] = layout;
        } else {
          card.layouts.push(layout);
          if (card.layouts.length > 128)
            card.layouts.splice(1, card.layouts.length - 128);
        }
      }
    }
  }, [now, tracker]);
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = initial.scrollY;
    measure();
    const timer = setTimeout(observe, 170);
    const changed = () => {
      measure();
      observe();
    };
    const resize =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(changed);
    elements.current.forEach((el) => resize?.observe(el));
    if (scroller.current) resize?.observe(scroller.current);
    window.addEventListener("resize", changed);
    return () => {
      clearTimeout(timer);
      resize?.disconnect();
      window.removeEventListener("resize", changed);
      observer.current?.disconnect();
    };
  }, [initial.scrollY, measure, observe]);
  useEffect(() => {
    if (scroller.current) {
      if (opened) scroller.current.setAttribute("inert", "");
      else scroller.current.removeAttribute("inert");
    }
  }, [opened]);
  const finalize = useCallback(
    (reason: EndReason) => {
      if (ended.current) return;
      // Even an already-expired restored session must settle its layout before
      // saving; the deadline remains unchanged and all actions stay disabled.
      if (!layoutReady.current) return;
      tracker.close(now());
      tracker.suspend(now(), scrollY());
      observer.current?.disconnect();
      const reading = capture();
      onSnapshot(reading);
      if (
        onEnd(
          readingEndData(
            { uid, conditionN, topicKey: topic },
            reading,
            reason === "timeout" ? initial.deadline : now(),
            reason,
            materials.topic,
          ),
        )
      )
        ended.current = true;
    },
    [
      capture,
      conditionN,
      initial.deadline,
      materials.topic,
      now,
      onEnd,
      onSnapshot,
      scrollY,
      topic,
      tracker,
      uid,
    ],
  );
  useEffect(() => {
    if (openedRef.current && document.visibilityState === "visible")
      tracker.resumeDetail(now());
    const alert = (kind: ReadingAlert["kind"], remainingMs: number) => {
      if (
        tracker.metrics.alerts.some((a) => a.kind === kind) ||
        document.visibilityState === "hidden"
      )
        return;
      tracker.metrics.alerts.push({
        kind,
        shownAt: now(),
        reason:
          initial.savedAt > initial.startTime && remainingMs < 30000
            ? "restored_below_threshold"
            : "threshold",
        flashes: 0,
        completedAt: null,
      });
      if (kind === "thirty_seconds") setBorderAlert(true);
    };
    const tick = () => {
      if (ended.current) return;
      const left = remainingReadingMs(initial);
      setRemaining(left);
      if (left <= 0) {
        finalize("timeout");
        return;
      }
      const snap = tracker.snapshot(now(), scrollY(), actionsRef.current);
      setViewed(snap.metrics.viewedPostIds.length);
      if (left <= 30000) alert("thirty_seconds", left);
      if (left <= 3000) alert("three_seconds", left);
      if (Date.now() - lastSave.current >= 1000) {
        lastSave.current = Date.now();
        checkpoint();
      }
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") {
        tracker.suspend(now(), scrollY());
        observer.current?.disconnect();
        checkpoint();
      } else {
        if (openedRef.current) tracker.resumeDetail(now());
        else observe();
        tick();
      }
    };
    const pagehide = () => {
      tracker.suspend(now(), scrollY());
      checkpoint();
    };
    const onScroll = () => {
      maxScroll.current = Math.max(maxScroll.current, scrollY());
    };
    tick();
    const timer = setInterval(tick, 200);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pagehide);
    scroller.current?.addEventListener("scroll", onScroll, { passive: true });
    const el = scroller.current;
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pagehide);
      el?.removeEventListener("scroll", onScroll);
      tracker.suspend(now(), scrollY());
    };
  }, [checkpoint, finalize, initial, now, observe, scrollY, tracker]);
  const canAct = () => {
    if (ended.current) return false;
    if (Date.now() >= initial.deadline) {
      finalize("timeout");
      return false;
    }
    return true;
  };
  const append = (action: ActionLog) => {
    actionsRef.current = [...actionsRef.current, action];
    setActions(actionsRef.current);
    checkpoint();
  };
  const attrs = (id: string) => {
    const p = posts.find((p) => p.id === id)!;
    return { stance: p.stance, sourceLevel: p.sourceLevel, quality: p.quality };
  };
  const like =
    (id: string, surface: "preview" | "detail") =>
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (!canAct()) return;
      const last = actionsRef.current
        .filter(
          (a) => (a.type === "like" || a.type === "unlike") && a.postId === id,
        )
        .at(-1);
      append({
        type: last?.type === "like" ? "unlike" : "like",
        postId: id,
        timestamp: now(),
        ...attrs(id),
        interaction: tracker.context(id, surface),
      });
    };
  const share =
    (id: string, surface: "preview" | "detail") =>
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (
        canAct() &&
        actionsRef.current.filter((a) => a.type === "share").length < 2 &&
        !actionsRef.current.some((a) => a.type === "share" && a.postId === id)
      )
        setSharePending({ id, surface });
    };
  const open = (id: string) => {
    if (!canAct()) return;
    tracker.open(id, now(), scrollY());
    observer.current?.disconnect();
    openedRef.current = id;
    setOpened(id);
    checkpoint();
  };
  const close = useCallback(() => {
    tracker.close(now());
    openedRef.current = null;
    setOpened(null);
    checkpoint();
    requestAnimationFrame(observe);
  }, [checkpoint, now, observe, tracker]);
  const liked = (id: string) =>
    actions
      .filter(
        (a) => (a.type === "like" || a.type === "unlike") && a.postId === id,
      )
      .at(-1)?.type === "like";
  const shared = (id: string) =>
      actions.some((a) => a.type === "share" && a.postId === id),
    shares = actions.filter((a) => a.type === "share").length;
  const own = initial.ownPost;
  const ownCard = own ? (
    <article className="feed-card own-card">
      <p className="feed-name">{own.displayName} · 我的发布</p>
      <p className="feed-preview">{own.content}</p>
      <span className="study-meta text-green-700">已发布</span>
    </article>
  ) : null;
  return (
    <div className="study-shell study-screen experiment-shell">
      <ReadingStatus
        remainingMs={remaining}
        total={conditionN}
        viewed={viewed}
        shares={shares}
        title={materials.topic}
      />
      <div className="reading-stage">
        <main
          ref={scroller}
          className="study-scroll reading-feed"
          aria-label="实验内容"
          aria-hidden={!!opened}
        >
          <p className="reading-scenario study-meta">
            {materials.topicDescription}
          </p>
          <MasonryFeed
            onLayout={(columns, assignments) => {
              tracker.metrics.columns = columns;
              for (const c of tracker.metrics.cards)
                c.column = assignments[c.postId];
              // Restore only after cards have moved into their measured columns.
              // Restoring against the temporary round-robin layout shifts the viewport.
              if (!layoutReady.current && scroller.current)
                scroller.current.scrollTop = initial.scrollY;
              layoutReady.current = true;
              measure();
            }}
            items={posts
              .flatMap((post, index) => {
                const item = {
                  id: post.id,
                  node: (
                    <CompactPostCard
                      post={post}
                      preview={tracker.metrics.cards[index].preview}
                      liked={liked(post.id)}
                      shared={shared(post.id)}
                      shareDisabled={shares >= 2 || shared(post.id)}
                      disabled={remaining <= 0}
                      rootRef={register(post.id)}
                      onOpen={() => open(post.id)}
                      onLike={like(post.id, "preview")}
                      onShare={share(post.id, "preview")}
                    />
                  ),
                };
                return initial.insertBeforePostId === post.id && ownCard
                  ? [{ id: "own-post", node: ownCard }, item]
                  : [item];
              })
              .concat(
                initial.insertBeforePostId === null && ownCard
                  ? [{ id: "own-post", node: ownCard }]
                  : [],
              )}
          />
        </main>
        {opened ? (
          <PostDetail
            post={posts.find((p) => p.id === opened)!}
            liked={liked(opened)}
            shared={shared(opened)}
            disabled={remaining <= 0}
            shareDisabled={shares >= 2 || shared(opened)}
            onClose={close}
            onLike={like(opened, "detail")}
            onShare={share(opened, "detail")}
          />
        ) : null}
      </div>
      {shares === 2 ? (
        <footer className="reading-bottom">
          <button
            type="button"
            disabled={remaining <= 0}
            onClick={() => {
              if (canAct() && shares === 2) finalize("manual");
            }}
          >
            结束作答
          </button>
        </footer>
      ) : null}
      {borderAlert ? (
        <div
          className="reading-time-alert"
          aria-hidden
          onAnimationIteration={() => {
            const a = tracker.metrics.alerts.find(
              (a) => a.kind === "thirty_seconds",
            )!;
            a.flashes = 1;
            checkpoint();
          }}
          onAnimationEnd={() => {
            const a = tracker.metrics.alerts.find(
              (a) => a.kind === "thirty_seconds",
            )!;
            a.flashes = 2;
            a.completedAt = now();
            setBorderAlert(false);
            checkpoint();
          }}
        />
      ) : null}
      <ShareModal
        open={!!sharePending}
        onCancel={() => setSharePending(null)}
        onConfirm={() => {
          if (sharePending && canAct()) {
            const { id, surface } = sharePending;
            const count = actionsRef.current.filter(
              (a) => a.type === "share",
            ).length;
            if (
              count < 2 &&
              !actionsRef.current.some(
                (a) => a.type === "share" && a.postId === id,
              )
            )
              append({
                type: "share",
                postId: id,
                timestamp: now(),
                order: count + 1,
                ...attrs(id),
                interaction: tracker.context(id, surface),
              });
          }
          setSharePending(null);
        }}
      />
    </div>
  );
}
