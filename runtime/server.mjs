import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, rm, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";


const PORT = Number(process.env.PORT || 8787);
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const CACHE = path.join(path.dirname(fileURLToPath(import.meta.url)), ".cache");
const MAX_BODY = 12 * 1024 * 1024;

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/api/health") {
    return sendJson(res, 200, { ok: true });
  }
  if (req.method === "POST" && req.url === "/api/run") {
    return handleRun(req, res);
  }
  if (req.method === "POST" && req.url === "/api/search") {
  return handleSearch(req, res);
  }

  sendJson(res, 404, { error: "Not found." });
});

server.requestTimeout = 0;
server.headersTimeout = 0;
server.listen(PORT, "127.0.0.1", () => {
  console.log(`runtime listening on http://127.0.0.1:${PORT}`);
});


async function handleSearch(req, res) {
  let body;

  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, {
      error: "Send a JSON search request.",
    });
  }

  const messages = readChatMessages(body);
  const tools = Array.isArray(body.tools) ? body.tools : [];

  if (!messages.length) {
    return sendJson(res, 400, {
      error: "Search query is required.",
    });
  }

  if (!tools.length) {
    return sendJson(res, 200, {
      message: "The catalog is empty.",
      matches: [],
    });
  }

  try {
    const result = await searchWithGemini(messages, tools);

    return sendJson(res, 200, result);
  } catch (error) {
    console.error("Gemini search failed:", error);

    return sendJson(res, 500, {
      error: "LLM search failed.",
    });
  }
}


async function generateSearch(prompt) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });
    } catch (error) {
      lastError = error;
      if (error.status !== 503 && error.status !== 429) throw error;
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    }
  }
  throw lastError;
}

function readChatMessages(body) {
  if (Array.isArray(body.messages)) {
    return body.messages
      .filter(
        (item) =>
          item &&
          (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string" &&
          item.content.trim(),
      )
      .map((item) => ({ role: item.role, content: item.content.trim() }))
      .slice(-10);
  }
  const query = typeof body.query === "string" ? body.query.trim() : "";
  return query ? [{ role: "user", content: query }] : [];
}

async function searchWithGemini(messages, tools) {
  const catalog = tools.map((tool) => ({
    id: tool.id,
    name: tool.name,
    description: tool.description,
    tags: tool.tags,
  }));
  const transcript = messages
    .map((item) => `${item.role === "user" ? "User" : "Assistant"}: ${item.content}`)
    .join("\n");

  const prompt = `
You are the search assistant for G.E.R.S.O.N., an internal company hub for small software tools.

The user is in a conversation. Use the earlier messages to understand follow-ups such as "the portfolio one" or "no, files".

CONVERSATION:
${transcript}

AVAILABLE TOOLS:
${JSON.stringify(catalog, null, 2)}

Return ONLY valid JSON in this exact format:

{
  "message": "One or two short sentences.",
  "matches": [
    {
      "id": "tool-id",
      "score": 0.95,
      "reason": "One short sentence explaining why this tool matches."
    }
  ]
}

Rules:
- message is what you say in the chat. Keep it to one or two sentences.
- If the request is ambiguous, ask one clarifying question and return an empty matches array.
- Otherwise return at most 3 tools.
- Only return tool IDs that exist in AVAILABLE TOOLS.
- Score must be between 0 and 1.
- Sort from most relevant to least relevant.
- If nothing is relevant, say so in message and return an empty matches array.
- Do not invent tools.
`;

  const response = await generateSearch(prompt);
  const text = response.text?.trim();

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  const parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/, "").trim());
  const message = typeof parsed.message === "string" ? parsed.message.trim() : "";

  if (!message || !Array.isArray(parsed.matches)) {
    throw new Error("Gemini returned an invalid search response.");
  }

  return { message, matches: parsed.matches };
}


async function handleRun(req, res) {
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { error: "Send a JSON run request." });
  }

  res.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache",
  });
  const send = (event) => {
    res.write(`${JSON.stringify(event)}\n`);
  };

  try {
    const result = await executeRun(body, send);
    send({ result });
  } catch (error) {
    send({ error: error instanceof Error ? error.message : "The run failed." });
  } finally {
    res.end();
  }
}

