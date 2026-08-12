export type Quality = "high" | "low";
export type SourceLevel = "high" | "low";
export type Stance = "support" | "oppose";

export type PostItem = {
  id: string;
  content: string;
  quality: Quality;
  sourceLevel: SourceLevel;
  stance: Stance;
  /** 高信源专用：现实职业身份；低信源为 null */
  identityLabel?: string | null;
  /** 高信源专用：平台身份/影响力；低信源为 null */
  platformLabel?: string | null;
};

export type MaterialsByCell = Record<string, PostItem[]>;

const CELL_KEYS = [
  "support_high_high",
  "support_high_low",
  "support_low_high",
  "support_low_low",
  "oppose_high_high",
  "oppose_high_low",
  "oppose_low_high",
  "oppose_low_low",
] as const;

/** Fisher–Yates shuffle (mutates array). */
export function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * 分块随机化：每 block 从 8 个 cell 各抽 1 条（跨 block 不重复），
 * block 间顺序随机，block 内 8 条顺序随机。
 */
export function blockRandomize(
  materials: MaterialsByCell,
  n: number
): PostItem[] {
  const numBlocks = n / 8;
  if (!Number.isInteger(numBlocks) || numBlocks < 1) {
    throw new Error(`n must be a positive multiple of 8, got ${n}`);
  }

  const blocks: PostItem[][] = [];

  for (let b = 0; b < numBlocks; b++) {
    const block: PostItem[] = [];
    const usedIds = new Set(blocks.flat().map((p) => p.id));

    for (const cell of CELL_KEYS) {
      const pool = materials[cell];
      if (!pool?.length) {
        throw new Error(`Missing or empty cell: ${cell}`);
      }
      const available = pool.filter((p) => !usedIds.has(p.id));
      if (available.length === 0) {
        throw new Error(
          `Cell ${cell} has no unused posts for block ${b + 1} (n=${n})`
        );
      }
      const pick = available[Math.floor(Math.random() * available.length)]!;
      block.push(pick);
      usedIds.add(pick.id);
    }

    shuffleArray(block);
    blocks.push(block);
  }

  shuffleArray(blocks);
  return blocks.flat();
}
