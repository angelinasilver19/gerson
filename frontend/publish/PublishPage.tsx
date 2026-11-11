import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { fieldKind, getCatalog, publishTool, type Tool } from "@shared/catalog";
import { findSimilar, loadRepo, type LoadedRepo } from "./loadRepo";
import "./publish.css";

const steps = [
  { id: 1, label: "Connect repo" },
  { id: 2, label: "Read tool.yaml" },
  { id: 3, label: "Review and publish" },
] as const;

type Step = (typeof steps)[number]["id"];

const sharingOptions = [
  "Only me",
  "Specific people",
  "Risk team",
  "Whole company",
  "Public",
];

const starterYaml = `name: Match maker
description: One sentence on what the tool does. Search uses this text.
owner: your-team
version: 1.0.0
sharing: company
run:
  dockerfile: ./Dockerfile
  command: python main.py
inputs:
  - name: request
    type: json
    label: Request
    description: What the person provides
    bind:
      as: file
      path: /inputs/request.json
outputs:
  - name: result
    type: json
    label: Result
    description: What the program writes back
    bind:
      as: file
      path: /outputs/result.json
      format: json
`;

function sharingFor(tool: Tool) {
  if (tool.sharedWith === "Public") return "Public";
  if (tool.sharedWith === "Only me") return "Only me";
  if (tool.sharedWith === "Team") return "Risk team";
  return sharingOptions[3];
}

export function PublishPage() {
  const [step, setStep] = useState<Step>(1);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState<LoadedRepo | null>(null);
  const [sharing, setSharing] = useState(sharingOptions[3]);
  const [gate, setGate] = useState<"similar" | "approved" | null>(null);
  const [publishedId, setPublishedId] = useState("");
  const [docsOpen, setDocsOpen] = useState(false);

  useEffect(() => {
    document.title = "Publish a tool · G.E.R.S.O.N.";
  }, []);

  async function readLink() {
    setLoading(true);
    setError("");
    setPublishedId("");
    try {
      const repo = await loadRepo(url);
      setLoaded(repo);
      setSharing(sharingFor(repo.tool));
      setGate(null);
      setStep(2);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not read that repo.";
      setError(message);
      if (/tool\.yaml/i.test(message)) setDocsOpen(true);
    } finally {
      setLoading(false);
    }
  }

  const similar = loaded ? findSimilar(loaded.tool) : null;
  const already = loaded
    ? getCatalog().find((tool) => tool.repoUrl === loaded.repoUrl || tool.id === loaded.repo)
    : undefined;

  function beginPublish() {
    if (!loaded || publishedId) return;
    setGate(!already && similar ? "similar" : "approved");
  }

  function publish() {
    if (!loaded) return;
    const tool = { ...loaded.tool, sharedWith: sharing };
    publishTool(tool);
    setPublishedId(tool.id);
    setGate(null);
  }

  return (
    <div className="page publish-page">
      <h1 className="page-title">Publish a tool</h1>
      <p className="page-sub">
        Paste a public GitHub link. We read tool.yaml from the repo root and show the form people
        will get.
      </p>

      <ol className="steps">
        {steps.map((item) => {
          const state = item.id < step ? "done" : item.id === step ? "current" : "";
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`step ${state}`}
                onClick={() => {
                  if (item.id === 1 || loaded) setStep(item.id);
                }}
              >
                <span className="step-n">{item.id < step ? "✓" : item.id}</span>
                {item.label}
              </button>
            </li>
          );
        })}
      </ol>

      {publishedId && loaded && (
        <div className="notice" role="status">
          {loaded.tool.name} is in the catalog for {sharing.toLowerCase()}.{" "}
          <Link to={`/discover/tools/${publishedId}`}>Open the tool</Link>
        </div>
      )}

      {step === 1 && (
        <section className="panel connect-panel">
          <h2>Where is the repo?</h2>
          <p className="muted">Public GitHub link. The repo needs tool.yaml at the root.</p>
          <form
            className="url-row"
            onSubmit={(event) => {
              event.preventDefault();
              void readLink();
            }}
          >
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://github.com/owner/repo"
              aria-label="GitHub repository link"
              spellCheck={false}
            />
            <button type="submit" className="btn" disabled={loading || !url.trim()}>
              {loading ? "Reading…" : "Read tool.yaml"}
            </button>
          </form>
          {error && <p className="form-error">{error}</p>}
          <button type="button" className="docs-toggle" onClick={() => setDocsOpen((open) => !open)}>
            {docsOpen ? "Hide setup guide" : "How to configure your repo"}
          </button>
          {docsOpen && <RepoGuide />}
        </section>
      )}

      {step === 2 && loaded && (
        <section className="panel">
          <div className="repo-line">
            <strong>
              {loaded.owner}/{loaded.repo}
            </strong>
            <span className="muted">{loaded.branch}</span>
            <span className="pill">tool.yaml found</span>
          </div>
          <dl className="parsed">
            <div>
              <dt>Name</dt>
              <dd>{loaded.tool.name}</dd>
            </div>
            <div>
              <dt>Description</dt>
              <dd>{loaded.tool.description}</dd>
            </div>
            <div>
              <dt>Run</dt>
              <dd>
                {loaded.tool.language} · {loaded.tool.version}
              </dd>
            </div>
            <div>
              <dt>Inputs</dt>
              <dd>{loaded.tool.inputs.map((input) => input.label).join(", ")}</dd>
            </div>
            <div>
              <dt>Outputs</dt>
              <dd>
                {loaded.tool.outputs
                  .map((output) => `${output.label} (${fieldKind(output.type)})`)
                  .join(", ")}
              </dd>
            </div>
          </dl>
          <button type="button" className="btn" onClick={() => setStep(3)}>
            Looks right
          </button>
        </section>
      )}

      {step === 3 && loaded && (
        <>
          <div className="review-grid">
            <section className="panel yaml-panel">
              <div className="repo-line">
                <strong>
                  {loaded.owner}/{loaded.repo}
                </strong>
                <span className="muted">{loaded.branch}</span>
                <span className="pill">tool.yaml valid</span>
              </div>
              <pre className="yaml">{loaded.raw}</pre>
            </section>

            <div className="review-side">
              {already && (
                <aside className="callout quiet">
                  <strong>This repo is already in the catalog</strong>
                  <p>Publishing updates {already.name} with the file from {loaded.branch}.</p>
                  <div className="callout-actions">
                    <Link className="btn ghost" to={`/discover/tools/${already.id}`}>
                      Open it
                    </Link>
                  </div>
                </aside>
              )}
              <section className="panel">
                <h2>What users will see</h2>
                <ul className="preview-fields">
                  {loaded.tool.inputs.map((input) => (
                    <li key={input.name}>
                      <span>{input.label}</span>
                      <span className="muted">{fieldKind(input.type)}</span>
                    </li>
                  ))}
                </ul>
                <p className="field-note">
                  {loaded.tool.outputs
                    .map((output) => `${output.label} comes back as ${fieldKind(output.type).toLowerCase()}`)
                    .join(". ")}
                  {loaded.tool.inputs.some((input) => input.bindPath)
                    ? ` Written to ${loaded.tool.inputs
                        .map((input) => input.bindPath)
                        .filter(Boolean)
                        .join(", ")}.`
                    : ""}
                </p>

                <label className="field">
                  <span>Who can use it</span>
                  <select value={sharing} onChange={(event) => setSharing(event.target.value)}>
                    {sharingOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
              </section>
            </div>
          </div>

          <div className="publish-bar">
            <button type="button" className="btn" onClick={beginPublish} disabled={Boolean(publishedId)}>
              {publishedId ? "Published" : already ? "Update tool" : "Publish tool"}
            </button>
          </div>
          {gate === "similar" && similar && (
            <PublishDialog title="A similar tool already exists" onClose={() => setGate(null)}>
              <p>
                {similar.name} is already in the catalog. You can still publish this one after review.
              </p>
              <div className="callout-actions">
                <Link className="btn ghost" to={`/discover/tools/${similar.id}`}>
                  Open it
                </Link>
                <button type="button" className="btn" onClick={() => setGate("approved")}>
                  Continue
                </button>
              </div>
            </PublishDialog>
          )}
          {gate === "approved" && (
            <PublishDialog title="Approval status" onClose={() => setGate(null)}>
              <div className="approval-status">
                <span className="approval-check" aria-hidden="true">
                  ✓
                </span>
                <span>
                  <strong>Dan Cho</strong>
                  <span className="muted">Approved for the company</span>
                </span>
              </div>
              <div className="callout-actions">
                <button type="button" className="btn" onClick={publish}>
                  Publish
                </button>
              </div>
            </PublishDialog>
          )}
        </>
      )}
    </div>
  );
}

function PublishDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <button type="button" className="publish-backdrop" aria-label="Close dialog" onClick={onClose} />
      <div className="publish-dialog" role="dialog" aria-labelledby="publish-dialog-title">
        <h2 id="publish-dialog-title">{title}</h2>
        {children}
      </div>
    </>
  );
}

function RepoGuide() {
  return (
    <div className="repo-guide">
      <h3>Make the repo configurable</h3>
      <p>Add this file at the root, push it to the default branch, then paste the link again.</p>
      <ol>
        <li>
          Create <code>tool.yaml</code> at the root, next to the code. This file is the contract for
          the name, the run command, and the input and output paths.
        </li>
        <li>
          <code>name</code> and <code>description</code> are required. Search matches the description.
        </li>
        <li>
          Under <code>run</code>, set <code>dockerfile</code> and <code>command</code>. The command is
          what runs inside the container.
        </li>
        <li>
          Add one input per thing the person provides. <code>type</code> is <code>file</code>,{" "}
          <code>text</code>, <code>number</code>, or <code>json</code>, and that is the control on the
          Use screen. <code>bind.path</code> is where the portal writes it inside the container.
        </li>
        <li>
          Add one output per result. <code>type</code> is <code>table</code>, <code>file</code>,{" "}
          <code>text</code>, or <code>json</code>. <code>bind.path</code> is where the program writes
          it. A table is a JSON file with <code>columns</code> and <code>rows</code>.
        </li>
        <li>
          Set <code>sharing</code> to <code>company</code>, <code>team</code>, <code>public</code>, or{" "}
          <code>private</code>.
        </li>
      </ol>
      <pre className="yaml">{starterYaml}</pre>
    </div>
  );
}
