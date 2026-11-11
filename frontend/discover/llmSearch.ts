import type { Tool } from "@shared/catalog";
import type { RankedTool } from "./rank";

type SearchMatch = {
  id: string;
  score: number;
  reason: string;
};

type SearchResponse = {
  message: string;
  matches: SearchMatch[];
};

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type ChatReply = {
  message: string;
  matches: RankedTool[];
};

export async function searchChat(messages: ChatTurn[], catalog: Tool[]): Promise<ChatReply> {
  const response = await fetch("/api/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: messages.slice(-10),
      tools: catalog.map((tool) => ({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        tags: tool.tags,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error("LLM search failed.");
  }

  const data = (await response.json()) as SearchResponse;
  const message = typeof data.message === "string" ? data.message.trim() : "";
  if (!message) throw new Error("LLM search failed.");

  const matches = (Array.isArray(data.matches) ? data.matches : [])
    .map((match) => {
      const tool = catalog.find((item) => item.id === match.id);
      if (!tool) return null;
      return {
        tool,
        score: match.score,
        reason: match.reason,
      };
    })
    .filter((item): item is RankedTool => item !== null);

  return { message, matches };
}
