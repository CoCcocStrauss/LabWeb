"use client";

import dynamic from "next/dynamic";
import { PageLoading as LoadingScreen } from "./components/PageLoading";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { ErrorPage } from "./components/ErrorPage";
import { PretestSync } from "./components/PretestSync";
import { emptyResponse } from "./data/questionnaire";
import { isTopicKey } from "./data/topics";
import { blockRandomize } from "./lib/blockRandomize";
import { assignCondition, type ConditionN } from "./lib/conditionAssignment";
import { enrichPostsForDisplay } from "./lib/enrichPosts";
import {
  createSession,
  loadSession,
  saveSession,
  storageKey,
  LegacySessionError,
  V2SessionError,
  READING_DURATION_MS,
  type ExperimentSession,
  type ReadingEndData,
  type ReadingSnapshot,
} from "./lib/experimentSession";
import { createRecognition, newExplanation, newReasons } from "./lib/posttest";
import {
  newReadingMetrics,
  newRules,
  type MicrophonePermission,
} from "./lib/readingProtocol";
import { getMaterialsForTopic } from "./lib/materialsRegistry";

const TutorialPage = dynamic(
  () => import("./components/TutorialPage").then((m) => m.TutorialPage),
  { ssr: false, loading: LoadingScreen },
);
const ExperimentPage = dynamic(
  () => import("./components/ExperimentPage").then((m) => m.ExperimentPage),
  { ssr: false, loading: LoadingScreen },
);
const EndPage = dynamic(
  () => import("./components/EndPage").then((m) => m.EndPage),
  { ssr: false, loading: LoadingScreen },
);
const CompletePage = dynamic(
  () => import("./components/EndPage").then((m) => m.CompletePage),
  { ssr: false, loading: LoadingScreen },
);
const QuestionnairePage = dynamic(
  () =>
    import("./components/QuestionnairePage").then((m) => m.QuestionnairePage),
  { ssr: false, loading: LoadingScreen },
);
const ComprehensionPage = dynamic(
  () =>
    import("./components/ComprehensionPage").then((m) => m.ComprehensionPage),
  { ssr: false, loading: LoadingScreen },
);
const ReadyPage = dynamic(
  () => import("./components/ReadyPage").then((m) => m.ReadyPage),
  { ssr: false, loading: LoadingScreen },
);
const RecognitionPage = dynamic(
  () => import("./components/RecognitionPage").then((m) => m.RecognitionPage),
  { ssr: false, loading: LoadingScreen },
);
const ExplanationPage = dynamic(
  () => import("./components/ExplanationPage").then((m) => m.ExplanationPage),
  { ssr: false, loading: LoadingScreen },
);
const ReasonsPage = dynamic(
  () => import("./components/ReasonsPage").then((m) => m.ReasonsPage),
  { ssr: false, loading: LoadingScreen },
);
const V5Home = dynamic(() => import("./protocol/v5/Flow"), { ssr: false, loading: LoadingScreen });
const V4Home = dynamic(() => import("./protocol/v4/Flow"), { ssr: false, loading: LoadingScreen });
const V2Home = dynamic(() => import("./compat/v2/Flow"), { ssr: false, loading: LoadingScreen });
const LegacyHome = dynamic(() => import("./legacy/LegacyFlow"), { ssr: false, loading: LoadingScreen });

function sanitizeReturnUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseParams(searchParams: URLSearchParams) {
  const uid = searchParams.get("uid")?.trim();
  if (!uid || uid.length > 200) return null;
  const n = searchParams.get("n");
  const topic = searchParams.get("topic")?.trim();
  const manual = n !== null || topic !== undefined;
  if (
    manual &&
    (![8, 16, 24, 48].includes(Number(n)) || !topic || !isTopicKey(topic))
  )
    return null;
  const assigned = manual
    ? {
        conditionN: Number(n) as ConditionN,
        topic: topic! as "ai" | "fertility",
      }
    : assignCondition(uid);
  return {
    uid,
    ...assigned,
    returnUrl: sanitizeReturnUrl(searchParams.get("returnUrl")),
    manual,
  };
}


