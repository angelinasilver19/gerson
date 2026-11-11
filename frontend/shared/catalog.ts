import { useSyncExternalStore } from "react";

export type FieldType = "file" | "text" | "number" | "json";
export type OutputType = "table" | "file" | "text" | "json";

export type ToolInput = {
  name: string;
  label: string;
  type: FieldType;
  description: string;
  sample?: string;
  bindPath?: string;
};

export type ToolOutput = {
  name: string;
  label: string;
  type: OutputType;
  description: string;
  bindPath?: string;
};

export type Tool = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  owner: string;
  language: string;
  sharedWith: string;
  runs: number;
  computeSeconds?: number;
  spend?: number;
  status: "Live" | "Security review";
  version: string;
  repoUrl?: string;
  inputs: ToolInput[];
  outputs: ToolOutput[];
};

const orderSample = `{
  "ticker": "AAPL",
  "side": "buy",
  "shares": 200
}`;

/** Three public repos can run. The rest are catalog entries for search until a repo is connected. */
export const seedTools: Tool[] = [
  {
    id: "data-comparator",
    name: "Data comparator",
    description: "Compares two CSV files and shows rows added, removed, and changed.",
    tags: ["file", "comparator", "data", "diff", "holdings", "csv"],
    owner: "risk-team",
    language: "Python",
    sharedWith: "Whole company",
    runs: 0,
    status: "Live",
    version: "1.0.0",
    repoUrl: "https://github.com/prakhar2000/data-comparator",
    inputs: [
      {
        name: "file_a",
        label: "Older file",
        type: "file",
        description: "Older file",
        sample: "older.csv",
        bindPath: "/inputs/file_a",
      },
      {
        name: "file_b",
        label: "Newer file",
        type: "file",
        description: "Newer file",
        sample: "newer.csv",
        bindPath: "/inputs/file_b",
      },
    ],
    outputs: [
      {
        name: "report",
        label: "Changes",
        type: "table",
        description: "Rows added, removed, and changed",
        bindPath: "/outputs/report.json",
      },
    ],
  },
  {
    id: "compliance-checker",
    name: "Compliance checker",
    description: "Checks a trade file against the restricted list and flags rows that fail.",
    tags: ["compliance", "trades", "restricted"],
    owner: "compliance",
    language: "Java",
    sharedWith: "Whole company",
    runs: 0,
    status: "Live",
    version: "1.0.0",
    repoUrl: "https://github.com/prakhar2000/compliance-checker",
    inputs: [
      {
        name: "trades",
        label: "Trade file",
        type: "file",
        description: "CSV of trades to check",
        sample: "trades.csv",
        bindPath: "/inputs/trades",
      },
    ],
    outputs: [
      {
        name: "report",
        label: "Violations",
        type: "table",
        description: "Rows that failed the check",
        bindPath: "/outputs/report.json",
      },
    ],
  },
  {
    id: "trade-pricer",
    name: "Trade pricer",
    description: "Prices a trade by calling the firm's quote API and returns the price and notional.",
    tags: ["trades", "quote", "order", "price", "api"],
    owner: "trading",
    language: "Go",
    sharedWith: "Whole company",
    runs: 0,
    status: "Live",
    version: "1.0.0",
    repoUrl: "https://github.com/prakhar2000/trade-pricer",
    inputs: [
      {
        name: "order",
        label: "Order",
        type: "json",
        description: "Ticker, side, and shares",
        sample: orderSample,
        bindPath: "/inputs/order.json",
      },
    ],
    outputs: [
      {
        name: "quote",
        label: "Quote",
        type: "json",
        description: "Price and notional from the quote API",
        bindPath: "/outputs/quote.json",
      },
    ],
  },
  {
    id: "portfolio-comparator",
    name: "Portfolio comparator",
    description: "Compares two portfolio snapshots and shows weight, market value, and drift by holding.",
    tags: ["portfolio", "comparator", "holdings", "weights", "drift"],
    owner: "portfolio-analytics",
    language: "Python",
    sharedWith: "Whole company",
    runs: 0,
    status: "Live",
    version: "1.2.0",
    inputs: [
      {
        name: "older",
        label: "Last portfolio",
        type: "file",
        description: "Previous portfolio snapshot",
        bindPath: "/inputs/older",
      },
      {
        name: "newer",
        label: "Current portfolio",
        type: "file",
        description: "Current portfolio snapshot",
        bindPath: "/inputs/newer",
      },
    ],
    outputs: [
      {
        name: "drift",
        label: "Drift",
        type: "table",
        description: "Weight and value changes by holding",
        bindPath: "/outputs/drift.json",
      },
    ],
  },
  {
    id: "pdf-extractor",
    name: "PDF table extractor",
    description: "Pulls tables out of a PDF filing and returns them as rows.",
    tags: ["pdf", "extract", "tables", "filing"],
    owner: "research",
    language: "Python",
    sharedWith: "Whole company",
    runs: 0,
    status: "Live",
    version: "1.0.0",
    inputs: [
      {
        name: "document",
        label: "PDF filing",
        type: "file",
        description: "Filing or report to read",
        bindPath: "/inputs/document",
      },
    ],
    outputs: [
      {
        name: "tables",
        label: "Tables",
        type: "table",
        description: "Tables found in the PDF",
        bindPath: "/outputs/tables.json",
      },
    ],
  },
  {
    id: "earnings-digest",
    name: "Earnings digest",
    description: "Summarizes an earnings-call transcript into guidance, risks, and questions.",
    tags: ["earnings", "transcript", "summary", "research"],
    owner: "research",
    language: "Python",
    sharedWith: "Whole company",
    runs: 0,
    status: "Live",
    version: "1.1.0",
    inputs: [
      {
        name: "transcript",
        label: "Transcript",
        type: "file",
        description: "Earnings call transcript",
        bindPath: "/inputs/transcript",
      },
    ],
    outputs: [
      {
        name: "digest",
        label: "Digest",
        type: "text",
        description: "Short summary of the call",
        bindPath: "/outputs/digest.txt",
      },
    ],
  },
  {
    id: "invoice-reader",
    name: "Invoice reader",
    description: "Reads an invoice and returns the vendor, amount, currency, and due date.",
    tags: ["invoice", "vendor", "amount", "accounts"],
    owner: "finance-ops",
    language: "Java",
    sharedWith: "Whole company",
    runs: 0,
    status: "Live",
    version: "1.0.0",
    inputs: [
      {
        name: "invoice",
        label: "Invoice",
        type: "file",
        description: "Invoice PDF or image",
        bindPath: "/inputs/invoice",
      },
    ],
    outputs: [
      {
        name: "fields",
        label: "Invoice fields",
        type: "json",
        description: "Vendor, amount, currency, and due date",
        bindPath: "/outputs/fields.json",
      },
    ],
  },
  {
    id: "csv-converter",
    name: "CSV converter",
    description: "Converts a CSV file into a list of JSON records.",
    tags: ["csv", "json", "convert", "format"],
    owner: "data-platform",
    language: "Go",
    sharedWith: "Whole company",
    runs: 0,
    status: "Live",
    version: "1.0.0",
    inputs: [
      {
        name: "table",
        label: "CSV file",
        type: "file",
        description: "Table to convert",
        bindPath: "/inputs/table",
      },
    ],
    outputs: [
      {
        name: "records",
        label: "JSON records",
        type: "json",
        description: "One record per row",
        bindPath: "/outputs/records.json",
      },
    ],
  },
  {
    id: "expense-categorizer",
    name: "Expense categorizer",
    description: "Tags each expense line as travel, software, data, or other.",
    tags: ["expense", "categorize", "finance", "tags"],
    owner: "finance-ops",
    language: "Python",
    sharedWith: "Whole company",
    runs: 0,
    status: "Live",
    version: "0.8.0",
    inputs: [
      {
        name: "expenses",
        label: "Expense file",
        type: "file",
        description: "CSV of expense lines",
        bindPath: "/inputs/expenses",
      },
    ],
    outputs: [
      {
        name: "tagged",
        label: "Tagged expenses",
        type: "table",
        description: "Each line with a category",
        bindPath: "/outputs/tagged.json",
      },
    ],
  },
  {
    id: "meeting-notes",
    name: "Meeting notes",
    description: "Turns a meeting transcript into decisions, action items, and owners.",
    tags: ["meeting", "notes", "actions", "transcript"],
    owner: "platform",
    language: "TypeScript",
    sharedWith: "Whole company",
    runs: 0,
    status: "Live",
    version: "1.0.0",
    inputs: [
      {
        name: "transcript",
        label: "Transcript",
        type: "text",
        description: "Notes or transcript from the meeting",
        bindPath: "/inputs/transcript.txt",
      },
    ],
    outputs: [
      {
        name: "notes",
        label: "Notes",
        type: "text",
        description: "Decisions and action items",
        bindPath: "/outputs/notes.txt",
      },
    ],
  },
  {
    id: "log-summarizer",
    name: "Log summarizer",
    description: "Groups repeated error lines in an application log and counts each one.",
    tags: ["logs", "errors", "summary", "ops"],
    owner: "platform",
    language: "Go",
    sharedWith: "Whole company",
    runs: 0,
    status: "Live",
    version: "1.3.0",
    inputs: [
      {
        name: "log",
        label: "Log file",
        type: "file",
        description: "Application log to summarize",
        bindPath: "/inputs/log",
      },
    ],
    outputs: [
      {
        name: "errors",
        label: "Error groups",
        type: "table",
        description: "Repeated errors and how often they appear",
        bindPath: "/outputs/errors.json",
      },
    ],
  },
  {
    id: "fx-converter",
    name: "FX converter",
    description: "Converts a notional from one currency to another using a given rate.",
    tags: ["fx", "currency", "convert", "notional"],
    owner: "trading",
    language: "Java",
    sharedWith: "Whole company",
    runs: 0,
    status: "Live",
    version: "1.0.0",
    inputs: [
      {
        name: "amount",
        label: "Amount",
        type: "number",
        description: "Amount to convert",
        bindPath: "/inputs/amount",
      },
      {
        name: "pair",
        label: "Currency pair",
        type: "text",
        description: "For example USD/EUR",
        bindPath: "/inputs/pair.txt",
      },
      {
        name: "rate",
        label: "Rate",
        type: "number",
        description: "Conversion rate",
        bindPath: "/inputs/rate",
      },
    ],
    outputs: [
      {
        name: "result",
        label: "Converted amount",
        type: "json",
        description: "Amount in the target currency",
        bindPath: "/outputs/result.json",
      },
    ],
  },
  {
    id: "position-blotter",
    name: "Position blotter",
    description: "Turns a holdings file into a position list with shares, value, and weight.",
    tags: ["positions", "holdings", "blotter", "weights"],
    owner: "portfolio-analytics",
    language: "Python",
    sharedWith: "Whole company",
    runs: 0,
    status: "Live",
    version: "1.0.0",
    inputs: [
      {
        name: "holdings",
        label: "Holdings file",
        type: "file",
        description: "CSV of current holdings",
        bindPath: "/inputs/holdings",
      },
    ],
    outputs: [
      {
        name: "positions",
        label: "Positions",
        type: "table",
        description: "Shares, value, and weight by holding",
        bindPath: "/outputs/positions.json",
      },
    ],
  },
  {
    id: "research-brief",
    name: "Research brief",
    description: "Writes a one-page brief from pasted notes about a company or theme.",
    tags: ["research", "brief", "notes", "summary"],
    owner: "research",
    language: "Python",
    sharedWith: "Whole company",
    runs: 0,
    status: "Live",
    version: "0.6.0",
    inputs: [
      {
        name: "notes",
        label: "Notes",
        type: "text",
        description: "Raw notes to turn into a brief",
        bindPath: "/inputs/notes.txt",
      },
    ],
    outputs: [
      {
        name: "brief",
        label: "Brief",
        type: "text",
        description: "One-page research brief",
        bindPath: "/outputs/brief.txt",
      },
    ],
  },
  {
    id: "corporate-actions",
    name: "Corporate action parser",
    description: "Reads a corporate-action notice and returns the ticker, event type, and effective date.",
    tags: ["corporate-actions", "dividend", "split", "notice"],
    owner: "operations",
    language: "Java",
    sharedWith: "Whole company",
    runs: 0,
    status: "Live",
    version: "1.0.0",
    inputs: [
      {
        name: "notice",
        label: "Notice",
        type: "file",
        description: "Corporate action notice",
        bindPath: "/inputs/notice",
      },
    ],
    outputs: [
      {
        name: "event",
        label: "Event",
        type: "json",
        description: "Ticker, event type, and effective date",
        bindPath: "/outputs/event.json",
      },
    ],
  },
];