async function executeRun(body, send) {
  const repoUrl = readRepoUrl(body.repoUrl);
  const inputs = Array.isArray(body.inputs) ? body.inputs : [];
  const { owner, repo } = repoUrl;

  const log = (line) => send({ line });
  log("gerson runtime · this Mac");
  log("$ docker info");
  await assertDocker();
  log("Docker is ready");

  const repoDir = await syncRepo(repoUrl.href, log);

  const contract = await readContract(repoDir);
  const image = imageName(owner, repo, contract.sha);
  const exists = await imageExists(image);
  log(exists ? `Using cached image ${image}` : `$ docker build -t ${image}`);
  if (!exists) await dockerBuild(repoDir, contract.dockerfile, image, log);

  const sidecar = await maybeStartSidecar(repoDir, contract, log);
  log(`$ docker run --cpus ${contract.cpu} --memory ${contract.memory} ${image}`);

  const runDir = path.join(CACHE, "runs", `${process.pid}-${Date.now()}`);
  await mkdir(runDir, { recursive: true });
  let container = "";

  try {
    const mounts = await stageFiles(runDir, contract, inputs);
    container = `gerson-run-${process.pid}-${Date.now()}`;
    const args = ["run", "--name", container, "--memory", contract.memory, "--cpus", String(contract.cpu)];
    if (sidecar) args.push("--network", `container:${sidecar}`);
    else if (contract.rewritesHost) args.push("--add-host", "host.docker.internal:host-gateway");
    for (const mount of mounts) args.push("-v", `${mount.host}:${mount.container}`);
    for (const item of contract.env) args.push("-e", `${item.name}=${item.value}`);
    args.push(image);

    const timer = setTimeout(() => {
      spawn("docker", ["kill", container], { stdio: "ignore" });
    }, contract.timeoutMs);
    const started = Date.now();
    try {
      await exec("docker", args, log);
    } catch (error) {
      throw new Error(tail(error.stderr || error.message));
    } finally {
      clearTimeout(timer);
    }
    const compute = await readCompute(container, (Date.now() - started) / 1000, contract);
    log("Container finished");

    return { outputs: await readOutputs(runDir, contract.outputs), compute };
  } finally {
    if (container) spawn("docker", ["rm", "-f", container], { stdio: "ignore" });
    await rm(runDir, { recursive: true, force: true });
  }
}

function readRepoUrl(value) {
  let url;
  try {
    url = new URL(String(value || "").trim().replace(/\.git$/, ""));
  } catch {
    throw new Error("This tool has no GitHub repo to build.");
  }
  if (url.protocol !== "https:" || url.hostname !== "github.com") {
    throw new Error("Runs only clone public https://github.com repositories.");
  }
  const [owner, repo] = url.pathname.split("/").filter(Boolean);
  if (!owner || !repo || !/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) {
    throw new Error("The GitHub link is missing an owner and a repository.");
  }
  url.pathname = `/${owner}/${repo}.git`;
  url.search = "";
  url.hash = "";
  return { href: url.href, owner, repo };
}

async function assertDocker() {
  try {
    await exec("docker", ["info"]);
  } catch (error) {
    const text = `${error.message}\n${error.stderr || ""}`;
    if (/not installed|ENOENT/i.test(text)) {
      throw new Error("Docker is not installed. Install it and start it, then run the tool again.");
    }
    throw new Error("Docker is not running. Start Docker, then run the tool again.");
  }
}

async function syncRepo(url, log) {
  const { owner, repo } = readRepoUrl(url);
  const dir = path.join(CACHE, "repos", owner, repo);
  const template = path.join(CACHE, "git-template");
  await mkdir(path.dirname(dir), { recursive: true });
  await mkdir(template, { recursive: true });
  const gitDir = path.join(dir, ".git");
  try {
    await access(gitDir);
    log("$ git fetch --depth 1 origin");
    await exec("git", ["-C", dir, "fetch", "--depth", "1", "origin"], log);
    log("$ git reset --hard FETCH_HEAD");
    await exec("git", ["-C", dir, "reset", "--hard", "FETCH_HEAD"], log);
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    try {
      log(`$ git clone --depth 1 ${url}`);
      await exec("git", ["clone", "--template", template, "--depth", "1", url, dir], log);
    } catch (cloneError) {
      throw new Error(tail(cloneError.stderr || cloneError.message || error.message));
    }
  }
  return dir;
}

