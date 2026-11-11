import { useEffect } from "react";
import { formatCount, useCatalog } from "@shared/catalog";
import { alwaysOnMonth, formatDuration, formatMoney, formatRunMoney, MACHINE_GB, MACHINE_VCPU } from "./model";
import "./dashboard.css";

export function DashboardPage() {
  const catalog = useCatalog();
  const tools = catalog.filter((tool) => tool.repoUrl);
  const runs = tools.reduce((sum, tool) => sum + tool.runs, 0);
  const seconds = tools.reduce((sum, tool) => sum + (tool.computeSeconds ?? 0), 0);
  const spend = tools.reduce((sum, tool) => sum + (tool.spend ?? 0), 0);
  const leftOn = alwaysOnMonth();
  const saved = Math.max(0, leftOn - spend);

  useEffect(() => {
    document.title = "Platform dashboard · G.E.R.S.O.N.";
  }, []);

  return (
    <div className="page dashboard-page">
      <header className="dash-head">
        <p className="eyebrow">Platform</p>
        <h1 className="page-title">Usage and savings</h1>
        <p className="page-sub">
          {tools.length} tools are live. The saving is one cloud container left on all month, minus
          what these runs actually used.
        </p>
      </header>

      <section className="stat-row" aria-label="Usage summary">
        <article className="stat">
          <p>Tools</p>
          <strong>{formatCount(tools.length)}</strong>
        </article>
        <article className="stat">
          <p>Runs</p>
          <strong>{formatCount(runs)}</strong>
        </article>
        <article className="stat accent">
          <p>Saved this month</p>
          <strong>{formatMoney(saved)}</strong>
        </article>
      </section>

      <section className="hero-compare">
        <article>
          <p>AWS or Azure, left on</p>
          <strong>{formatMoney(leftOn)}</strong>
          <span>
            {MACHINE_VCPU} vCPU and {MACHINE_GB} GB, for a month
          </span>
        </article>
        <article className="portal">
          <p>These runs</p>
          <strong>{formatRunMoney(spend)}</strong>
          <span>
            {runs === 0
              ? "No runs yet"
              : `${formatCount(runs)} ${runs === 1 ? "run" : "runs"} · ${formatDuration(seconds)}`}
          </span>
        </article>
      </section>
      <p className="rate stand-alone">
        US East on-demand price for a Linux container. AWS Fargate is $0.04048 per vCPU-hour and
        $0.004445 per GB-hour. Azure Container Instances is $0.0405 per vCPU-hour and $0.00445 per
        GB-hour. Either bill for a month is {formatMoney(leftOn)}. These runs cost{" "}
        {formatRunMoney(spend)}, so the difference is {formatMoney(saved)}.
      </p>

      <section className="panel catalog-panel">
        <h2>Tools</h2>
        <div className="table-scroll">
          <table className="catalog">
            <thead>
              <tr>
                <th>Tool</th>
                <th>Language</th>
                <th>Runs</th>
                <th>Time</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {[...tools]
                .sort((a, b) => b.runs - a.runs || a.name.localeCompare(b.name))
                .map((tool) => (
                  <tr key={tool.id}>
                    <td>{tool.name}</td>
                    <td>{tool.language}</td>
                    <td>{formatCount(tool.runs)}</td>
                    <td>{formatDuration(tool.computeSeconds ?? 0)}</td>
                    <td>{formatRunMoney(tool.spend ?? 0)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel token-empty">
        <h2>Model tokens</h2>
        <p>The MCP connector is not connected yet. Token use will show here once a model can call these tools.</p>
      </section>
    </div>
  );
}
