const PALETTE = [
  "#4FC3F7",
  "#81C784",
  "#FFB74D",
  "#BA68C8",
  "#F06292",
  "#FFD54F",
  "#4DB6AC",
  "#9575CD",
  "#E57373",
  "#AED581",
  "#64B5F6",
  "#FF8A65",
  "#7986CB",
  "#A1887F",
  "#90A4AE",
  "#DCE775",
];

export const DEFAULT_GROUP_COLOR = "#8A93A3";
export const HIGHLIGHT_COLOR = "#FFFFFF";

export function buildGroupColorMap(groups: string[]): Record<string, string> {
  const unique = Array.from(new Set(groups)).sort((a, b) => a.localeCompare(b));
  const map: Record<string, string> = {};
  unique.forEach((group, index) => {
    map[group] = PALETTE[index % PALETTE.length];
  });
  return map;
}

export function colorForGroup(
  map: Record<string, string>,
  group: string,
): string {
  return map[group] ?? DEFAULT_GROUP_COLOR;
}
