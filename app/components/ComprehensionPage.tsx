"use client";
import { useState } from "react";
import { COMPREHENSION_OPTIONS, COMPREHENSION_QUESTION, type ComprehensionAttempt } from "../data/questionnaire";

export function ComprehensionPage({ attempts, onAttempt, onContinue }: {
  attempts: ComprehensionAttempt[]; onAttempt: (attempt: ComprehensionAttempt) => void; onContinue: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const last = attempts.at(-1);
  return <main className="study-shell study-page">
    <h1 className="study-title">确认操作规则</h1>
    <p className="study-copy mt-3 text-neutral-600">完成这道题后，将进入阅读准备页。现在尚未开始计时。</p>
    <fieldset className="mt-6">
      <legend className="study-copy font-medium">{COMPREHENSION_QUESTION}</legend>
      <div className="mt-5 space-y-3">{COMPREHENSION_OPTIONS.map((option, i) => <label key={option} className="study-control flex items-start gap-3 rounded-lg border border-neutral-200 px-4 py-3">
        <input type="radio" name="comprehension" checked={selected === i + 1} disabled={last?.correct} onChange={() => setSelected(i + 1)} className="mt-1 h-5 w-5 shrink-0 accent-[#0084ff]" />
        {String.fromCharCode(65 + i)}. {option}
      </label>)}</div>
    </fieldset>
    {last ? <p role="status" className={`study-copy mt-5 ${last.correct ? "text-green-700" : "text-neutral-700"}`}>
      {last.correct ? "回答正确。选满两条后，可以继续阅读，也可以点击结束按钮。" : "选满两条后，可以继续阅读，也可以点击结束按钮；只有时间结束才会自动结束阅读。请重新选择。"}
    </p> : null}
    <button type="button" disabled={!last?.correct && selected === null} onClick={() => {
      if (last?.correct) { onContinue(); return; }
      if (selected !== null) { onAttempt({ value: selected, correct: selected === 2, timestamp: Date.now() }); setSelected(null); }
    }} className="study-control mt-6 w-full rounded-full bg-[#0084ff] px-4 py-3 font-medium text-white disabled:bg-neutral-200 disabled:text-neutral-400">
      {last?.correct ? "下一步" : "确认答案"}
    </button>
  </main>;
}