const STORAGE_KEY = "gerson.published-tools.v2";

function readPublished(): Tool[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Tool[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function merge(published: Tool[]): Tool[] {
  const byId = new Map(seedTools.map((tool) => [tool.id, tool]));
  for (const tool of published) byId.set(tool.id, tool);
  return [...byId.values()];
}

let published = readPublished();
let snapshot = merge(published);
const listeners = new Set<() => void>();

function emit() {
  snapshot = merge(published);
  listeners.forEach((listener) => listener());
}

export function subscribeCatalog(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCatalog() {
  return snapshot;
}

export function useCatalog() {
  return useSyncExternalStore(subscribeCatalog, getCatalog, getCatalog);
}

export function publishTool(tool: Tool) {
  const existing = snapshot.find((item) => item.id === tool.id);
  const next: Tool = {
    ...tool,
    runs: existing?.runs ?? 0,
    status: "Live",
    inputs: tool.inputs.map((input) => ({
      ...input,
      sample: input.sample || existing?.inputs.find((item) => item.name === input.name)?.sample,
    })),
  };
  published = [...published.filter((item) => item.id !== tool.id), next];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(published));
  emit();
}

export function recordRun(id: string, usage?: { seconds: number; dollars: number }) {
  const current = snapshot.find((tool) => tool.id === id);
  if (!current) return;
  const next = {
    ...current,
    runs: current.runs + 1,
    computeSeconds: (current.computeSeconds ?? 0) + (usage?.seconds ?? 0),
    spend: (current.spend ?? 0) + (usage?.dollars ?? 0),
  };
  published = [...published.filter((tool) => tool.id !== id), next];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(published));
  emit();
}

export function getTool(id: string) {
  return getCatalog().find((tool) => tool.id === id);
}

export const demoQuery =
  "Compare this week's holdings file with last week's and show what changed";

export function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

export function fieldKind(type: FieldType | OutputType) {
  if (type === "file") return "File";
  if (type === "json") return "JSON";
  if (type === "number") return "Number";
  if (type === "table") return "Table";
  return "Text";
}
