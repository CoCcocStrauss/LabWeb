"use client";
import { useEffect, useRef, useState } from "react";
import { QUESTIONNAIRES } from "../data/questionnaire";
import type { TopicKey } from "../data/topics";
import { postJson } from "../lib/dataSubmit";
import { uploadAudio } from "../lib/audio";
import {
  countEffectiveCharacters,
  explanationQualifies,
  type ExplanationResponse,
} from "../lib/posttest";
import { PostTaskFrame } from "./PostTaskFrame";
import { VoiceRecorder } from "./VoiceRecorder";

export function ExplanationPage({
  topic,
  reference,
  identity,
  response,
  onChange,
  onContinue,
}: {
  topic: TopicKey;
  reference?: string;
  identity: { uid: string; sessionId: string; sessionSecret: string };
  response: ExplanationResponse;
  onChange: (value: ExplanationResponse) => void;
  onContinue: (value: ExplanationResponse) => boolean;
}) {
  const [mediaBusy, setMediaBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(response);
  latest.current = response;
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      request.current?.abort();
    },
    [],
  );
  const count = countEffectiveCharacters(response.text);
  const finish = async () => {
    if (mediaBusy || uploading || !explanationQualifies(response)) return;
    const token = ++generation.current;
    let value = { ...response, effectiveCharCount: count };
    setError(null);
    try {
      if (
        value.audio &&
        value.audio.state !== "excluded" &&
        value.audio.state !== "uploaded"
      ) {
        setUploading(true);
        request.current = new AbortController();
        onChange({ ...value, audio: { ...value.audio, state: "uploading" } });
        const audio = await uploadAudio(
          identity,
          value.audio,
          request.current.signal,
        );
        if (token !== generation.current) return;
        value = { ...value, audio };
        onChange(value);
      }
      if (token !== generation.current) return;
      const hasAudio = value.audio?.state === "uploaded";
      const completed = {
        ...value,
        completedAt: Date.now(),
        inputMethod: hasAudio ? (value.text.trim() ? "both" : "audio") : "text",
      } as ExplanationResponse;
      setUploading(true);
      const saved = await postJson<{ saved: boolean }>("/api/explanation", {
        uid: identity.uid,
        sessionId: identity.sessionId,
        sessionSecret: identity.sessionSecret,
        explanation: completed,
      });
      if (token !== generation.current) return;
      if (saved.saved !== true) throw new Error("尚未确认本题保存成功。");
      onContinue(completed);
    } catch (failure) {
      if (token !== generation.current) return;
      const audio = latest.current.audio;
      onChange({
        ...latest.current,
        audio: audio
          ? {
              ...audio,
              state: audio.state === "uploaded" ? "uploaded" : "ready",
            }
          : null,
      });
      setError(
        `${failure instanceof Error ? failure.message : "录音上传尚未成功。"} 请通过同一按钮重试；如不保留录音，可主动删除后提交达标文字。`,
      );
    } finally {
      if (token === generation.current) setUploading(false);
    }
  };
  return (
    <PostTaskFrame
      title="说说你的想法"
      reference={reference ?? QUESTIONNAIRES[topic].statement}
      footer={
        <div>
          {error ? (
            <p role="alert" className="study-meta mb-3 text-red-700">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={mediaBusy || uploading || !explanationQualifies(response)}
            onClick={() => void finish()}
            className="study-control w-full rounded-full bg-[#0084ff] px-4 py-3 text-white disabled:bg-neutral-200 disabled:text-neutral-400"
          >
            {uploading ? "正在保存…" : error ? "重试提交" : "提交"}
          </button>
        </div>
      }
    >
      <p className="study-copy mb-5">
        你为什么会作出这样的判断？请说说你的想法，以及对你影响最大的考虑。可以结合自己的经历和刚才阅读的内容，没有标准答案，也不需要专业知识。
      </p>
      <p className="study-meta mb-5 text-neutral-600">
        录音至少20秒，或填写至少20个有效字符，任选一种即可。录音会保存用于本次研究分析。
      </p>
      <VoiceRecorder
        audio={response.audio}
        disabled={uploading}
        onBusyChange={setMediaBusy}
        onChange={(audio) => onChange({ ...latest.current, audio })}
      />
      <label
        className="study-copy mt-6 block font-medium"
        htmlFor="explanation-text"
      >
        用文字表达
      </label>
      <textarea
        id="explanation-text"
        value={response.text}
        maxLength={10000}
        disabled={uploading}
        rows={5}
        placeholder="也可以直接在这里写下你的想法…"
        onChange={(e) =>
          onChange({
            ...latest.current,
            text: e.target.value,
            effectiveCharCount: countEffectiveCharacters(e.target.value),
          })
        }
        className="study-control mt-3 w-full rounded-lg border border-neutral-300 p-3"
      />
      <p className="study-meta mt-2 text-neutral-600" role="status">
        已填写{count}个有效字符
        {count >= 20 ? "，已达到最低字数" : "，至少需要20个"}
        （汉字、字母和数字计入，空格与标点不计入）
      </p>
    </PostTaskFrame>
  );
}
