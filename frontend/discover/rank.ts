import type { Tool } from "@shared/catalog";

const STOP = new Set([
  "the",
  "this",
  "with",
  "and",
  "what",
  "show",
  "from",
  "that",
  "week",
  "last",
  "want",
  "into",
]);

const TOP_K = 5;

export type RankedTool = {
  tool: Tool;
  score: number;
  reason: string;
};

export function rankTools(query: string, catalog: Tool[]): RankedTool[] {
  const stems = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(stem)
    .filter((word) => word.length > 2 && !STOP.has(word));

  return catalog
    .map((tool) => scoreTool(tool, stems))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.tool.runs - a.tool.runs)
    .slice(0, TOP_K)
    .map((item, index) => ({
      ...item,
      reason: index === 0 ? "Best ranked for your use case" : "Similar",
    }));
}

function scoreTool(tool: Tool, stems: string[]) {
  const name = tokens(tool.name);
  const tags = new Set(tool.tags.map(stem));
  const description = tokens(tool.description);
  let score = 0;
  for (const word of stems) {
    if (name.has(word)) score += 5;
    if (tags.has(word)) score += 3;
    if (description.has(word)) score += 1;
  }
  return { tool, score, reason: "" };
}

function tokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map(stem)
      .filter((word) => word.length > 2),
  );
}

function stem(word: string) {
  if (word.startsWith("compar")) return "compar";
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}
