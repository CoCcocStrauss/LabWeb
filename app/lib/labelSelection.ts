export const LABEL_SELECTION_VERSION = "one-source-label-50-50-v1";
export type DisplayedLabelSelection = {
  labelSelectionVersion: typeof LABEL_SELECTION_VERSION;
  displayedLabelType: "identity" | "platform" | null;
  displayedLabelText: string | null;
};
type LabelSource = {
  sourceLevel: string;
  identityLabel?: string | null;
  platformLabel?: string | null;
};
/** Draw once during session construction; rendering and restoration never call this. */
export function chooseDisplayedLabel(
  post: LabelSource,
  random: () => number = Math.random,
): DisplayedLabelSelection {
  const identity = post.identityLabel?.trim() || null,
    platform = post.platformLabel?.trim() || null;
  let type: DisplayedLabelSelection["displayedLabelType"] = null;
  if (post.sourceLevel === "high")
    type =
      identity && platform
        ? random() < 0.5
          ? "identity"
          : "platform"
        : identity
          ? "identity"
          : platform
            ? "platform"
            : null;
  return {
    labelSelectionVersion: LABEL_SELECTION_VERSION,
    displayedLabelType: type,
    displayedLabelText:
      type === "identity" ? identity : type === "platform" ? platform : null,
  };
}
export function validDisplayedLabel(
  post: LabelSource,
  selection: Partial<DisplayedLabelSelection>,
): boolean {
  if (selection.labelSelectionVersion !== LABEL_SELECTION_VERSION) return false;
  if (post.sourceLevel !== "high")
    return (
      selection.displayedLabelType === null &&
      selection.displayedLabelText === null
    );
  const type = selection.displayedLabelType;
  if (type !== "identity" && type !== "platform") return false;
  const expected = (
    type === "identity" ? post.identityLabel : post.platformLabel
  )?.trim();
  return !!expected && selection.displayedLabelText === expected;
}
export function storedLabelSelection(
  post: Partial<DisplayedLabelSelection>,
): Partial<DisplayedLabelSelection> {
  return post.labelSelectionVersion === LABEL_SELECTION_VERSION
    ? {
        labelSelectionVersion: post.labelSelectionVersion,
        displayedLabelType: post.displayedLabelType,
        displayedLabelText: post.displayedLabelText,
      }
    : {};
}
