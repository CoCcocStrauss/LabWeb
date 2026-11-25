"use client";
import { type ReactNode } from "react";
import {
  TUTORIAL_STEPS,
  enterTutorialStep,
  completeTutorialStep,
  type RulesResponse,
} from "../lib/readingProtocol";
import { TutorialPreview } from "./TutorialPreview";

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
        <h1 className="study-title mt-1">{step.title}</h1>
        <p className="study-copy mt-3">{step.text}</p>
        {stepIndex === 2 ? (
          <div className="tutorial-focus-notes">
            <p className="tutorial-focus-note">请勿切屏或离开页面，频繁离开可能导致无法通过审核。</p>
          </div>
        ) : null}
        <TutorialPreview key={step.id} stepIndex={stepIndex} selections={response.demoLabelSelections} />
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
