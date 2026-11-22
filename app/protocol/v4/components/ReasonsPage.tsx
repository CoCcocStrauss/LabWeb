"use client";
import { QUESTIONNAIRES } from "../data/questionnaire";
import type { TopicKey } from "../../../data/topics";
import {
  advanceReasons,
  reasonCanContinue,
  toggleReason,
  type ReasonResponse,
} from "../lib/reasons";
import { useEffect, useRef } from "react";
export function ReasonsPage({
  topic,
  response: r,
  onChange,
  onContinue,
}: {
  topic: TopicKey;
  response: ReasonResponse;
  onChange: (r: ReasonResponse) => void;
  onContinue: (r: ReasonResponse) => void;
}) {
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    body.current?.scrollTo(0, 0);
  }, [r.page]);
  const select = r.page === "select",
    which = r.page === "best" ? "best" : "worst";
  const title = select
    ? "对于这个议题，下面哪些理由符合你现在的想法？"
    : which === "best"
      ? "在以上全部理由中，你最认可哪一条？"
      : "在以上全部理由中，你最不认可哪一条？";
  const candidates = new Map(r.candidates.map((x) => [x.id, x.text]));
  const order = select
    ? r.order
    : r.order.filter((x) => x !== "other" && x !== "feeling");
  const choose = (id: string) => {
    if (select) onChange(toggleReason(r, id));
    else
      onChange({
        ...r,
        [`${which}Id`]: id === "unable" ? null : id,
        [`${which}Status`]: id === "unable" ? "unable" : "selected",
      });
  };
  return (
    <div className="study-shell study-screen reasons-pool-screen">
      <header className="study-header study-pad border-b bg-white">
        <h1 className="study-title">
          {r.stage === "pretest" ? "对生活与未来的看法" : "阅读后的看法"}
        </h1>
        <p className="study-copy mt-3 rounded-lg bg-neutral-50 p-3">
          {QUESTIONNAIRES[topic].statement}
        </p>
      </header>
      <main ref={body} className="study-scroll study-pad py-5">
        <fieldset>
          <legend className="study-copy font-medium">{title}</legend>
          {select ? (
            <p className="study-meta mt-2 text-neutral-600">
              可多选，也可以同时选择不同方向的理由。
            </p>
          ) : null}
          <div className="reason-pool-options mt-4">
            {order.map((id) => {
              const checked = select
                ? r.selectedIds.includes(id)
                : r[`${which}Id`] === id;
              const disabled =
                !select && id === r[which === "best" ? "worstId" : "bestId"];
              return (
                <div key={id}>
                  <label
                    className={`study-control reason-choice ${checked ? "is-chosen" : ""} ${disabled ? "opacity-40" : ""}`}
                  >
                    <input
                      type={select ? "checkbox" : "radio"}
                      name="reason-choice"
                      value={id}
                      checked={checked}
                      disabled={disabled}
                      onChange={() => choose(id)}
                    />
                    <span>
                      {candidates.get(id) ??
                        (id === "other"
                          ? "其他理由（可填写）。"
                          : "没有明确理由，主要凭整体感觉。")}
                    </span>
                  </label>
                  {select && id === "other" && checked ? (
                    <textarea
                      aria-label="其他理由"
                      value={r.otherText}
                      maxLength={500}
                      onChange={(e) =>
                        onChange({ ...r, otherText: e.target.value })
                      }
                      className="study-copy mt-2 w-full rounded-lg border p-3"
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
          {!select ? (
            <label className="study-control reason-choice mt-4">
              <input
                type="radio"
                name="reason-choice"
                value="unable"
                checked={r[`${which}Status`] === "unable"}
                onChange={() => choose("unable")}
              />
              <span>暂时无法比较</span>
            </label>
          ) : null}
        </fieldset>
      </main>
      <footer className="study-footer study-pad border-t bg-white">
        <button
          type="button"
          className="study-control w-full rounded-full bg-[#0084ff] px-4 py-3 text-white disabled:bg-neutral-200 disabled:text-neutral-400"
          disabled={!reasonCanContinue(r)}
          onClick={() => {
            const next = advanceReasons(r);
            if (next.page === "done") onContinue(next);
            else onChange(next);
          }}
        >
          下一步
        </button>
      </footer>
    </div>
  );
}
