"use client";
import { useEffect } from "react";
import type { PostItem } from "../../../lib/blockRandomize";
import { chooseComparison, finishComparison, type BestWorstComparison } from "../lib/bestWorstComparison";

export function BestWorstPage({ response: c, posts, onChange, onContinue }: {
  response: BestWorstComparison;
  posts: Map<string, PostItem>;
  onChange: (c: BestWorstComparison) => void;
  onContinue: (c: BestWorstComparison) => void;
}) {
  useEffect(() => { if (c.presentedAt === null) onChange({ ...c, presentedAt: Date.now() }); }, [c, onChange]);
  const isMost = c.activeQuestion !== "least";
  const field = isMost ? "mostAlignedPostId" : "leastAlignedPostId";
  const question = isMost ? "哪条内容最符合你的想法？" : "哪条内容最不符合你的想法？";
  const canContinue = c.presentedAt !== null && (isMost ? !!c.mostAlignedPostId :
    !!c.mostAlignedPostId && !!c.leastAlignedPostId && c.mostAlignedPostId !== c.leastAlignedPostId);
  return <div className="study-shell study-screen comparison-screen">
    <header className="study-header study-pad border-b">
      <h1 className="study-title" id="comparison-question-title">{question}</h1>
    </header>
    <main className="study-scroll study-pad comparison-body" key={field}>
      <fieldset className="comparison-question" aria-labelledby="comparison-question-title">
        <div className="comparison-grid">
          {c.candidateIds.filter((id) => isMost || id !== c.mostAlignedPostId).map((id) =>
            <label className={`comparison-card${c[field] === id ? ' is-chosen' : ''}`} key={id}>
              <span className="comparison-option-heading">
                <input type="radio" name={field} value={id} checked={c[field] === id}
                  onChange={() => onChange(chooseComparison(c, field, id))} />
                <span className="study-meta font-medium">内容 {String.fromCharCode(65 + c.candidateIds.indexOf(id))}</span>
              </span>
              <span className="comparison-option-content study-copy whitespace-pre-wrap">{posts.get(id)!.content}</span>
            </label>)}
        </div>
      </fieldset>
    </main>
    <footer className="study-footer study-pad border-t flex items-center gap-4">
      {!isMost ? <button type="button" className="study-control shrink-0 py-3 text-[#0875ca]"
        onClick={() => onChange({ ...c, activeQuestion: "most" })}>上一题</button> : null}
      <button type="button" className="study-control w-full rounded-full bg-[#0084ff] px-4 py-3 text-white disabled:bg-neutral-200 disabled:text-neutral-400"
        disabled={!canContinue}
        onClick={() => {
          if (!canContinue) return;
          if (isMost) onChange({ ...c, activeQuestion: "least" });
          else onContinue(finishComparison(c));
        }}>{isMost ? "下一步" : "继续"}</button>
    </footer>
  </div>;
}
