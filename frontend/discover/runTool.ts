import type { Tool } from "@shared/catalog";

export type RunOutput = {
  name: string;
  label: string;
  type: string;
  summary?: Record<string, number>;
  table?: { columns: string[]; rows: Record<string, unknown>[] };
  json?: unknown;
  text?: string;
  base64?: string;
  filename?: string;
};

export type RunCompute = {
  seconds: number;
  vcpu: number;
  memoryGb: number;
};

export type RunResult = {
  outputs: RunOutput[];
  compute?: RunCompute;
};

export type PreparedInput = {
  name: string;
  text?: string;
  base64?: string;
};

export async function runTool(
  tool: Tool,
  inputs: PreparedInput[],
  onLine: (line: string) => void,
) {
  if (!tool.repoUrl) throw new Error("This tool has no GitHub repo to build.");

  let response: Response;
  try {
    response = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrl: tool.repoUrl, inputs }),
    });
  } catch {
    throw new Error("The runtime is not running. Start it from the runtime folder.");
  }

  if (!response.ok || !response.body) {
    throw new Error("The runtime rejected the run.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: RunResult | null = null;

  while (true) {
    const chunk = await reader.read();
    buffer += decoder.decode(chunk.value || new Uint8Array(), { stream: !chunk.done });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as {
        line?: string;
        message?: string;
        error?: string;
        result?: RunResult;
      };
      if (event.line) onLine(event.line);
      if (event.message) onLine(event.message);
      if (event.error) {
        onLine(event.error);
        throw new Error(event.error);
      }
      if (event.result) result = event.result;
    }
    if (chunk.done) break;
  }

  if (!result) throw new Error("The run finished without a result.");
  return result;
}

export function fileToBase64(file: File) {
  return file.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const step = 0x8000;
    for (let index = 0; index < bytes.length; index += step) {
      binary += String.fromCharCode(...bytes.subarray(index, index + step));
    }
    return btoa(binary);
  });
}
