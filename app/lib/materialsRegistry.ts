import type { TopicKey } from "../data/topics";
import type { MaterialsByCell } from "./blockRandomize";

import fertilityRaw from "../data/materials/fertility.json";
import aiRaw from "../data/materials/ai.json";
import eldercareRaw from "../data/materials/eldercare.json";

export type MaterialsFile = {
  topic: string;
  topicDescription: string;
  tags: string[];
  materials: MaterialsByCell;
};

const MATERIALS_BY_TOPIC: Record<TopicKey, MaterialsFile> = {
  fertility: fertilityRaw as MaterialsFile,
  ai: aiRaw as MaterialsFile,
  eldercare: eldercareRaw as MaterialsFile,
};

/** 按议题取出对应的材料文件（topic/topicDescription/tags/materials）。 */
export function getMaterialsForTopic(topic: TopicKey): MaterialsFile {
  return MATERIALS_BY_TOPIC[topic];
}
