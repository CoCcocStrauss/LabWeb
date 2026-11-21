"use client";

import { useEffect, useRef, useState } from "react";
import { getQuestions, QUESTIONNAIRES, type QuestionnaireResponse, type QuestionnaireStage } from "../data/questionnaire";
import type { TopicKey } from "../data/topics";

export function QuestionnairePage({ topic, stage, response, onAnswer, stopAfter }: {
  topic: TopicKey; stage: QuestionnaireStage; response: QuestionnaireResponse;
  onAnswer: (response: QuestionnaireResponse, done: boolean) => void;
  stopAfter?: number;
}) {
  const questions = getQuestions(topic, stage);
  const index = response.answers.length;
  const question = questions[index];
  const [selected, setSelected] = useState<number | null>(null);
  const questionStartedAt = useRef(Date.now());
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setSelected(null); questionStartedAt.current = Date.now(); bodyRef.current?.scrollTo(0, 0); }, [index]);
  if (!question) return null;
  const last = index === questions.length - 1;
  const context = question.context ?? "scenario";
  const next = () => {
    if (selected === null) return;
    const now = Date.now();
    onAnswer({ ...response, completedAt: last ? now : null, answers: [...response.answers,
      { questionId: question.id, value: selected, startedAt: questionStartedAt.current, answeredAt: now }] }, index + 1 === (stopAfter ?? questions.length));
    setSelected(null);
  };
  return (
    <div className="questionnaire-screen study-shell study-screen">
      <header className="questionnaire-header study-header study-pad border-b border-neutral-200 bg-white">
        <h1 className="study-title">{context === "none" ? "其他看法" : stage === "pretest" ? "对生活与未来的看法" : "阅读后的看法"}</h1>
        {context !== "none" ? <p className="questionnaire-scenario study-copy mt-3 rounded-lg bg-neutral-50 p-3 text-neutral-800">{context === "scenario" ? QUESTIONNAIRES[topic].scenario : QUESTIONNAIRES[topic].statement}</p> : null}
      </header>
      <div ref={bodyRef} className="questionnaire-body study-scroll study-pad py-5">
        <p className="questionnaire-progress study-meta mb-3 text-neutral-500">第 {index + 1} / {questions.length} 题</p>
        <fieldset key={question.id}>
          <legend className="study-copy font-medium">{question.text}</legend>
          <div className="questionnaire-options">
            {question.options.map((option, i) => (
              <label key={option} className={`study-control flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 ${selected === i + 1 ? "border-[#0084ff] bg-blue-50" : "border-neutral-200"}`}>
                <input type="radio" name={question.id} value={i + 1} checked={selected === i + 1} onChange={() => setSelected(i + 1)} className="h-5 w-5 shrink-0 accent-[#0084ff]" />
                {option}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <footer className="study-footer study-pad border-t border-neutral-200 bg-white">
        <button type="button" disabled={selected === null} onClick={next} className="study-control w-full rounded-full bg-[#0084ff] px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400">
          {last && stage === "posttest" ? "提交并返回问卷" : "下一步"}
        </button>
      </footer>
    </div>
  );
}
