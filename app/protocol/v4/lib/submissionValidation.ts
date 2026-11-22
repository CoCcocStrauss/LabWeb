import {
  validQuestionnaire as sharedQuestionnaire,
  validSubmissionWith,
} from "../../../lib/submissionValidation";
import { secretIsValid, validPostTasks } from "../../../lib/posttestValidation";
import { validPermission } from "../../../lib/readingValidation";
import {
  getQuestions,
  QUESTIONNAIRE_VERSION,
  type QuestionnaireResponse,
  type QuestionnaireStage,
} from "../data/questionnaire";
import { isTopicKey, type TopicKey } from "../../../data/topics";
import type {
  PretestInput,
  SubmitExperimentDataInput,
} from "../../../lib/dataSubmit";
import { validReasonResponse } from "./reasons";
import { validInteractionComparison } from "./interactionComparison";
export function validQuestionnaire(
  value: unknown,
  topic: TopicKey,
  stage: QuestionnaireStage,
): value is QuestionnaireResponse {
  return sharedQuestionnaire(value, topic, stage, getQuestions);
}
export function validPretest(value: unknown): value is PretestInput {
  if (!value || typeof value !== "object") return false;
  const b = value as PretestInput;
  return (
    typeof b.uid === "string" &&
    b.uid.trim() === b.uid &&
    b.uid.length > 0 &&
    b.uid.length <= 200 &&
    typeof b.sessionId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      b.sessionId,
    ) &&
    secretIsValid(b.sessionSecret) &&
    [8, 16, 48].includes(b.conditionN) &&
    isTopicKey(b.topicKey) &&
    b.questionnaireVersion === QUESTIONNAIRE_VERSION &&
    validPermission(b.microphonePermission) &&
    validQuestionnaire(b.pretest, b.topicKey, "pretest") &&
    validReasonResponse(
      b.preReasons,
      b.topicKey,
      "pretest",
      true,
      b.pretest.answers[3].answeredAt,
      b.pretest.answers[4].startedAt,
    )
  );
}
export function validSubmission(
  value: unknown,
): value is SubmitExperimentDataInput {
  return validSubmissionWith(
    value,
    validPretest,
    validQuestionnaire,
    (raw, posts) =>
      validPostTasks(raw, posts, (b) => {
        return (
          b.reasons === null &&
          validReasonResponse(
            b.postReasons,
            b.topicKey,
            "posttest",
            true,
            b.explanation.completedAt!,
            b.posttest.answers[2].startedAt,
            b.preReasons,
          ) &&
          validInteractionComparison(
            b.interactionComparison,
            b,
            posts,
            b.recognition.answeredAt ?? b.recognition.generatedAt,
            b.posttest.startedAt,
          )
        );
      }),
  );
}
