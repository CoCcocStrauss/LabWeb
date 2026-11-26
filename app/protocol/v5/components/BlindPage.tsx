"use client";
import { useEffect, useRef } from "react";
import type { BlindResponse } from "../lib/blinded";
export function BlindPage({
  response: r,
  onChange,
  onContinue,
}: {
  response: BlindResponse;
  onChange: (r: BlindResponse) => void;
  onContinue: (r: BlindResponse) => void;
}) {
  const index = r.answers.findIndex((a) => a.answeredAt === null),
    a = r.answers[index],
    latest = useRef(r),
    change = useRef(onChange);
  const secondQuestion = useRef<HTMLFieldSetElement>(null);
  latest.current = r;
  change.current = onChange;
  useEffect(() => {
    let last = performance.now(),
      wasVisible = !document.hidden;
    const tick = () => {
      if (latest.current.answers[index]?.answeredAt !== null) return;
      const now = performance.now(),
        s = latest.current,
        b = {
          ...s.answers[index],
          presentedAt: s.answers[index].presentedAt ?? Date.now(),
        };
      if (wasVisible) b.visibleMs += Math.floor(now - last);
      last = now;
      wasVisible = !document.hidden;
      const next = {
        ...s,
        answers: s.answers.map((x, i) => (i === index ? b : x)),
      };
      latest.current = next;
      change.current(next);
    };
    tick();
    const timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("pagehide", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("pagehide", tick);
    };
  }, [index]);
  if (!a) return null;
  const item = r.items.find((p) => p.postId === a.postId)!;
  const choose = (
    field: "endorsementScore" | "argumentQualityScore",
    score: number,
  ) => {
    onChange({
      ...r,
      answers: r.answers.map((x, i) =>
        i === index ? { ...x, [field]: score } : x,
      ),
    });
    if (field === "endorsementScore" && a.endorsementScore === null &&
      window.matchMedia("(max-width: 767px)").matches) {
      requestAnimationFrame(() => {
        const question = secondQuestion.current;
        const scroller = question?.closest(".study-scroll");
        if (!question || !scroller) return;
        const rect = question.getBoundingClientRect(), viewport = scroller.getBoundingClientRect();
        if (rect.bottom > viewport.bottom || rect.top < viewport.top)
          question.scrollIntoView({ block: "nearest", behavior:
            window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      });
    }
  };
  return (
    <div className="study-shell study-screen blind-screen">
      <header className="study-header study-pad border-b">
        <h1 className="study-title">内容评价（{index + 1} / 4）</h1>
        <p className="study-copy mt-3">
          请阅读下面这条讨论内容，并回答两道问题：
        </p>
      </header>
      <main className="study-scroll study-pad blind-body" key={a.postId}>
        <article className="blind-post rounded-xl border">
          <p className="study-copy whitespace-pre-wrap">{item.content}</p>
        </article>
        <div className="blind-scales">
        {(
          [
            {
              field: "endorsementScore",
              text: "你有多认同这条内容的观点？",
              options: [
                "非常不认同",
                "比较不认同",
                "既不认同也不反对",
                "比较认同",
                "非常认同",
              ],
            },
            {
              field: "argumentQualityScore",
              text: "你觉得这条内容的理由有多充分、有说服力？",
              options: [
                "完全不充分",
                "不太充分",
                "一般",
                "比较充分",
                "非常充分",
              ],
            },
          ] as const
        ).map((q) => (
          <fieldset key={q.field} ref={q.field === "argumentQualityScore" ? secondQuestion : undefined}>
            <legend className="study-copy font-medium">{q.text}</legend>
            <div className="questionnaire-options">
              {q.options.map((text, i) => (
                <label key={text} className={`reason-choice study-control${a[q.field] === i + 1 ? " is-chosen" : ""}`}>
                  <input
                    type="radio"
                    name={q.field}
                    checked={a[q.field] === i + 1}
                    onChange={() => choose(q.field, i + 1)}
                  />
                  {text}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        </div>
      </main>
      <footer className="study-footer study-pad border-t">
        <button
          className="study-control w-full rounded-full bg-[#0084ff] px-4 py-3 text-white disabled:bg-neutral-200"
          disabled={!a.endorsementScore || !a.argumentQualityScore}
          onClick={() => {
            const now = Date.now(),
              s = latest.current,
              next = {
                ...s,
                answers: s.answers.map((x, i) =>
                  i === index ? { ...x, answeredAt: now } : x,
                ),
                completedAt: index === 3 ? now : null,
              };
            if (index === 3) onContinue(next);
            else onChange(next);
          }}
        >
          {index === 3 ? "继续" : "下一条"}
        </button>
      </footer>
    </div>
  );
}