async function readContract(repoDir) {
  const raw = await readFile(path.join(repoDir, "tool.yaml"), "utf8").catch(() => {
    throw new Error("The cloned repo has no tool.yaml at the root.");
  });
  const document = parse(raw);
  if (!document || typeof document !== "object") throw new Error("tool.yaml is not valid.");
  const run = document.run && typeof document.run === "object" ? document.run : {};
  const dockerfile = typeof run.dockerfile === "string" ? run.dockerfile : "./Dockerfile";
  const resolved = path.resolve(repoDir, dockerfile);
  if (!resolved.startsWith(path.resolve(repoDir) + path.sep)) {
    throw new Error("run.dockerfile points outside the repo.");
  }
  await access(resolved).catch(() => {
    throw new Error(`The repo is missing ${dockerfile}.`);
  });

  const sha = (await exec("git", ["-C", repoDir, "rev-parse", "HEAD"])).stdout.trim();
  const inputs = readBinds(document.inputs, "input");
  const outputs = readBinds(document.outputs, "output");
  const env = readEnv(run.env);
  const timeoutMs = readTimeout(document.resources?.timeout);
  const memory = readMemory(document.resources?.memory);
  const memoryGb = readMemoryGb(document.resources?.memory);
  const cpu = readCpu(document.resources?.cpu);
  return {
    sha,
    dockerfile: resolved,
    inputs,
    outputs,
    env,
    timeoutMs,
    memory,
    memoryGb,
    cpu,
    rewritesHost: env.some((item) => item.rewritten),
  };
}

function readBinds(value, kind) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`tool.yaml needs at least one ${kind}.`);
  }
  return value.map((item) => {
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    const bindPath = typeof item?.bind?.path === "string" ? item.bind.path.trim() : "";
    if (!name || !bindPath.startsWith("/") || bindPath.includes("..")) {
      throw new Error(`Each ${kind} needs a name and an absolute bind path.`);
    }
    return {
      name,
      label: typeof item.label === "string" && item.label.trim() ? item.label.trim() : name,
      type: typeof item.type === "string" ? item.type : "text",
      bindPath,
    };
  });
}

function readEnv(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    const fallback = typeof item?.default === "string" ? item.default : "";
    if (!name || !/^[\w.-]+$/.test(name)) return [];
    const rewritten = /127\.0\.0\.1|localhost/.test(fallback);
    return [{ name, value: fallback, rewritten, original: fallback }];
  });
}

function readTimeout(value) {
  const match = typeof value === "string" ? value.match(/^(\d+)s$/) : null;
  const seconds = match ? Number(match[1]) : 60;
  return Math.min(Math.max(seconds, 5), 300) * 1000;
}

function readMemory(value) {
  if (typeof value !== "string") return "1g";
  const match = value.trim().match(/^(\d+)(gb|mb)$/i);
  if (!match) return "1g";
  return `${match[1]}${match[2].toLowerCase() === "gb" ? "g" : "m"}`;
}

function readMemoryGb(value) {
  if (typeof value !== "string") return 1;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(gb|mb)$/i);
  if (!match) return 1;
  const amount = Number(match[1]);
  return match[2].toLowerCase() === "gb" ? amount : amount / 1024;
}

function readCpu(value) {
  const cpu = Number(value);
  if (!Number.isFinite(cpu) || cpu <= 0) return 1;
  return Math.min(cpu, 8);
}

