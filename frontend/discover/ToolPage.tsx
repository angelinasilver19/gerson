import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatCount, recordRun, useCatalog } from "@shared/catalog";
import { ExportMenu } from "./ExportMenu";
import { cellText } from "./exportResult";
import { fileToBase64, runTool, type PreparedInput, type RunCompute, type RunOutput } from "./runTool";
import { formatDuration, formatRunMoney, runCost } from "@dashboard/model";
import { ShareDialog } from "./ShareDialog";
import "./discover.css";

const readyLines = [
  "gerson runtime · this Mac",
  "Publishing a repo does not start a machine. This portal builds the image and runs a container.",
];

export function ToolPage() {
  const { toolId = "" } = useParams();
  const tool = useCatalog().find((item) => item.id === toolId);
  const [text, setText] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [lines, setLines] = useState<string[]>(readyLines);
  const [outputs, setOutputs] = useState<RunOutput[]>([]);
  const [compute, setCompute] = useState<RunCompute | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!tool) return;
    document.title = `${tool.name} · G.E.R.S.O.N.`;
    setText({});
    setFiles({});
    setStatus("idle");
    setLines(readyLines);
    setOutputs([]);
    setCompute(null);
    setShareOpen(false);
    setNotice("");
  }, [toolId]);

  useEffect(() => {
    const node = terminalRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [lines, status]);

  if (!tool) {
    return (
      <div className="page">
        <h1 className="page-title">Tool not in the catalog</h1>
        <p className="page-sub">
          <Link to="/discover">Back to search</Link>
        </p>
      </div>
    );
  }

  const current = tool;

  function pushLine(line: string) {
    setLines((current) => {
      const next = [...current, line];
      return next.length > 300 ? next.slice(-300) : next;
    });
  }

  async function run() {
    setStatus("running");
    setLines(["gerson runtime · this Mac"]);
    setOutputs([]);
    setCompute(null);
    setNotice("");
    try {
      const inputs: PreparedInput[] = [];
      for (const input of current.inputs) {
        if (input.type === "file") {
          const file = files[input.name];
          if (!file) throw new Error(`Choose ${input.label.toLowerCase()} before running.`);
          inputs.push({ name: input.name, base64: await fileToBase64(file) });
        } else {
          const value = text[input.name]?.trim() ?? "";
          if (!value) throw new Error(`Add ${input.label.toLowerCase()} before running.`);
          if (input.type === "json") {
            try {
              JSON.parse(value);
            } catch {
              throw new Error(`${input.label} has to be JSON.`);
            }
          }
          inputs.push({ name: input.name, text: value });
        }
      }
      const result = await runTool(current, inputs, pushLine);
      setOutputs(result.outputs);
      setCompute(result.compute ?? null);
      setStatus("done");
      recordRun(
        current.id,
        result.compute
          ? { seconds: result.compute.seconds, dollars: runCost(result.compute) }
          : undefined,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "The run failed.";
      setLines((current) => (current[current.length - 1] === message ? current : [...current, message]));
      setStatus("error");
    }
  }

  return (
    <div className="page tool-page">
      <div className="tool-top">
        <Link className="back" to="/discover">
          ← Back to results
        </Link>
        <div className="title-row">
          <div>
            <h1 className="page-title">{tool.name}</h1>
            <p className="tool-meta page-lead">
              {tool.owner} · {tool.sharedWith} · {formatCount(tool.runs)} runs · {tool.language}
            </p>
            {!tool.repoUrl && (
              <p className="tool-meta page-lead">A repo is not connected yet, so this tool cannot run.</p>
            )}
          </div>
          <div className="tool-actions">
            <button
              type="button"
              className="btn secondary"
              onClick={() => setNotice("Your use case was noted. Saving it waits on the backend.")}
            >
              Add your use case
            </button>
            <button type="button" className="btn" onClick={() => setShareOpen(true)}>
              Share
            </button>
          </div>
        </div>
      </div>
      {notice && <p className="notice">{notice}</p>}

      {shareOpen && (
        <ShareDialog
          toolName={tool.name}
          onClose={() => setShareOpen(false)}
          onSent={() => {
            setShareOpen(false);
            setNotice("Share sent. Permissions will be stored by the catalog API.");
          }}
        />
      )}

      <div className="run-grid">
        <section className="panel">
          <h2>Inputs</h2>
          <div className="inputs">
            {tool.inputs.map((input) =>
              input.type === "file" ? (
                <label key={input.name} className="file-field">
                  <span>{input.label}</span>
                  <span className="file-name">{files[input.name]?.name || "No file selected"}</span>
                  <input
                    type="file"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setFiles((current) => ({ ...current, [input.name]: file }));
                    }}
                  />
                </label>
              ) : input.type === "number" ? (
                <label key={input.name} className="text-field">
                  <span>{input.label}</span>
                  <input
                    type="number"
                    value={text[input.name] ?? ""}
                    placeholder={input.description}
                    onChange={(event) =>
                      setText((current) => ({ ...current, [input.name]: event.target.value }))
                    }
                  />
                </label>
              ) : (
                <label key={input.name} className="text-field">
                  <span>{input.label}</span>
                  <textarea
                    rows={input.type === "json" ? 6 : 3}
                    value={text[input.name] ?? ""}
                    placeholder={input.sample || input.description}
                    onChange={(event) =>
                      setText((current) => ({ ...current, [input.name]: event.target.value }))
                    }
                  />
                </label>
              ),
            )}
          </div>
        </section>

        <section className="panel">
          <div className="result-head">
            <h2>Result</h2>
            {status === "done" &&
              outputs.map((output) =>
                output.summary ? <Summary key={output.name} summary={output.summary} /> : null,
              )}
            {status === "done" &&
              outputs.map((output) => <ExportMenu key={output.name} output={output} />)}
          </div>

          <div className="terminal" ref={terminalRef} role="log" aria-live="polite">
            {lines.map((line, index) => (
              <div
                key={`${index}-${line}`}
                className={
                  line.startsWith("$") ? "term-cmd" : status === "error" && index === lines.length - 1 ? "term-bad" : ""
                }
              >
                {line}
              </div>
            ))}
            {status === "running" && <div className="term-cursor">▌</div>}
          </div>
          {status === "done" &&
            outputs.map((output) => <OutputView key={output.name} output={output} />)}
          {status === "done" && compute && <ComputeLegend compute={compute} />}
        </section>
      </div>

      <div className="run-bar">
        <button
          type="button"
          className="btn"
          onClick={() => void run()}
          disabled={status === "running" || !tool.repoUrl}
        >
          {status === "running" ? "Running…" : status === "done" ? "Run again" : "Run"}
        </button>
      </div>
    </div>
  );
}

