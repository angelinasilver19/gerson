import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { demoQuery, formatCount, useCatalog, type Tool } from "@shared/catalog";
import { rankTools, type RankedTool } from "./rank";
import { searchChat, type ChatTurn } from "./llmSearch";
import "./discover.css";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  matches: RankedTool[];
};

export function AskPage() {
  const catalog = useCatalog();
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searching, setSearching] = useState(false);
  const [traceLines, setTraceLines] = useState<string[]>([]);
  const [traceStep, setTraceStep] = useState(0);
  const traceLinesRef = useRef<string[]>([]);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "Find a tool · G.E.R.S.O.N.";
  }, []);

  useEffect(() => {
    if (!searching) return;
    setTraceStep(0);
    let current = 0;
    let timer = 0;
    const tick = () => {
      const lines = traceLinesRef.current;
      if (current >= lines.length - 1) return;
      current += 1;
      setTraceStep(current);
      timer = window.setTimeout(tick, 650 + Math.random() * 800);
    };
    timer = window.setTimeout(tick, 500 + Math.random() * 500);
    return () => window.clearTimeout(timer);
  }, [searching]);

  useEffect(() => {
    const node = threadRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, searching, traceStep]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const nextQuery = query.trim();
    if (!nextQuery || searching) return;

    const history = [...messages, { role: "user" as const, text: nextQuery, matches: [] }];
    const lines = buildTrace(catalog);
    traceLinesRef.current = lines;
    setTraceLines(lines);
    setTraceStep(0);
    setMessages(history);
    setQuery("");
    setSearching(true);

    try {
      const reply = await searchChat(toTurns(history), catalog);
      setMessages([
        ...history,
        { role: "assistant", text: reply.message, matches: reply.matches },
      ]);
    } catch (error) {
      console.error("LLM search failed:", error);
      const matches = rankTools(nextQuery, catalog);
      const text = matches.length
        ? "I couldn't reach the model, so these are the closest catalog matches."
        : "Nothing in the catalog fits that. You can publish a tool.";
      setMessages([...history, { role: "assistant", text, matches }]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="page ask-page">
      <header className="ask-head">
        <h1 className="page-title">What do you want to do?</h1>
        <p className="page-sub">
          Describe the task in plain words. A follow-up can refer to the last reply. We&apos;ll
          search {catalog.length} tools built by teams across the firm.
        </p>
      </header>

      <div className="chat-thread" ref={threadRef} aria-live="polite">
        {messages.length === 0 && (
          <p className="chat-empty">Ask for a task. The next message can narrow it down.</p>
        )}
        {messages.map((message, index) => (
          <article key={index} className={`bubble ${message.role}`}>
            <p>{message.text}</p>
            {message.matches.length > 0 && (
              <div className="bubble-cards">
                {message.matches.map((match) => (
                  <ToolCard key={match.tool.id} tool={match.tool} reason={match.reason} />
                ))}
              </div>
            )}
          </article>
        ))}
        {searching && <WorkingTrace lines={traceLines} step={traceStep} />}
      </div>

      <form className="search-row" onSubmit={(event) => void send(event)}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Describe the task"
          placeholder={demoQuery}
          disabled={searching}
        />
        <button type="submit" className="btn" disabled={searching || !query.trim()}>
          Send
        </button>
      </form>

      <p className="empty-help">
        Nothing fits? <Link to="/publish">Publish your own tool</Link>
        <span className="muted"> · Asking AI to draft a tool.yaml comes later.</span>
      </p>
    </div>
  );
}

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function buildTrace(catalog: Tool[]) {
  const openers = [
    "Searching the tool directory",
    "Looking through the catalog",
    "Scanning shared tools",
    "Opening the tool directory",
  ];
  const closers = [
    "Matching this task",
    "Checking which ones fit",
    "Narrowing the matches",
    "Comparing that with your request",
  ];
  const endings = ["Writing a reply", "Drafting the answer", "Putting the matches together"];
  const names = [...catalog]
    .sort(() => Math.random() - 0.5)
    .slice(0, 2 + Math.floor(Math.random() * 2))
    .map((tool) => pick([`Reading ${tool.name}`, `Checking ${tool.name}`, `Opening ${tool.name}`]));
  return [pick(openers), ...names, pick(closers), pick(endings)];
}

function WorkingTrace({ lines, step }: { lines: string[]; step: number }) {
  return (
    <div className="bubble assistant pending" aria-live="polite">
      <ol className="work-trace">
        {lines.slice(0, step + 1).map((label, index) => {
          const done = index < step;
          return (
            <li key={`${label}-${index}`} className={done ? "done" : "active"}>
              <span className="work-mark" aria-hidden="true">
                {done ? "✓" : ""}
              </span>
              <span>
                {label}
                {done ? "" : <span className="work-dots" />}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function toTurns(messages: ChatMessage[]): ChatTurn[] {
  return messages.slice(-10).map((message) => {
    if (message.role === "user") return { role: "user", content: message.text };
    const suggested = message.matches.map((match) => match.tool.name).join(", ");
    const content = suggested ? `${message.text} Suggested: ${suggested}.` : message.text;
    return { role: "assistant", content };
  });
}

function ToolCard({ tool, reason }: { tool: Tool; reason: string }) {
  return (
    <article className="tool-card">
      <div className="tool-icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M4 2.5h6.2L14 6.2V15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path d="M10 2.8V6.2H13.4" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </div>
      <div>
        <div className="tool-name">
          <h2>{tool.name}</h2>
          <span className={reason.startsWith("Best") ? "pill" : "pill quiet"}>{reason}</span>
        </div>
        <p className="tool-desc">{tool.description}</p>
        <p className="tool-meta">
          {tool.owner} · {tool.sharedWith} · {formatCount(tool.runs)} runs · {tool.language}
        </p>
      </div>
      <Link className="btn ghost use-btn" to={`/discover/tools/${tool.id}`}>
        Use
      </Link>
    </article>
  );
}
