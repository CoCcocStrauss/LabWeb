"use client";
import { useEffect, useState } from "react";
import { answerRecognition, type RecognitionResponse } from "../lib/posttest";
import { PostTaskFrame } from "./PostTaskFrame";

export function RecognitionPage({ response, onPresent, onAnswer }: {
  response: RecognitionResponse; onPresent: (time: number) => void; onAnswer: (value: RecognitionResponse) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => { if (response.presentedAt === null) onPresent(Date.now()); }, [onPresent, response.presentedAt]);
  return <PostTaskFrame title="回想刚才的选择" footer={<button type="button" disabled={!selected} onClick={() => {
    if (selected) onAnswer(answerRecognition(response, selected));
  }} className="study-control w-full rounded-full bg-[#0084ff] px-4 py-3 font-medium text-white disabled:bg-neutral-200 disabled:text-neutral-400">下一步</button>}>
    <fieldset><legend className="study-copy font-medium">下面哪条内容是你刚才转发过的？</legend>
      <div className="mt-5 space-y-3">{[...response.options.map(o => ({ id: o.postId, text: o.excerpt })), { id: "not_sure", text: "记不清了" }].map(o =>
        <label key={o.id} className={`study-control flex items-start gap-3 rounded-lg border p-3 ${selected === o.id ? "border-[#0084ff] bg-blue-50" : "border-neutral-200"}`}>
          <input type="radio" name="recognition" checked={selected === o.id} onChange={() => setSelected(o.id)} className="mt-1 h-5 w-5 shrink-0 accent-[#0084ff]" />
          <span className="study-copy">{o.text}</span>
        </label>)}</div>
    </fieldset>
  </PostTaskFrame>;
}
