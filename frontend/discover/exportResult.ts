import * as XLSX from "xlsx";
import type { RunOutput } from "./runTool";

export type ExportFormat = "xlsx" | "doc" | "txt" | "json";

export const exportFormats: { id: ExportFormat; label: string }[] = [
  { id: "xlsx", label: "Excel" },
  { id: "doc", label: "Word" },
  { id: "txt", label: "Text" },
  { id: "json", label: "JSON" },
];

export function defaultFormat(output: RunOutput): ExportFormat {
  if (output.table) return "xlsx";
  if (output.type === "json" || output.json !== undefined) return "json";
  return "txt";
}

export function buildExport(output: RunOutput, format: ExportFormat) {
  const stem = output.name || "result";
  if (format === "xlsx") {
    return { filename: `${stem}.xlsx`, blob: workbookBlob(output) };
  }
  if (format === "doc") {
    return { filename: `${stem}.doc`, blob: textBlob(wordDocument(output), "application/msword") };
  }
  if (format === "json") {
    return {
      filename: `${stem}.json`,
      blob: textBlob(JSON.stringify(asJson(output), null, 2), "application/json"),
    };
  }
  return { filename: `${stem}.txt`, blob: textBlob(asText(output), "text/plain") };
}

export function saveFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function cellText(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((item) => cellText(item)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function workbookBlob(output: RunOutput) {
  const table = asTable(output);
  const grid = table
    ? [table.columns, ...table.rows]
    : [["text"], ...asText(output).split("\n").map((line) => [line])];
  const sheet = XLSX.utils.aoa_to_sheet(grid);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Result");
  const bytes = XLSX.write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function wordDocument(output: RunOutput) {
  const table = asTable(output);
  const body = table ? wordTable(table) : paragraphs(asText(output));
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${escapeHtml(output.label)}</title></head><body>${body}</body></html>`;
}

function wordTable(table: { columns: string[]; rows: string[][] }) {
  const head = table.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const body = table.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<table border="1" cellpadding="6" cellspacing="0"><tr>${head}</tr>${body}</table>`;
}

function paragraphs(body: string) {
  return body
    .split("\n")
    .map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`)
    .join("");
}

function asJson(output: RunOutput): unknown {
  if (output.table) {
    return {
      ...(output.summary ? { summary: output.summary } : {}),
      columns: output.table.columns,
      rows: output.table.rows,
    };
  }
  if (output.json !== undefined) return output.json;
  if (output.text != null) return { text: output.text };
  return { name: output.name };
}

function asText(output: RunOutput) {
  const table = asTable(output);
  if (table) {
    return [table.columns, ...table.rows].map((row) => row.map(csvCell).join(",")).join("\n");
  }
  if (output.text != null) return output.text;
  if (output.json !== undefined) return JSON.stringify(output.json, null, 2);
  return "";
}

function asTable(output: RunOutput) {
  if (output.table) {
    return {
      columns: output.table.columns,
      rows: output.table.rows.map((row) => output.table?.columns.map((column) => cellText(row[column])) ?? []),
    };
  }
  if (Array.isArray(output.json) && output.json.every(isRecord)) {
    const columns = [...new Set(output.json.flatMap((item) => Object.keys(item)))];
    return {
      columns,
      rows: output.json.map((item) => columns.map((column) => cellText(item[column]))),
    };
  }
  if (isRecord(output.json)) {
    const entries = Object.entries(output.json);
    if (entries.every(([, value]) => value == null || typeof value !== "object")) {
      return {
        columns: entries.map(([key]) => key),
        rows: [entries.map(([, value]) => cellText(value))],
      };
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function csvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

function textBlob(body: string, type: string) {
  return new Blob([body], { type });
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
