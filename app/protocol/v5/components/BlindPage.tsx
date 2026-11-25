"use client";
import { useEffect, useRef } from "react";
import { PostAuthor } from "../../../components/CompactPostCard";
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
  ) =>
    onChange({
      ...r,
      answers: r.answers.map((x, i) =>
        i === index ? { ...x, [field]: score } : x,
      ),
    });
  return (
    <div className="study-shell study-screen">
      <header className="study-header study-pad border-b">
        <h1 className="study-title">内容评价（{index + 1} / 4）</h1>
        <p className="study-copy mt-3">
          请阅读下面这条讨论内容，并回答两道问题：
        </p>
      </header>
      <main className="study-scroll study-pad py-5" key={a.postId}>
        <article className="rounded-xl border p-4">
          <PostAuthor post={item} compact hideCertification />
          <p className="study-copy mt-4 whitespace-pre-wrap">{item.content}</p>
        </article>
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
          <fieldset key={q.field} className="mt-6">
            <legend className="study-copy font-medium">{q.text}</legend>
            <div className="questionnaire-options">
              {q.options.map((text, i) => (
                <label key={text} className="reason-choice study-control">
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
