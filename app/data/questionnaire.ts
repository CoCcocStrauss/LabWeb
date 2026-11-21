import type { TopicKey } from "./topics";

export const QUESTIONNAIRE_VERSION = "2026-11-21-v3";
export type QuestionnaireStage = "pretest" | "posttest";
export type Question = {
  id: string;
  text: string;
  options: readonly string[];
  statement?: string;
  context?: "scenario" | "statement" | "none";
};
export type Answer = {
  questionId: string;
  value: number;
  startedAt: number;
  answeredAt: number;
};
export type QuestionnaireResponse = {
  stage: QuestionnaireStage;
  startedAt: number;
  completedAt: number | null;
  answers: Answer[];
};
export type ComprehensionAttempt = {
  value: number;
  correct: boolean;
  timestamp: number;
  feedbackPresentedAt?: number;
  feedbackVisibleMs?: number;
  autoAdvancedAt?: number | null;
};

const change = ["明显减少", "有所减少", "总体变化不大", "有所增加", "明显增加"];
const confidence: Question = {
  id: "confidence",
  text: "整体而言，你对刚才这些判断有多大把握？",
  options: ["完全没有把握", "不太有把握", "一般", "比较有把握", "非常有把握"],
};

export const MUSEUM_VALUE_MAP = {
  1: "agree",
  2: "neutral",
  3: "disagree",
} as const;

export const MUSEUM_QUESTION: Question = {
  id: "museum_photo_three",
  text: "你是否支持博物馆允许观众在不使用闪光灯的情况下拍照？",
  options: ["认同", "中立", "不认同"],
  context: "none",
};

export const QUESTIONNAIRES: Record<
  TopicKey,
  { scenario: string; questions: readonly Question[]; statement: string }
> = {
  ai: {
    scenario:
      "设想未来几年，以 AI 为代表的新工具逐渐进入更多工作场景，各行各业的工作方式也在发生变化。",
    questions: [
      {
        id: "job_opportunities",
        text: "在这样的情况下，普通人可以获得的工作机会会怎样变化？",
        options: change,
      },
      {
        id: "employee_demand",
        text: "你预计，企业对员工的总体需求会怎样变化？",
        options: change,
      },
      {
        id: "job_search",
        text: "对于正在找工作或准备换工作的人，找到工作的难易程度会怎样变化？",
        options: [
          "明显更难",
          "有所变难",
          "总体变化不大",
          "有所变容易",
          "明显更容易",
        ],
      },
      confidence,
    ],
    statement: "未来几年，AI 的发展总体上会让普通人可以获得的工作机会增加。",
  },
  fertility: {
    scenario:
      "设想政府准备向有孩子的家庭定期发放一笔育儿补贴。一些家庭正在考虑要不要孩子，也有一些家庭正在考虑要不要再生一个。",
    questions: [
      {
        id: "fertility_effect",
        text: "这类补贴会在多大程度上让更多家庭决定生育？",
        options: [
          "完全没有作用",
          "作用较小",
          "作用一般",
          "作用较大",
          "作用很大",
        ],
      },
      {
        id: "family_decision",
        text: "对于原本还在犹豫的家庭，你觉得这类补贴有多大可能让他们最终决定生育？",
        options: [
          "几乎不可能",
          "不太可能",
          "可能性一般",
          "比较可能",
          "非常可能",
        ],
      },
      {
        id: "additional_births",
        text: "如果过几年再来看，你预计，这类补贴带来的新增生育会有多少？",
        options: ["几乎没有", "比较少", "一般", "比较多", "非常多"],
      },
      confidence,
    ],
    statement:
      "如果每个孩子从出生起每月领取 2000 元育儿补贴、直到 18 岁，中国的生育率会因此明显提升。",
  },
};

export function getQuestions(
  topic: TopicKey,
  stage: QuestionnaireStage,
): readonly Question[] {
  const config = QUESTIONNAIRES[topic];
  return stage === "pretest"
    ? [...config.questions, MUSEUM_QUESTION]
    : [
        {
          id: "direct_attitude",
          text: "对于下面的说法，你有多认同？",
          statement: config.statement,
          options: [
            "非常不认同",
            "比较不认同",
            "既不认同也不反对",
            "比较认同",
            "非常认同",
          ],
          context: "statement",
        },
        {
          ...confidence,
          id: "post_confidence",
          text: "你对刚才的判断有多大把握？",
          context: "statement",
        },
        MUSEUM_QUESTION,
      ];
}

export function emptyResponse(
  stage: QuestionnaireStage,
  now = Date.now(),
): QuestionnaireResponse {
  return { stage, startedAt: now, completedAt: null, answers: [] };
}

export const COMPREHENSION_QUESTION = "本次阅读任务需要你做什么？";
export const COMPREHENSION_OPTIONS = [
  "转发你最认同的两条内容，才算完成本次阅读任务。",
  "给任意两条内容点赞。",
  "只浏览内容，不需要作出选择。",
];
