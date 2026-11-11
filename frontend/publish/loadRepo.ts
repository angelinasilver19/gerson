import { parse } from "yaml";
import {
  getCatalog,
  type FieldType,
  type OutputType,
  type Tool,
  type ToolInput,
  type ToolOutput,
} from "@shared/catalog";

const FIELD_TYPES = new Set<FieldType>(["file", "text", "number", "json"]);
const OUTPUT_TYPES = new Set<OutputType>(["table", "file", "text", "json"]);

export type LoadedRepo = {
  owner: string;
  repo: string;
  branch: string;
  repoUrl: string;
  raw: string;
  tool: Tool;
};

export function parseGitHubUrl(input: string) {
  const trimmed = input.trim().replace(/\.git$/, "");
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return null;
  }
  if (url.hostname !== "github.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const [owner, repo, kind, ref] = parts;
  if (!owner || !repo) return null;
  return { owner, repo, ref: kind === "tree" ? ref : undefined };
}

export async function loadRepo(input: string): Promise<LoadedRepo> {
  const parsed = parseGitHubUrl(input);
  if (!parsed) {
    throw new Error("Paste a GitHub link, like https://github.com/owner/repo.");
  }

  const meta = await githubJson(`/repos/${parsed.owner}/${parsed.repo}`);
  if (!meta) {
    throw new Error(`GitHub could not find ${parsed.owner}/${parsed.repo}.`);
  }
  const branch =
    parsed.ref || (typeof meta.default_branch === "string" ? meta.default_branch : "main");

  const raw = await readToolFile(parsed.owner, parsed.repo, branch);
  const tool = toolFromYaml(raw, {
    id: parsed.repo,
    repoUrl: `https://github.com/${parsed.owner}/${parsed.repo}`,
  });

  return {
    owner: parsed.owner,
    repo: parsed.repo,
    branch,
    repoUrl: `https://github.com/${parsed.owner}/${parsed.repo}`,
    raw,
    tool,
  };
}

export function findSimilar(tool: Tool) {
  const words = wordsOf(tool);
  let best: { tool: Tool; score: number } | null = null;
  for (const other of getCatalog()) {
    if (other.id === tool.id || other.repoUrl === tool.repoUrl) continue;
    const otherWords = wordsOf(other);
    let score = 0;
    for (const word of words) if (otherWords.has(word)) score += 1;
    if (!best || score > best.score) best = { tool: other, score };
  }
  return best && best.score >= 2 ? best.tool : null;
}

async function readToolFile(owner: string, repo: string, branch: string) {
  for (const name of ["tool.yaml", "tool.yml"]) {
    const text = await githubRaw(`/repos/${owner}/${repo}/contents/${name}?ref=${branch}`);
    if (text) return text;
  }
  throw new Error("This repo has no tool.yaml at the root.");
}

function toolFromYaml(raw: string, identity: { id: string; repoUrl: string }): Tool {
  let document: unknown;
  try {
    document = parse(raw);
  } catch {
    throw new Error("tool.yaml is not valid YAML.");
  }
  const record = asRecord(document);
  if (!record) throw new Error("tool.yaml must be a mapping of fields.");

  const name = readString(record.name);
  const description = readString(record.description);
  const missing = [
    !name ? "name" : "",
    !description ? "description" : "",
  ].filter(Boolean);
  const run = asRecord(record.run);
  const command = readString(run?.command);
  const dockerfile = readString(run?.dockerfile);
  if (!command && !dockerfile) missing.push("run.command or run.dockerfile");

  const inputs = readInputs(record.inputs);
  const outputs = readOutputs(record.outputs);
  if (inputs.length === 0) missing.push("inputs");
  if (outputs.length === 0) missing.push("outputs");
  if (missing.length > 0) {
    throw new Error(`tool.yaml is missing ${missing.join(", ")}.`);
  }

  const tags = Array.isArray(record.tags)
    ? record.tags.filter((tag): tag is string => typeof tag === "string")
    : [];

  return {
    id: identity.id,
    name: name!,
    description: description!,
    tags,
    owner: readString(record.owner) || "unknown",
    language: languageFrom(command, dockerfile),
    sharedWith: sharingLabel(readString(record.sharing)),
    runs: 0,
    status: "Live",
    version: readString(record.version) || "0.0.0",
    repoUrl: identity.repoUrl,
    inputs,
    outputs,
  };
}

function readInputs(value: unknown): ToolInput[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = asRecord(item);
    if (!record) return [];
    const name = readString(record.name);
    if (!name) return [];
    const type = readFieldType(record.type);
    const description = readString(record.description);
    const bind = asRecord(record.bind);
    return [
      {
        name,
        type,
        description,
        label: readString(record.label) || description || name,
        bindPath: readString(bind?.path),
      },
    ];
  });
}

function readOutputs(value: unknown): ToolOutput[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = asRecord(item);
    if (!record) return [];
    const name = readString(record.name);
    if (!name) return [];
    const type = readOutputType(record.type);
    const description = readString(record.description);
    const bind = asRecord(record.bind);
    return [
      {
        name,
        type,
        description,
        label: readString(record.label) || description || name,
        bindPath: readString(bind?.path),
      },
    ];
  });
}

function readFieldType(value: unknown): FieldType {
  return typeof value === "string" && FIELD_TYPES.has(value as FieldType)
    ? (value as FieldType)
    : "text";
}

function readOutputType(value: unknown): OutputType {
  return typeof value === "string" && OUTPUT_TYPES.has(value as OutputType)
    ? (value as OutputType)
    : "text";
}

function languageFrom(command: string, dockerfile: string) {
  const hay = `${command} ${dockerfile}`.toLowerCase();
  if (hay.includes("python")) return "Python";
  if (hay.includes("java")) return "Java";
  if (hay.includes("go") || hay.includes("pricer")) return "Go";
  return "Other";
}

function sharingLabel(value: string) {
  if (value === "company") return "Whole company";
  if (value === "public") return "Public";
  if (value === "team") return "Team";
  if (value === "private" || value === "me") return "Only me";
  return value || "Only me";
}

function wordsOf(tool: Tool) {
  const hay = `${tool.name} ${tool.description} ${tool.tags.join(" ")}`.toLowerCase();
  return new Set(hay.split(/[^a-z0-9]+/).filter((word) => word.length > 3));
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

async function githubJson(path: string) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error("GitHub could not be reached. Check the link and try again.");
  }
  return (await response.json()) as { default_branch?: string };
}

async function githubRaw(path: string) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github.raw",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error("GitHub could not be reached. Check the link and try again.");
  }
  return response.text();
}
