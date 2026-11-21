"use client";

import { useEffect, useRef, useState } from "react";
import { savePretest, submitExperimentData } from "../lib/dataSubmit";
import { finalPayload, type ExperimentSession, type ReadingEndData } from "../lib/experimentSession";

export type ExperimentEndData = ReadingEndData;

/** 请求保持同一载荷；响应丢失时由服务端幂等处理，刷新也不重做实验。 */
export function EndPage({ session, pretestOnly = false, onSaved }: {
  session: ExperimentSession; pretestOnly?: boolean; onSaved: (completionCode?: string) => boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const busy = useRef(false);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  useEffect(() => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    void (async () => {
      try {
        if (pretestOnly) {
          await savePretest({ uid: session.uid, conditionN: session.conditionN, topicKey: session.topicKey,
            sessionId: session.sessionId, sessionSecret: session.sessionSecret, questionnaireVersion: session.questionnaireVersion, pretest: session.pretest, microphonePermission: session.microphonePermission });
          if (!onSavedRef.current()) throw new Error("无法保存本地进度");
        } else {
          const code = await submitExperimentData(finalPayload(session));
          if (!onSavedRef.current(code)) throw new Error("无法保存本地进度");
        }
      } catch {
        setError("暂时未能确认保存成功。你的答案和阅读记录已保留，请检查网络后点击重试，无需重新作答。若仍无法保存，请联系实验员。");
      } finally { busy.current = false; }
    })();
  }, [pretestOnly, retry, session]);
  return <main className="study-shell study-page flex flex-col items-center justify-center text-center">
    <h1 className="study-title">{pretestOnly ? "正在保存回答" : "正在保存本部分数据"}</h1>
    {error ? <>
      <p role="alert" className="study-copy mt-5 text-neutral-700">{error}</p>
      <button type="button" onClick={() => setRetry(n => n + 1)} className="study-control mt-6 rounded-full bg-[#0084ff] px-8 py-3 font-medium text-white">重试保存</button>
    </> : <p role="status" className="study-copy mt-5 text-neutral-600">请稍候…</p>}
  </main>;
}

export function CompletePage({ returnUrl }: { returnUrl: string | null }) {
  useEffect(() => {
    if (!returnUrl) return;
    const timer = window.setTimeout(() => { window.location.href = returnUrl; }, 1200);
    return () => window.clearTimeout(timer);
  }, [returnUrl]);
  return <main className="study-shell study-page flex flex-col items-center justify-center text-center">
    <h1 className="study-title">本部分已完成</h1>
    <p className="study-copy mt-5 text-neutral-700">本部分已完成，请返回问卷，继续完成后续问题。</p>
    {returnUrl ? <a href={returnUrl} className="study-control mt-6 rounded-full bg-[#0084ff] px-8 py-3 text-white">返回问卷</a> : null}
  </main>;
}
