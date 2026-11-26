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
  return <div className="study-shell study-screen comparison-screen">
    <header className="study-header study-pad border-b">
      <h1 className="study-title">观点对比</h1>
      <p className="study-copy mt-2">请分别选择最符合和最不符合你想法的内容。</p>
    </header>
    <main className="study-scroll study-pad comparison-body">
      {([
        ['mostAlignedPostId', '1. 哪条内容最符合你的想法？'],
        ['leastAlignedPostId', '2. 哪条内容最不符合你的想法？'],
      ] as const).map(([field, question]) => <fieldset className="comparison-question" key={field}
        disabled={field === 'leastAlignedPostId' && !c.mostAlignedPostId}>
        <legend className="study-copy font-medium">{question}</legend>
        {field === 'leastAlignedPostId' && !c.mostAlignedPostId ? <p className="study-meta mt-2 text-neutral-500">请先完成第 1 题。</p> : null}
        <div className="comparison-grid">
          {c.candidateIds.filter((id) => field === 'mostAlignedPostId' || id !== c.mostAlignedPostId).map((id) =>
            <label className={`comparison-card${c[field] === id ? ' is-chosen' : ''}`} key={id}>
              <span className="comparison-option-heading">
                <input type="radio" name={field} value={id} checked={c[field] === id}
                  onChange={() => onChange(chooseComparison(c, field, id))} />
                <span className="study-meta font-medium">内容 {String.fromCharCode(65 + c.candidateIds.indexOf(id))}</span>
              </span>
              <span className="comparison-option-content study-copy whitespace-pre-wrap">{posts.get(id)!.content}</span>
            </label>)}
        </div>
      </fieldset>)}
    </main>
    <footer className="study-footer study-pad border-t">
      <button className="study-control w-full rounded-full bg-[#0084ff] px-4 py-3 text-white disabled:bg-neutral-200 disabled:text-neutral-400"
        disabled={!c.mostAlignedPostId || !c.leastAlignedPostId || c.mostAlignedPostId === c.leastAlignedPostId || c.presentedAt === null}
        onClick={() => onContinue(finishComparison(c))}>继续</button>
    </footer>
  </div>;
}
