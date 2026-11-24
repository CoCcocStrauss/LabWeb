"use client";
import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import {
  COMPREHENSION_OPTIONS,
  COMPREHENSION_QUESTION,
  type ComprehensionAttempt,
} from "../data/questionnaire";
export function ComprehensionPage({
  attempts,
  onAttempt,
  onContinue,
}: {
  attempts: ComprehensionAttempt[];
  onAttempt: (attempt: ComprehensionAttempt) => void;
  onContinue: () => void;
}) {
  const attempt = attempts.at(-1),
    latest = useRef({ attempt, onAttempt, onContinue });
  latest.current = { attempt, onAttempt, onContinue };
  useEffect(() => {
    const saved = latest.current.attempt;
    if (!saved) return;
    if (saved.autoAdvancedAt) {
      latest.current.onContinue();
      return;
    }
    let last = performance.now(),
      visible = saved.feedbackVisibleMs ?? 0;
    let finished = false;
    const tick = () => {
      const now = performance.now();
      if (document.visibilityState === "visible")
        visible += Math.max(0, now - last);
      last = now;
      const { attempt: a, onAttempt: save, onContinue: next } = latest.current;
      if (!a || finished) return;
      const required = a.correct ? 3000 : 5000;
      const done = visible >= required;
      save({
        ...a,
        feedbackVisibleMs: Math.min(required, Math.floor(visible)),
        autoAdvancedAt: done ? Date.now() : null,
      });
      if (done) {
        finished = true;
        next();
      }
    };
    const changed = () => {
      last = performance.now();
    };
    document.addEventListener("visibilitychange", changed);
    const timer = setInterval(tick, 100);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", changed);
    };
  }, [attempt?.timestamp, attempt?.autoAdvancedAt]);
  return (
    <main className="study-shell study-page">
      <h1 className="study-title">确认任务规则</h1>
      <fieldset className="mt-5">
        <legend className="study-copy font-medium">
          {COMPREHENSION_QUESTION}
        </legend>
        <div className="mt-4 space-y-3">
          {COMPREHENSION_OPTIONS.map((text, i) => {
            const value = i + 1,
              correct = !!attempt && value === 1,
              wrong = !!attempt && !attempt.correct && value === attempt.value;
            return (
              <button
                type="button"
                key={text}
                disabled={!!attempt}
                onClick={() => {
                  const now = Date.now();
                  onAttempt({
                    value,
                    correct: value === 1,
                    timestamp: now,
                    feedbackPresentedAt: now,
                    feedbackVisibleMs: 0,
                    autoAdvancedAt: null,
                  });
                }}
                className={`study-control flex w-full items-start gap-3 rounded-lg border p-4 text-left ${correct ? "border-green-600 bg-green-50 text-green-800" : wrong ? "border-red-600 bg-red-50 text-red-800" : "border-neutral-200"}`}
              >
                <span>
                  {String.fromCharCode(65 + i)}. {text}
                </span>
                {correct ? (
                  <Check className="shrink-0" aria-label="正确答案" />
                ) : null}
              </button>
            );
          })}
        </div>
      </fieldset>
      {attempt ? (
        <p
          role="status"
          className={`study-copy mt-5 ${attempt.correct ? "text-green-700" : "text-red-700"}`}
        >
          {attempt.correct ? "回答正确" : "回答错误"}
        </p>
      ) : null}
    </main>
  );
}
