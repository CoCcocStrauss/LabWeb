"use client";
import { useEffect, useState, type ReactNode } from "react";
import {
  TUTORIAL_STEPS,
  enterTutorialStep,
  completeTutorialStep,
  type RulesResponse,
} from "../lib/readingProtocol";
import { CompactPostCard } from "../../../components/CompactPostCard";
import { TUTORIAL_POSTS } from "../data/tutorial";

type DemoState = {
  paused: boolean;
  expanded: boolean;
  shared: boolean;
  liked: boolean;
};
export function TutorialPage({
  response,
  onChange,
  onStart,
  canContinue = true,
  saveStatus,
}: {
  response: RulesResponse;
  onChange: (r: RulesResponse) => void;
  onStart: () => void;
  canContinue?: boolean;
  saveStatus?: ReactNode;
}) {
  const stepIndex = Math.max(
    0,
    TUTORIAL_STEPS.findIndex((s) => s.id === response.activeStep),
  );
  const step = TUTORIAL_STEPS[stepIndex];
  const [phase, setPhase] = useState(0);
  const [manual, setManual] = useState<Record<string, DemoState>>({});
  const paused = manual[step.id]?.paused ?? false;
  useEffect(() => {
    setPhase(0);
    if (
      stepIndex === 2 ||
      paused ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const timer = setInterval(() => setPhase((p) => (p + 1) % 4), 625);
    return () => clearInterval(timer);
  }, [stepIndex, paused]);
  const demo = {
    expanded: stepIndex === 0 && (phase === 1 || phase === 2),
    shared: stepIndex === 1 && (phase === 1 || phase === 2),
    liked: false,
    ...(paused ? manual[step.id] : {}),
  };
  const interact = (change: Partial<DemoState>) =>
    setManual((current) => ({
      ...current,
      [step.id]: { ...demo, ...change, paused: true },
    }));
  const post = {
    ...TUTORIAL_POSTS[0],
    ...response.demoLabelSelections?.[String(TUTORIAL_POSTS[0].id)],
  };
  const next = () => {
    const time = Date.now();
    let updated = completeTutorialStep(response, step.id, time);
    if (stepIndex < 2)
      updated = enterTutorialStep(updated, TUTORIAL_STEPS[stepIndex + 1].id, time);
    onChange(updated);
    if (stepIndex === 2) onStart();
  };
  return (
    <div className="study-shell study-screen tutorial-screen">
      <main className="study-scroll study-pad py-5" key={step.id}>
        <p className="study-meta" aria-label="步骤进度">
          {stepIndex + 1} / 3
        </p>
        <h1 className="study-title mt-3">{step.title}</h1>
        <p className="study-copy mt-4">{step.text}</p>
        {stepIndex < 2 ? (
          <div
            className={`tutorial-demo mt-5 max-w-md ${!paused && (phase === 0 || phase === 2) ? "is-tapping" : ""}`}
            data-demo-step={step.id}
            data-manual={paused}
          >
            <span
              aria-hidden="true"
              className={`tutorial-tap ${stepIndex === 0 ? "at-content" : "at-share"}`}
            />
            <CompactPostCard
              post={post}
              liked={demo.liked}
              shared={demo.shared}
              shareDisabled={false}
              expanded={demo.expanded}
              onOpen={() => interact({ expanded: true })}
              onCollapse={() => interact({ expanded: false })}
              onLike={() => interact({ liked: !demo.liked })}
              onShare={() => interact({ shared: !demo.shared })}
            />
          </div>
        ) : (
          <>
            <p className="study-copy mt-4">
              认真阅读并清晰说明理由的参与者，将获得额外红包奖励。
            </p>
            <p className="tutorial-focus-note study-copy mt-5">
              请勿切屏或离开页面，频繁离开可能导致无法通过审核。
            </p>
            <div className="tutorial-status-preview mt-5" aria-label="阅读页顶部状态栏示意">
              <span>剩余时间 <strong>01:30</strong></span>
              <span>已转发数量 <strong>2 条</strong></span>
            </div>
          </>
        )}
      </main>
      <footer className="study-footer study-pad border-t border-neutral-200">
        {saveStatus}
        <div className="flex items-center gap-4">
          {stepIndex > 0 ? (
            <button
              type="button"
              className="study-control shrink-0 py-3 text-[#0875ca]"
              onClick={() =>
                onChange(enterTutorialStep(response, TUTORIAL_STEPS[stepIndex - 1].id))
              }
            >
              上一步
            </button>
          ) : null}
          <button
            type="button"
            disabled={!canContinue}
            onClick={next}
            className="study-control w-full rounded-full bg-[#0084ff] px-4 py-3 text-white disabled:bg-neutral-200 disabled:text-neutral-400"
          >
            下一步
          </button>
        </div>
      </footer>
    </div>
  );
}
