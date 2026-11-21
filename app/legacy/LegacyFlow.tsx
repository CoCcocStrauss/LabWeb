"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ErrorPage } from "../components/ErrorPage";
import { emptyResponse } from "./questionnaire";
import { isTopicKey } from "../data/topics";
import { blockRandomize } from "../lib/blockRandomize";
import { assignCondition, type ConditionN } from "../lib/conditionAssignment";
import { enrichPostsForDisplay } from "../lib/enrichPosts";
import { createSession, loadSession, saveSession, READING_DURATION_MS, type ExperimentSession, type ReadingEndData, type ReadingSnapshot } from "./experimentSession";
import { getMaterialsForTopic } from "../lib/materialsRegistry";

const TutorialPage = dynamic(() => import("../components/TutorialPage").then(m => m.TutorialPage), { ssr: false });
const ExperimentPage = dynamic(() => import("../components/ExperimentPage").then(m => m.ExperimentPage), { ssr: false });
const EndPage = dynamic(() => import("./EndPage").then(m => m.EndPage), { ssr: false });
const CompletePage = dynamic(() => import("./EndPage").then(m => m.CompletePage), { ssr: false });
const QuestionnairePage = dynamic(() => import("./QuestionnairePage").then(m => m.QuestionnairePage), { ssr: false });
const ComprehensionPage = dynamic(() => import("../components/ComprehensionPage").then(m => m.ComprehensionPage), { ssr: false });
const ReadyPage = dynamic(() => import("../components/ReadyPage").then(m => m.ReadyPage), { ssr: false });

function sanitizeReturnUrl(raw: string | null): string | null {
  if (!raw) return null;
  try { const url = new URL(raw); return ["http:", "https:"].includes(url.protocol) ? url.toString() : null; }
  catch { return null; }
}

function parseParams(searchParams: URLSearchParams) {
  const uid = searchParams.get("uid")?.trim();
  if (!uid || uid.length > 200) return null;
  const n = searchParams.get("n");
  const topic = searchParams.get("topic")?.trim();
  const manual = n !== null || topic !== undefined;
  if (manual && (![8, 16, 48].includes(Number(n)) || !topic || !isTopicKey(topic))) return null;
  const assigned = manual ? { conditionN: Number(n) as ConditionN, topic: topic! as "ai" | "fertility" } : assignCondition(uid);
  return { uid, ...assigned, returnUrl: sanitizeReturnUrl(searchParams.get("returnUrl")), manual };
}

function LoadingScreen() {
  return <div className="study-shell study-page flex items-center justify-center text-neutral-500">加载中…</div>;
}

function SessionFlow({ params }: { params: NonNullable<ReturnType<typeof parseParams>> }) {
  const [session, setSession] = useState<ExperimentSession | null>(null);
  const sessionRef = useRef<ExperimentSession | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const existing = loadSession(params.uid);
      if (existing && params.manual && (existing.conditionN !== params.conditionN || existing.topicKey !== params.topic)) {
        throw new Error("此链接的分组与已保存的进度不一致。请使用原链接继续，或联系实验员。");
      }
      const initial = existing ?? createSession(params);
      saveSession(initial);
      sessionRef.current = initial;
      setSession(initial);
    } catch (error) {
      setFatalError(error instanceof Error && /进度|原链接/.test(error.message) ? error.message : "无法保存或读取实验进度。请允许此页面使用浏览器存储后刷新重试，或联系实验员。");
    }
  }, [params]);

  // 先持久化再推进，避免刷新与失败重试丢失答案或生成新一轮阅读。
  const update = useCallback((change: (previous: ExperimentSession) => ExperimentSession) => {
    const previous = sessionRef.current;
    if (!previous) return false;
    const next = change(previous);
    try {
      saveSession(next);
      sessionRef.current = next;
      setSession(next);
      setStorageError(null);
      return true;
    } catch {
      setStorageError("暂时无法保存浏览器进度。请保留此页、检查存储空间后重试，或联系实验员。");
      return false;
    }
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === `labweb:session:v1:${encodeURIComponent(params.uid)}`) {
        setFatalError("检测到此实验在另一个页面继续。请只保留一个实验页面，并在该页面完成作答。");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [params.uid]);

  const handleSnapshot = useCallback((reading: ReadingSnapshot) => {
    update(s => s.phase === "experiment" ? { ...s, reading } : s);
  }, [update]);
  const handleReadingEnd = useCallback((endData: ReadingEndData) => {
    return update(s => ({ ...s, endData, posttest: emptyResponse("posttest"), phase: "posttest" }));
  }, [update]);

  if (fatalError) return <main className="study-shell study-page flex items-center" role="alert">{fatalError}</main>;
  if (!session) return <LoadingScreen />;
  let content;
  switch (session.phase) {
    case "pretest":
      content = <QuestionnairePage topic={session.topicKey} stage="pretest" response={session.pretest}
        onAnswer={(pretest, done) => update(s => ({ ...s, pretest, phase: done ? "pretest_save" : "pretest" }))} />; break;
    case "pretest_save":
      content = <EndPage session={session} pretestOnly onSaved={() => update(s => ({ ...s, phase: "tutorial" }))} />; break;
    case "tutorial":
      content = <TutorialPage onStart={() => update(s => ({ ...s, phase: "comprehension" }))} />; break;
    case "comprehension":
      content = <ComprehensionPage attempts={session.comprehension}
        onAttempt={attempt => update(s => ({ ...s, comprehension: [...s.comprehension, attempt] }))}
        onContinue={() => update(s => ({ ...s, phase: "ready" }))} />; break;
    case "ready":
      content = <ReadyPage onStart={() => {
        const materials = getMaterialsForTopic(session.topicKey);
        const posts = enrichPostsForDisplay(blockRandomize(materials.materials, session.conditionN), session.topicKey);
        const now = Date.now();
        update(s => ({ ...s, phase: "experiment", reading: { posts, startTime: now, deadline: now + READING_DURATION_MS,
          savedAt: now, actions: [], scrollEvents: [], postVisibilitySummary: {}, maxScrollY: 0, scrollY: 0,
          userPostDraft: "", ownPost: null, insertBeforePostId: null } }));
      }} />; break;
    case "experiment":
      content = <ExperimentPage uid={session.uid} conditionN={session.conditionN} topic={session.topicKey}
        initialReading={session.reading!} onSnapshot={handleSnapshot} onEnd={handleReadingEnd} />; break;
    case "posttest":
      content = <QuestionnairePage key="posttest" topic={session.topicKey} stage="posttest" response={session.posttest!}
        onAnswer={(posttest, done) => update(s => ({ ...s, posttest, phase: done ? "submitting" : "posttest" }))} />; break;
    case "submitting":
      content = <EndPage session={session} onSaved={completionCode => update(s => ({ ...s, phase: "complete", completionCode: completionCode ?? null }))} />; break;
    case "complete": content = <CompletePage returnUrl={sanitizeReturnUrl(session.returnUrl)} />;
  }
  return <>{content}{storageError ? <div role="alert" className="study-copy fixed inset-x-0 top-0 z-[100] bg-red-50 p-4 text-center text-red-800">{storageError}</div> : null}</>;
}

function ExperimentFlow() {
  const searchParams = useSearchParams();
  const params = useMemo(() => parseParams(searchParams), [searchParams]);
  return params ? <SessionFlow key={params.uid} params={params} /> : <ErrorPage />;
}

export default function Home() {
  return <Suspense fallback={<LoadingScreen />}><ExperimentFlow /></Suspense>;
}
