const TINTS = [
  { bg: "#e7e9f5", fg: "#3d478c" },
  { bg: "#f7e7e2", fg: "#a34b32" },
  { bg: "#e5efe1", fg: "#3d6a43" },
  { bg: "#f3ecd9", fg: "#7a5a1e" },
  { bg: "#e8e7f0", fg: "#544986" },
  { bg: "#e2eef0", fg: "#2f636b" },
  { bg: "#f2e6ea", fg: "#8d3c57" },
];

export function monogramTint(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return TINTS[hash % TINTS.length];
}
