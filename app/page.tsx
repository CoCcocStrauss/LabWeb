"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import type { ExperimentEndData } from "./components/EndPage";
import { ErrorPage } from "./components/ErrorPage";
import { isTopicKey, type TopicKey } from "./data/topics";
import { assignCondition } from "./lib/conditionAssignment";

const TutorialPage = dynamic(
  () => import("./components/TutorialPage").then((m) => m.TutorialPage),
  { ssr: false }
);
const ExperimentPage = dynamic(
  () => import("./components/ExperimentPage").then((m) => m.ExperimentPage),
  { ssr: false }
);
const EndPage = dynamic(
  () => import("./components/EndPage").then((m) => m.EndPage),
  { ssr: false }
);

const VALID_N = [8, 16, 48] as const;
type ConditionN = (typeof VALID_N)[number];

type Phase = "tutorial" | "experiment" | "end";

/** 只允许安全的 http(s) 绝对地址，防止 javascript: 等协议被用于跳转注入。 */
function sanitizeReturnUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function parseParams(searchParams: URLSearchParams): {
  uid: string;
  conditionN: ConditionN;
  topic: TopicKey;
  returnUrl: string | null;
} | null {
  const uid = searchParams.get("uid")?.trim();
  if (!uid) return null;

  const nRaw = searchParams.get("n");
  const topicRaw = searchParams.get("topic")?.trim();
  const hasManualOverride = nRaw != null || topicRaw != null;

  let conditionN: ConditionN;
  let topic: TopicKey;

  if (hasManualOverride) {
    // 手动指定模式：仅用于 QA / 定向测试某个条件组合，n 与 topic 必须同时给且合法。
    const n = nRaw != null ? Number(nRaw) : NaN;
    if (!VALID_N.includes(n as ConditionN) || !topicRaw || !isTopicKey(topicRaw)) {
      return null;
    }
    conditionN = n as ConditionN;
    topic = topicRaw;
  } else {
    // 生成端只需传 uid：按 uid 哈希稳定分配到 3(N) × 2(topic) = 6 个条件之一，
    // 同一 uid 刷新/重开链接始终分到同一组。
    const assigned = assignCondition(uid);
    conditionN = assigned.conditionN;
    topic = assigned.topic;
  }

  const returnUrl = sanitizeReturnUrl(searchParams.get("returnUrl"));

  return { uid, conditionN, topic, returnUrl };
}

function LoadingScreen() {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] items-center justify-center bg-white text-[14px] text-neutral-500 md:max-w-[640px]">
      加载中…
    </div>
  );
}

function ExperimentFlow() {
  const searchParams = useSearchParams();
  const params = useMemo(
    () => parseParams(searchParams),
    [searchParams]
  );

  const [phase, setPhase] = useState<Phase>("tutorial");
  const [endData, setEndData] = useState<ExperimentEndData | null>(null);

  const handleExperimentEnd = useCallback((data: ExperimentEndData) => {
    setEndData(data);
    setPhase("end");
  }, []);

  if (!params) {
    return <ErrorPage />;
  }

  if (phase === "tutorial") {
    return (
      <TutorialPage onStart={() => setPhase("experiment")} />
    );
  }

  if (phase === "experiment") {
    return (
      <ExperimentPage
        uid={params.uid}
        conditionN={params.conditionN}
        topic={params.topic}
        onEnd={handleExperimentEnd}
      />
    );
  }

  if (endData) {
    return <EndPage data={endData} returnUrl={params.returnUrl} />;
  }

  return <LoadingScreen />;
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ExperimentFlow />
    </Suspense>
  );
}