async function readCompute(container, fallbackSeconds, contract) {
  const fallback = {
    seconds: roundSeconds(fallbackSeconds),
    vcpu: contract.cpu,
    memoryGb: contract.memoryGb,
  };
  try {
    const inspected = await exec("docker", [
      "inspect",
      "-f",
      "{{.State.StartedAt}}|{{.State.FinishedAt}}|{{.HostConfig.Memory}}",
      container,
    ]);
    const [started, finished, memory] = inspected.stdout.trim().split("|");
    const seconds = (Date.parse(finished) - Date.parse(started)) / 1000;
    const bytes = Number(memory);
    return {
      seconds: Number.isFinite(seconds) && seconds > 0 ? roundSeconds(seconds) : fallback.seconds,
      vcpu: contract.cpu,
      memoryGb: bytes > 0 ? roundGb(bytes / 1024 ** 3) : contract.memoryGb,
    };
  } catch {
    return fallback;
  }
}

function roundSeconds(value) {
  return Math.round(value * 100) / 100;
}

function roundGb(value) {
  return Math.round(value * 100) / 100;
}

function imageName(owner, repo, sha) {
  return `gerson/${owner}/${repo}:${sha}`.toLowerCase();
}

async function imageExists(name) {
  try {
    await exec("docker", ["image", "inspect", name]);
    return true;
  } catch (error) {
    const text = `${error.message}\n${error.stderr || ""}`;
    if (/No such image/i.test(text)) return false;
    if (/not installed|ENOENT/i.test(text)) {
      throw new Error("Docker is not installed. Install it and start it, then run the tool again.");
    }
    if (/docker daemon|cannot connect/i.test(text)) {
      throw new Error("Docker is not running. Start Docker, then run the tool again.");
    }
    return false;
  }
}

async function dockerBuild(context, dockerfile, tag, log) {
  try {
    await exec("docker", ["build", "-f", dockerfile, "-t", tag, context], log);
  } catch (error) {
    throw new Error(tail(error.stderr || error.message));
  }
}

async function maybeStartSidecar(repoDir, contract, log) {
  const mockMain = path.join(repoDir, "cmd", "mock", "main.go");
  const wantsLoopback = contract.env.some((item) => item.rewritten);
  try {
    await access(mockMain);
  } catch {
    rewriteLoopback(contract);
    return null;
  }
  if (!wantsLoopback) return null;

  const slug = `${path.basename(path.dirname(repoDir))}-${path.basename(repoDir)}`.toLowerCase();
  const tag = `gerson/${slug}-mock:${contract.sha}`;
  const name = `gerson-sidecar-${slug}`;
  if (!(await imageExists(tag))) {
    log(`$ docker build -t ${tag}`);
    const dockerfile = `
FROM golang:1.23-alpine AS build
WORKDIR /src
COPY . .
ENV CGO_ENABLED=0
RUN go build -o /out/mock ./cmd/mock
FROM alpine:3.20
COPY --from=build /out/mock /mock
ENTRYPOINT ["/mock"]
`;
    const file = path.join(repoDir, ".gerson-mock.Dockerfile");
    await writeFile(file, dockerfile);
    try {
      await dockerBuild(repoDir, file, tag, log);
    } finally {
      await rm(file, { force: true });
    }
  }

  let running = false;
  try {
    const inspected = await exec("docker", ["inspect", "-f", "{{.State.Running}} {{.Config.Image}}", name]);
    const [state, image] = inspected.stdout.trim().split(" ");
    const wanted = (await exec("docker", ["image", "inspect", "-f", "{{.Id}}", tag])).stdout.trim();
    running = state === "true" && image === wanted;
    if (!running) await exec("docker", ["rm", "-f", name]);
  } catch {
    running = false;
  }
  if (!running) {
    log(`$ docker run -d --name ${name} ${tag}`);
    await exec("docker", ["run", "-d", "--name", name, tag], log);
    await waitForLog(name, /listening/i);
  }
  return name;
}

function rewriteLoopback(contract) {
  for (const item of contract.env) {
    if (!item.rewritten) continue;
    item.value = item.original
      .replaceAll("127.0.0.1", "host.docker.internal")
      .replaceAll("localhost", "host.docker.internal");
  }
}

