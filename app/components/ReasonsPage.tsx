"use client";
import { QUESTIONNAIRES } from "../data/questionnaire";
import { getReasons } from "../data/reasons";
import type { TopicKey } from "../data/topics";
import { toggleReason, type ReasonsResponse } from "../lib/posttest";
import { PostTaskFrame } from "./PostTaskFrame";

export function ReasonsPage({ topic, response, onChange, onContinue }: {
  topic: TopicKey; response: ReasonsResponse; onChange: (value: ReasonsResponse) => void; onContinue: (value: ReasonsResponse) => void;
}) {
  const options = new Map(getReasons(topic).map(r => [r.id, r.text]));
  const primaryStep = response.selectedAt !== null;
  const ids = primaryStep ? response.order.filter(id => response.selected.includes(id)) : response.order;
  return <PostTaskFrame title="作出判断的考虑" reference={QUESTIONNAIRES[topic].statement} footer={
    <button type="button" disabled={primaryStep ? !response.primary : response.selected.length === 0} onClick={() => {
      const now = Date.now();
      if (!primaryStep && response.selected.length > 1) { onChange({ ...response, selectedAt: now }); return; }
      onContinue({ ...response, selectedAt: response.selectedAt ?? now,
        primary: primaryStep ? response.primary : response.selected[0], completedAt: now });
    }} className="study-control w-full rounded-full bg-[#0084ff] px-4 py-3 font-medium text-white disabled:bg-neutral-200 disabled:text-neutral-400">下一步</button>}>
    <fieldset><legend className="study-copy font-medium">{primaryStep ? "在你选出的考虑中，哪一项最重要？" : "作出刚才的判断时，下面哪些考虑对你最重要？请选择最多三项。这些考虑可以同时存在，也不一定指向同一种结论。"}</legend>
      {!primaryStep ? <p className="study-meta mt-3 text-neutral-600">已选 {response.selected.length} / 3</p> : null}
      <div className="mt-4 space-y-3">{ids.map(id => <div key={id}>
        <label className="study-control flex items-start gap-3 rounded-lg border border-neutral-200 p-3">
          <input type={primaryStep ? "radio" : "checkbox"} name="reason" checked={primaryStep ? response.primary === id : response.selected.includes(id)}
            disabled={!primaryStep && !response.selected.includes(id) && id !== "feeling" && !response.selected.includes("feeling") && response.selected.length >= 3}
            onChange={() => onChange(primaryStep ? { ...response, primary: id } : { ...response, selected: toggleReason(response.selected, id), primary: null })}
            className="mt-1 h-5 w-5 shrink-0 accent-[#0084ff]" />
          <span className="study-copy">{options.get(id)}{primaryStep && id === "other" && response.otherText ? ` ${response.otherText}` : ""}</span>
        </label>
        {id === "other" && response.selected.includes(id) && !primaryStep ? <textarea aria-label="其他考虑（选填）" placeholder="其他考虑（选填）" value={response.otherText} maxLength={500}
          onChange={e => onChange({ ...response, otherText: e.target.value })} className="study-control mt-2 w-full rounded-lg border border-neutral-200 p-3" /> : null}
      </div>)}</div>
    </fieldset>
  </PostTaskFrame>;
}