function ComputeLegend({ compute }: { compute: RunCompute }) {
  return (
    <p className="compute-legend">
      This run · {formatDuration(compute.seconds)} · {compute.vcpu} vCPU · {compute.memoryGb} GB ·{" "}
      {formatRunMoney(runCost(compute))}
    </p>
  );
}

function Summary({ summary }: { summary: Record<string, number> }) {
  return (
    <p className="diff-summary">
      {Object.entries(summary).map(([key, value]) => (
        <span
          key={key}
          className={key === "removed" || key === "changed" || key === "failed" ? "pill warn" : "pill"}
        >
          {value} {key}
        </span>
      ))}
    </p>
  );
}

function OutputView({ output }: { output: RunOutput }) {
  if (output.table) {
    return (
      <div className="table-wrap">
        <table className="diff-table">
          <thead>
            <tr>
              {output.table.columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {output.table.rows.map((row, index) => (
              <tr key={index} className={rowClass(row.status)}>
                {output.table?.columns.map((column) => (
                  <td key={column} className={column === "status" ? "status-cell" : undefined}>
                    {cellText(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (output.base64 && output.filename) {
    return (
      <p className="result-empty">
        <a href={`data:application/octet-stream;base64,${output.base64}`} download={output.filename}>
          Download {output.filename}
        </a>
      </p>
    );
  }

  const text =
    output.json !== undefined ? JSON.stringify(output.json, null, 2) : (output.text ?? "");
  return <pre className="result-json">{text}</pre>;
}

function rowClass(status: unknown) {
  if (status === "added" || status === "removed" || status === "changed") return status;
  return undefined;
}