async function waitForLog(name, pattern) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const logs = await exec("docker", ["logs", name]);
      if (pattern.test(`${logs.stdout}\n${logs.stderr}`)) return;
    } catch {
      // Container is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("The quote API container did not start.");
}

async function stageFiles(runDir, contract, provided) {
  const mounts = new Map();
  const place = async (bindPath) => {
    const relative = bindPath.replace(/^\/+/, "");
    const hostFile = path.join(runDir, relative);
    if (!hostFile.startsWith(`${runDir}${path.sep}`)) {
      throw new Error("A bind path escaped the run directory.");
    }
    const root = relative.split("/")[0];
    mounts.set(root, { host: path.join(runDir, root), container: `/${root}` });
    await mkdir(path.dirname(hostFile), { recursive: true });
    return hostFile;
  };

  for (const input of contract.inputs) {
    const given = provided.find((item) => item?.name === input.name);
    const hostFile = await place(input.bindPath);
    await writeFile(hostFile, readPayload(given, input));
  }
  for (const output of contract.outputs) await place(output.bindPath);
  return [...mounts.values()];
}

function readPayload(given, input) {
  if (!given) throw new Error(`Add ${input.label} before running.`);
  if (typeof given.base64 === "string" && given.base64) {
    return Buffer.from(given.base64, "base64");
  }
  if (typeof given.text === "string") {
    if (!given.text.trim()) throw new Error(`Add ${input.label} before running.`);
    return given.text;
  }
  throw new Error(`Add ${input.label} before running.`);
}

async function readOutputs(runDir, outputs) {
  const rendered = [];
  for (const output of outputs) {
    const relative = output.bindPath.replace(/^\/+/, "");
    const hostFile = path.join(runDir, relative);
    // The output directory has to exist even when the tool creates the file.
    await mkdir(path.dirname(hostFile), { recursive: true }).catch(() => {});
    let raw;
    try {
      raw = await readFile(hostFile);
    } catch {
      throw new Error(`${output.label} was not written to ${output.bindPath}.`);
    }
    rendered.push(presentOutput(output, raw));
  }
  return rendered;
}

function presentOutput(output, raw) {
  const text = raw.toString("utf8");
  const base = {
    name: output.name,
    label: output.label,
    type: output.type,
    filename: path.basename(output.bindPath) || `${output.name}.txt`,
    base64: raw.toString("base64"),
  };
  if (output.type === "file") return base;
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  if (output.type === "table" && json && Array.isArray(json.columns) && Array.isArray(json.rows)) {
    return {
      ...base,
      summary: numberSummary(json.summary),
      table: { columns: json.columns.map(String), rows: json.rows },
    };
  }
  if ((output.type === "json" || output.type === "table") && json) {
    return { ...base, json, summary: numberSummary(json.summary) };
  }
  return { ...base, text };
}

function numberSummary(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const summary = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "number") summary[key] = item;
  }
  return Object.keys(summary).length ? summary : undefined;
}

function tail(value) {
  const text = String(value || "").trim();
  const lines = text.split("\n").slice(-12);
  return lines.join("\n") || "The image build failed.";
}

function exec(command, args, onLine) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const follow = (bucket) => (chunk) => {
      const text = chunk.toString();
      if (bucket === "out") stdout = keepTail(stdout, text);
      else stderr = keepTail(stderr, text);
      if (!onLine) return;
      for (const line of text.split(/\r?\n/)) {
        const clean = line.replace(/\u001b\[[0-9;]*[A-Za-z]/g, "").trimEnd();
        if (clean) onLine(clean);
      }
    };
    child.stdout.on("data", follow("out"));
    child.stderr.on("data", follow("err"));
    child.on("error", (error) => {
      if (error.code === "ENOENT") {
        reject(new Error(`${command} is not installed.`));
        return;
      }
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else {
        const failure = new Error(stderr || stdout || `${command} exited ${code}`);
        failure.stderr = stderr;
        failure.stdout = stdout;
        reject(failure);
      }
    });
  });
}

function keepTail(current, chunk) {
  const next = current + chunk;
  return next.length > 80_000 ? next.slice(-80_000) : next;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("The inputs are too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}
