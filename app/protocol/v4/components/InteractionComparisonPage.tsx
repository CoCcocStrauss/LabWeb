"use client";
import { useEffect, useRef } from "react";
import { PostAuthor } from "../../../components/CompactPostCard";
import { previewText } from "../../../lib/readingProtocol";
import { QUESTIONNAIRES } from "../data/questionnaire";
import type { TopicKey } from "../../../data/topics";
import {
  interactionCanContinue,
  type InteractionComparison,
} from "../lib/interactionComparison";
export function InteractionComparisonPage({
  topic,
  response,
  onChange,
  onContinue,
}: {
  topic: TopicKey;
  response: InteractionComparison;
  onChange: (r: InteractionComparison) => void;
  onContinue: (r: InteractionComparison) => void;
}) {
  const latest = useRef(response);
  latest.current = response;
  const change = useRef(onChange);
  change.current = onChange;
  const root = useRef<HTMLElement>(null),
    active = useRef(new Map<string, number>()),
    visible = useRef(new Set<string>());
  const flush = (now: number) => {
    const r = latest.current,
      intervals = [...r.reviewIntervals];
    for (const [postId, startedAt] of active.current) {
      if (now > startedAt) intervals.push({ postId, startedAt, endedAt: now });
    }
    active.current.clear();
    const next = { ...r, reviewIntervals: intervals };
    latest.current = next;
    return next;
  };
  useEffect(() => {
    const starts = active.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const now = Date.now(),
          r = flush(now);
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.comparePost!;
          if (
            e.isIntersecting &&
            e.intersectionRect.height > 0 &&
            e.intersectionRect.width > 0
          )
            visible.current.add(id);
          else visible.current.delete(id);
        }
        if (!document.hidden)
          visible.current.forEach((id) => active.current.set(id, now));
        change.current(r);
      },
      { root: root.current, threshold: [0, 0.001] },
    );
    root.current
      ?.querySelectorAll("[data-compare-post]")
      .forEach((el) => observer.observe(el));
    const checkpoint = () => {
      const now = Date.now(),
        r = flush(now);
      if (!document.hidden)
        visible.current.forEach((id) => active.current.set(id, now));
      change.current(r);
    };
    const timer = setInterval(checkpoint, 1000);
    document.addEventListener("visibilitychange", checkpoint);
    window.addEventListener("pagehide", checkpoint);
    return () => {
      clearInterval(timer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", checkpoint);
      window.removeEventListener("pagehide", checkpoint);
      starts.clear();
    };
  }, []);
  const save = (r: InteractionComparison) => {
    if (!document.hidden)
      visible.current.forEach((id) => {
        if (!active.current.has(id)) active.current.set(id, Date.now());
      });
    latest.current = r;
    change.current(r);
  };
  const r = response;
  return (
    <div className="study-shell study-screen interaction-comparison-screen">
      <header className="study-header study-pad border-b bg-white">
        <h1 className="study-title">回看刚才选择的内容</h1>
        <p className="study-copy mt-3">{QUESTIONNAIRES[topic].statement}</p>
      </header>
      <main ref={root} className="study-scroll study-pad py-5">
        <p className="study-copy font-medium">
          以下是你刚才点赞或转发过的内容。请从中分别选择：哪条最能支持你对该议题的判断？哪条对你判断的支持作用相对最弱？
        </p>
        <p className="study-meta mt-3 text-neutral-600">
          “最弱”只表示这些已选内容中支持作用相对较弱，不代表你反对这条内容。
        </p>
        {r.status === "single_candidate" ? (
          <p className="study-copy mt-4">
            你选择过的内容只有一条，无需比较强弱。
          </p>
        ) : null}
        <div className="review-posts mt-5">
          {r.order.map((id) => {
            const post = r.candidates.find((x) => x.postId === id)!,
              expanded = r.expandedIds.includes(id);
            return (
              <article
                key={id}
                data-compare-post={id}
                className="review-post rounded-xl border bg-white p-4"
              >
                <PostAuthor post={post} compact />
                <div className="study-meta mt-3 text-neutral-600">
                  {[post.liked ? "已点赞" : null, post.shared ? "已转发" : null]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <p className="study-copy mt-3 whitespace-pre-wrap">
                  {expanded ? post.content : previewText(post.content).text}
                </p>
                <button
                  type="button"
                  className="study-control mt-2 text-blue-600"
                  aria-expanded={expanded}
                  onClick={() => {
                    const next = flush(Date.now());
                    save({
                      ...next,
                      expandedIds: expanded
                        ? next.expandedIds.filter((x) => x !== id)
                        : [...next.expandedIds, id],
                      reviewEvents: [
                        ...next.reviewEvents,
                        {
                          postId: id,
                          type: expanded ? "collapse" : "expand",
                          timestamp: Date.now(),
                        },
                      ],
                    });
                  }}
                >
                  {expanded ? "收起" : "展开全文"}
                </button>
                {r.candidates.length > 1 ? (
                  <div className="review-ranking mt-3">
                    {(["strongest", "weakest"] as const).map((which) => {
                      const field =
                          which === "strongest"
                            ? "strongestPostId"
                            : "weakestPostId",
                        other =
                          which === "strongest"
                            ? "weakestPostId"
                            : "strongestPostId";
                      return (
                        <label
                          key={which}
                          className={`study-control reason-choice ${r[field] === id ? "is-chosen" : ""}`}
                        >
                          <input
                            type="radio"
                            name={which}
                            checked={r[field] === id}
                            disabled={r[other] === id}
                            onChange={() =>
                              save({
                                ...latest.current,
                                status: "ranked",
                                [field]: id,
                              })
                            }
                          />
                          <span>
                            {which === "strongest" ? "支持最强" : "支持最弱"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
        {r.candidates.length > 1 ? (
          <fieldset className="mt-5">
            <legend className="sr-only">无法排序时的回答</legend>
            {(
              [
                ["similar_support", "支持程度相近，无法区分"],
                ["no_support", "这些内容都不能支持我当前的判断"],
              ] as const
            ).map(([status, text]) => (
              <label key={status} className="study-control reason-choice mt-3">
                <input
                  type="radio"
                  name="comparison-state"
                  checked={r.status === status}
                  onChange={() =>
                    save({
                      ...latest.current,
                      status,
                      strongestPostId: null,
                      weakestPostId: null,
                    })
                  }
                />
                <span>{text}</span>
              </label>
            ))}
          </fieldset>
        ) : null}
      </main>
      <footer className="study-footer study-pad border-t bg-white">
        <button
          className="study-control w-full rounded-full bg-[#0084ff] px-4 py-3 text-white disabled:bg-neutral-200 disabled:text-neutral-400"
          disabled={!interactionCanContinue(r)}
          onClick={() => {
            const now = Date.now(),
              next = flush(now);
            onContinue({ ...next, completedAt: now });
          }}
        >
          下一步
        </button>
      </footer>
    </div>
  );
}
