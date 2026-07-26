"use client";

import { useEffect, useRef, useState } from "react";

import type { TopicKey } from "../data/topics";
import {
  submitExperimentData,
  type ActionLog,
  type EndReason,
  type PostVisibilitySummary,
  type ScrollEvent,
} from "../lib/dataSubmit";

export type ExperimentEndData = {
  uid: string;
  conditionN: number;
  topic: string;
  topicKey: TopicKey;
  startTime: number;
  endTime: number;
  endReason: EndReason;
  maxScrollY: number;
  postOrder: string[];
  actions: ActionLog[];
  scrollEvents: ScrollEvent[];
  postVisibilitySummary: PostVisibilitySummary;
};

export type EndPageProps = {
  data: ExperimentEndData;
  /** 提交成功后自动跳回的地址（通常是 Credamo 的续答/后测链接），未提供则停留在感谢页 */
  returnUrl?: string | null;
};

const REDIRECT_DELAY_MS = 1200;

export function EndPage({ data, returnUrl }: EndPageProps) {
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(true);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    void (async () => {
      try {
        await submitExperimentData({
          uid: data.uid,
          conditionN: data.conditionN,
          topic: data.topic,
          topicKey: data.topicKey,
          startTime: data.startTime,
          endTime: data.endTime,
          endReason: data.endReason,
          maxScrollY: data.maxScrollY,
          postOrder: data.postOrder,
          actions: data.actions,
          scrollEvents: data.scrollEvents,
          postVisibilitySummary: data.postVisibilitySummary,
        });
        setIsDone(true);
      } catch (e) {
        console.error(e);
        setError(
          "数据提交失败，请检查网络后刷新页面重试。如问题持续，请联系实验员。"
        );
        submittedRef.current = false;
      } finally {
        setIsSubmitting(false);
      }
    })();
  }, [data]);

  useEffect(() => {
    if (!isDone || !returnUrl) return;
    const timer = window.setTimeout(() => {
      window.location.href = returnUrl;
    }, REDIRECT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isDone, returnUrl]);

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col items-center justify-center bg-white px-6 text-center text-neutral-900">
      <p className="text-xl font-semibold">实验结束，感谢参与！</p>

      {isSubmitting ? (
        <p className="mt-6 text-[14px] text-neutral-500">正在提交数据…</p>
      ) : error ? (
        <p className="mt-6 text-[14px] leading-relaxed text-red-600">{error}</p>
      ) : isDone ? (
        <p className="mt-6 text-[14px] text-neutral-600">
          {returnUrl
            ? "您的数据已成功保存，即将跳转回问卷…"
            : "您的数据已成功保存，可以关闭此页面。"}
        </p>
      ) : null}
    </div>
  );
}