function SessionFlow({
  params,
}: {
  params: NonNullable<ReturnType<typeof parseParams>>;
}) {
  const [session, setSession] = useState<ExperimentSession | null>(null);
  const sessionRef = useRef<ExperimentSession | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [legacy, setLegacy] = useState(false);
  const [v2, setV2] = useState(false);
  const [v4, setV4] = useState(false);
  const [v5, setV5] = useState(false);

  useEffect(() => {
    try {
      if (
        localStorage.getItem(
          `labweb:session:v5:${encodeURIComponent(params.uid)}`,
        ) !== null
      ) {
        setV5(true);
        return;
      }
      if (
        localStorage.getItem(
          `labweb:session:v4:${encodeURIComponent(params.uid)}`,
        ) !== null
      ) {
        setV4(true);
        return;
      }
      const existing = loadSession(params.uid);
      if (!existing) {
        setV5(true);
        return;
      }
      if (
        existing &&
        params.manual &&
        (existing.conditionN !== params.conditionN ||
          existing.topicKey !== params.topic)
      ) {
        throw new Error(
          "此链接的分组与已保存的进度不一致。请使用原链接继续，或联系实验员。",
        );
      }
      const initial = existing ?? createSession(params);
      const navigation = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (
        existing &&
        navigation?.type === "reload" &&
        !["entry", "submitting", "complete"].includes(initial.phase)
      )
        initial.interruptions.push({
          phase: initial.phase,
          type: "reload",
          timestamp: Date.now(),
        });
      if (
        initial.phase === "pretest_save" &&
        initial.rules.startedAt < initial.pretest.completedAt!
      )
        initial.rules = newRules(Date.now(), initial.rules.demoLabelSelections);
      saveSession(initial);
      sessionRef.current = initial;
      setSession(initial);
    } catch (error) {
      if (error instanceof V2SessionError) {
        setV2(true);
        return;
      }
      if (error instanceof LegacySessionError) {
        setLegacy(true);
        return;
      }
      setFatalError(
        error instanceof Error && /进度|原链接/.test(error.message)
          ? error.message
          : "无法保存或读取实验进度。请允许此页面使用浏览器存储后刷新重试，或联系实验员。",
      );
    }
  }, [params]);

  // 先持久化再推进，避免刷新与失败重试丢失答案或生成新一轮阅读。
  const update = useCallback(
    (change: (previous: ExperimentSession) => ExperimentSession) => {
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
        setStorageError(
          "暂时无法保存浏览器进度。请保留此页、检查存储空间后重试，或联系实验员。",
        );
        return false;
      }
    },
    [],
  );

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey(params.uid)) {
        setFatalError(
          "检测到此实验在另一个页面继续。请只保留一个实验页面，并在该页面完成作答。",
        );
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [params.uid]);

  useEffect(() => {
    const onVisibility = () => {
      if (
        sessionRef.current &&
        !["entry", "submitting", "complete"].includes(sessionRef.current.phase)
      )
        update((s) => ({
          ...s,
          interruptions: [
            ...s.interruptions,
            {
              phase: s.phase,
              type:
                document.visibilityState === "hidden" ? "hidden" : "visible",
              timestamp: Date.now(),
            },
          ],
        }));
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [update]);

  const handleSnapshot = useCallback(
    (reading: ReadingSnapshot) => {
      update((s) => (s.phase === "experiment" ? { ...s, reading } : s));
    },
    [update],
  );
  const handleReadingEnd = useCallback(
    (endData: ReadingEndData) => {
      return update((s) => {
        const recognition = createRecognition(
          s.reading!.posts,
          endData.actions,
        );
        return {
          ...s,
          endData,
          recognition,
          posttest:
            recognition.status === "not_applicable"
              ? emptyResponse("posttest")
              : null,
          phase:
            recognition.status === "not_applicable"
              ? "posttest"
              : "recognition",
        };
      });
    },
    [update],
  );

  if (v5) return <V5Home />;
  if (v4) return <V4Home />;
  if (v2)
    return (
      <div className="old-protocol">
        <V2Home />
      </div>
    );
  if (legacy)
    return (
      <div className="old-protocol">
        <LegacyHome />
      </div>
    );
  if (fatalError)
    return (
      <main className="study-shell study-page flex items-center" role="alert">
        {fatalError}
      </main>
    );
  if (!session) return <LoadingScreen />;
  let content;
  switch (session.phase) {
    case "entry":
      content = (
        <main className="study-shell study-page flex flex-col items-center justify-center text-center">
          <h1 className="study-title">进入实验</h1>
          <p className="study-copy mt-4">
            后续解释可以使用录音或文字。进入时会检查麦克风许可，不会开始录音；未授权也可以继续。
          </p>
          <button
            type="button"
            className="study-control mt-6 rounded-full bg-[#0084ff] px-8 py-3 text-white"
            onClick={() => {
              const requestedAt = Date.now();
              const available =
                window.isSecureContext &&
                !!navigator.mediaDevices?.getUserMedia;
              update((s) => ({
                ...s,
                phase: "pretest",
                pretest: emptyResponse("pretest"),
                microphonePermission: {
                  state: available ? "checking" : "unavailable",
                  requestedAt,
                  completedAt: available ? null : requestedAt,
                },
              }));
              if (available)
                void navigator.mediaDevices
                  .getUserMedia({ audio: true })
                  .then((stream) => {
                    stream.getTracks().forEach((track) => track.stop());
                    update((s) =>
                      ["submitting", "complete"].includes(s.phase)
                        ? s
                        : {
                            ...s,
                            microphonePermission: {
                              state: "granted",
                              requestedAt,
                              completedAt: Date.now(),
                            },
                          },
                    );
                  })
                  .catch((error) => {
                    const state: MicrophonePermission["state"] =
                      error instanceof DOMException &&
                      error.name === "NotAllowedError"
                        ? "denied"
                        : "error";
                    update((s) =>
                      ["submitting", "complete"].includes(s.phase)
                        ? s
                        : {
                            ...s,
                            microphonePermission: {
                              state,
                              requestedAt,
                              completedAt: Date.now(),
                            },
                          },
                    );
                  });
            }}
          >
            进入实验
          </button>
        </main>
      );
      break;
    case "pretest":
      content = (
        <QuestionnairePage
          topic={session.topicKey}
          stage="pretest"
          response={session.pretest}
          onAnswer={(pretest, done) =>
            update((s) => ({
              ...s,
              pretest,
              rules: done
                ? newRules(Date.now(), s.rules.demoLabelSelections)
                : s.rules,
              phase: done ? "pretest_save" : "pretest",
            }))
          }
        />
      );
      break;
    case "pretest_save":
    case "tutorial":
      content = (
        <TutorialPage
          canContinue={session.phase === "tutorial"}
          saveStatus={
            session.phase === "pretest_save" ? (
              <PretestSync
                input={{
                  uid: session.uid,
                  sessionId: session.sessionId,
                  sessionSecret: session.sessionSecret,
                  conditionN: session.conditionN,
                  topicKey: session.topicKey,
                  questionnaireVersion: session.questionnaireVersion,
                  pretest: session.pretest,
                  microphonePermission: session.microphonePermission,
                }}
                onSaved={() => update((s) => ({ ...s, phase: "tutorial" }))}
              />
            ) : null
          }
          response={session.rules}
          onChange={(rules) => update((s) => ({ ...s, rules }))}
          onStart={() =>
            update((s) => ({
              ...s,
              rules: { ...s.rules, completedAt: Date.now() },
              phase: "comprehension",
            }))
          }
        />
      );
      break;
    case "comprehension":
      content = (
        <ComprehensionPage
          attempts={session.comprehension}
          onAttempt={(attempt) =>
            update((s) => ({ ...s, comprehension: [attempt] }))
          }
          onContinue={() => update((s) => ({ ...s, phase: "ready" }))}
        />
      );
      break;
    case "ready":
      content = (
        <ReadyPage
          onStart={() => {
            const materials = getMaterialsForTopic(session.topicKey);
            const posts = enrichPostsForDisplay(
              blockRandomize(materials.materials, session.conditionN),
              session.topicKey,
            );
            const now = Date.now();
            update((s) => ({
              ...s,
              phase: "experiment",
              reading: {
                posts,
                startTime: now,
                deadline: now + READING_DURATION_MS,
                savedAt: now,
                metrics: newReadingMetrics(posts),
                actions: [],
                scrollEvents: [],
                postVisibilitySummary: {},
                maxScrollY: 0,
                scrollY: 0,
                userPostDraft: "",
                ownPost: null,
                insertBeforePostId: null,
              },
            }));
          }}
        />
      );
      break;
    case "experiment":
      content = (
        <ExperimentPage
          uid={session.uid}
          conditionN={session.conditionN}
          topic={session.topicKey}
          initialReading={session.reading!}
          onSnapshot={handleSnapshot}
          onEnd={handleReadingEnd}
        />
      );
      break;
    case "recognition":
      content = (
        <RecognitionPage
          response={session.recognition!}
          onPresent={(time) =>
            update((s) => ({
              ...s,
              recognition: {
                ...s.recognition!,
                presentedAt: s.recognition!.presentedAt ?? time,
              },
            }))
          }
          onAnswer={(recognition) =>
            update((s) => ({
              ...s,
              recognition,
              posttest: emptyResponse("posttest"),
              phase: "posttest",
            }))
          }
        />
      );
      break;
    case "posttest":
      content = (
        <QuestionnairePage
          key="posttest"
          topic={session.topicKey}
          stage="posttest"
          response={session.posttest!}
          stopAfter={2}
          onAnswer={(posttest, done) =>
            update((s) => ({
              ...s,
              posttest,
              explanation: done ? newExplanation() : s.explanation,
              phase: done ? "explanation" : "posttest",
            }))
          }
        />
      );
      break;
    case "explanation":
      content = (
        <ExplanationPage
          topic={session.topicKey}
          identity={session}
          response={session.explanation!}
          onChange={(explanation) => update((s) => ({ ...s, explanation }))}
          onContinue={(explanation) =>
            update((s) => ({
              ...s,
              explanation,
              reasons: s.reasons ?? newReasons(s.topicKey),
              phase: "reasons",
            }))
          }
        />
      );
      break;
    case "reasons":
      content = (
        <ReasonsPage
          topic={session.topicKey}
          response={session.reasons!}
          onChange={(reasons) => update((s) => ({ ...s, reasons }))}
          onContinue={(reasons) =>
            update((s) => ({ ...s, reasons, phase: "post_museum" }))
          }
        />
      );
      break;
    case "post_museum":
      content = (
        <QuestionnairePage
          key="post_museum"
          topic={session.topicKey}
          stage="posttest"
          response={session.posttest!}
          onAnswer={(posttest) =>
            update((s) => ({ ...s, posttest, phase: "submitting" }))
          }
        />
      );
      break;
    case "submitting":
      content = (
        <EndPage
          session={session}
          onSaved={(completionCode) =>
            update((s) => ({
              ...s,
              phase: "complete",
              completionCode: completionCode ?? null,
            }))
          }
        />
      );
      break;
    case "complete":
      content = (
        <CompletePage returnUrl={sanitizeReturnUrl(session.returnUrl)} />
      );
  }
  return (
    <div className="current-protocol">
      {content}
      {storageError ? (
        <div
          role="alert"
          className="study-copy fixed inset-x-0 top-0 z-[100] bg-red-50 p-4 text-center text-red-800"
        >
          {storageError}
        </div>
      ) : null}
    </div>
  );
}

function ExperimentFlow() {
  const searchParams = useSearchParams();
  const params = useMemo(() => parseParams(searchParams), [searchParams]);
  return params ? (
    <SessionFlow key={params.uid} params={params} />
  ) : (
    <ErrorPage />
  );
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ExperimentFlow />
    </Suspense>
  );
}
