import { assignCondition as oldAssign } from "../../../lib/conditionAssignment";
export const CONDITION_N_VALUES = [8, 24, 48] as const;
export type ConditionN = (typeof CONDITION_N_VALUES)[number];
export function assignCondition(uid: string) {
  const s = oldAssign(uid);
  return {
    ...s,
    conditionN: (s.conditionN === 16 ? 24 : s.conditionN) as ConditionN,
  };
}
