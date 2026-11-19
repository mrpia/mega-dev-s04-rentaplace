#!/usr/bin/env node
// Scenario check for the Domain Agents in agents/ (S04E03 build guide, "Glossaries and Scenario Checks").
//
//   node scripts/scenario-check.mjs <agent>|all [--judge-model <model>]
//
// Each Ask in agents/<agent>/scenarios.md goes to that Domain Agent in one fenced `claude -p` call: its
// model: line, no tools, no MCP servers, no CLAUDE.md, no saved session, an empty folder; its Job as
// the system prompt and its owned paths, glossary.md and memories.md given in full. A second fenced
// call (the judge, default sonnet) says for each Expect and Never line whether the answer says it,
// with a word-for-word quote; code checks the quote and makes the verdict (Expect passes on yes, Never
// on no, unclear fails). A refused quote is asked once more. The agent never sees scenarios.md.
//
// Exit 0 when every scenario passed, 1 when one failed, 2 when the check could not run, 3 when it broke.
// Sign-in: the login in ~/.claude, or CLAUDE_CODE_OAUTH_TOKEN (from `claude setup-token`) in CI.
// ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN and the Bedrock, Vertex and Foundry switches are removed
// from every call. Reports: agents/<agent>/reports/ (git-ignored). Needs Node 22+ and claude on PATH.
// A port of the maintainer's local scenario check; its tests check that both build the same prompts.
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NAME = /^[a-z][a-z0-9_-]{0,31}$/i;
const MODEL = /^[a-z0-9][a-z0-9.\-[\]]{0,63}$/i;
const FILES = ["agent.md", "glossary.md", "memories.md", "scenarios.md"];
const AGENT_TIMEOUT_SEC = 60;
const JUDGE_TIMEOUT_SEC = 240;
const CUT = 20_000;

/** A mistake in the call or in the agent's files: exit 2, with what to do instead. */
export class CheckError extends Error {}

// ---- the claude calls ------------------------------------------------------------------------

const claudeBin = () => process.env.SCENARIO_CLAUDE || "claude";
const FENCE_ENV = { CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1", CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1", CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS: "1" };
export const BILLING_OVERRIDES = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_FOUNDRY"];

/** This process's environment without the billing switches, plus the fence. */
export function fencedEnv(base = process.env, extra = {}) {
  const env = { ...base, ...FENCE_ENV, ...extra };
  for (const k of BILLING_OVERRIDES) delete env[k];
  return env;
}

export function agentArgs({ model, systemFile }) {
  return ["-p", "--setting-sources", "project", "--model", model, "--tools", "", "--strict-mcp-config", "--no-session-persistence", "--system-prompt-file", systemFile, "--output-format", "json"];
}

export function judgeArgs({ model, effort, systemFile, schema }) {
  return [
    "-p", "--setting-sources", "project", "--model", model, ...(effort ? ["--effort", effort] : []), "--tools", "", "--strict-mcp-config",
    "--no-session-persistence", "--system-prompt-file", systemFile, "--output-format", "json", "--json-schema", JSON.stringify(schema),
  ];
}

/** Run claude with the input on stdin, in an empty folder. Resolves { code, stdout, stderr, timedOut }. */
function runFenced(args, { input, env, timeoutSec, dir }) {
  return new Promise((done) => {
    const cwd = join(dir, "cwd");
    mkdirSync(cwd, { recursive: true });
    let out = "", err = "", timedOut = false, child;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child?.kill("SIGKILL");
      } catch {}
    }, timeoutSec * 1000);
    try {
      child = spawn(claudeBin(), args, { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
    } catch (e) {
      clearTimeout(timer);
      done({ code: null, stdout: "", stderr: e.message, timedOut });
      return;
    }
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      done({ code: null, stdout: out, stderr: e.code === "ENOENT" ? `${claudeBin()} is not installed or not on PATH` : e.message, timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      done({ code, stdout: out, stderr: err, timedOut });
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}

const tail = (s, n) => {
  const t = String(s ?? "").trim();
  return t.length > n ? `…${t.slice(-n)}` : t;
};

/** The agent's call. Resolves { ok, text, costUsd, ms } or { ok: false, error, ms }; never rejects. */
export async function runAgent({ model, system, input }) {
  const started = Date.now();
  const dir = mkdtempSync(join(tmpdir(), "domain-agent-"));
  try {
    const systemFile = join(dir, "system.md");
    writeFileSync(systemFile, system, { mode: 0o600 });
    const r = await runFenced(agentArgs({ model, systemFile }), { input, env: fencedEnv(process.env, { DOMAIN_AGENT_RUN: "1" }), timeoutSec: AGENT_TIMEOUT_SEC, dir });
    const ms = Date.now() - started;
    if (r.timedOut) return { ok: false, error: `no answer within ${AGENT_TIMEOUT_SEC} s`, ms };
    let j;
    try {
      j = JSON.parse(r.stdout);
    } catch {
      return { ok: false, error: `exit ${r.code}: ${(r.stderr || r.stdout).trim().slice(0, 300)}`, ms };
    }
    if (j.is_error || typeof j.result !== "string") return { ok: false, error: `${j.subtype || "error"}: ${String(j.result ?? "").slice(0, 300)}`, ms };
    return { ok: true, text: j.result, costUsd: j.total_cost_usd, ms };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The judge's call, with a JSON schema. Resolves { value, costUsd, ms }; rejects with the reason. */
export async function claudeJson({ system, input, schema, model, effort, timeoutSec = 180 }) {
  const dir = mkdtempSync(join(tmpdir(), "scenario-judge-"));
  try {
    const systemFile = join(dir, "system.md");
    writeFileSync(systemFile, system);
    const r = await runFenced(judgeArgs({ model, effort, systemFile, schema }), { input, env: fencedEnv(), timeoutSec, dir });
    if (r.timedOut) throw new Error(`The model did not answer within ${timeoutSec} s.`);
    let reply;
    try {
      reply = JSON.parse(r.stdout);
    } catch {
      throw new Error(`claude -p exited ${r.code} without JSON: ${tail(r.stderr || r.stdout, 400)}`);
    }
    if (reply.is_error) throw new Error(`claude -p: ${tail(reply.result ?? reply.subtype ?? "error", 400)}`);
    let value = reply.structured_output;
    if (value === undefined && typeof reply.result === "string") {
      try {
        value = JSON.parse(reply.result.replace(/^```(?:json)?\s*|\s*```$/g, ""));
      } catch {
        throw new Error(`The model's answer is not the JSON asked for: ${tail(reply.result, 300)}`);
      }
    }
    return { value, costUsd: reply.total_cost_usd ?? null, ms: reply.duration_ms ?? null };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** How claude signs in, with the billing switches removed. Only these fields, never the account. */
export function authStatus() {
  const r = spawnSync(claudeBin(), ["auth", "status"], { env: fencedEnv(), encoding: "utf8", timeout: 30_000 });
  let s;
  try {
    s = JSON.parse(r.stdout);
  } catch {
    return { loggedIn: false, reason: String(r.error?.message || r.stderr || r.stdout || "no answer").trim().slice(0, 200) };
  }
  return { loggedIn: s.loggedIn === true, authMethod: s.authMethod ?? null, subscriptionType: s.subscriptionType ?? null, apiProvider: s.apiProvider ?? null };
}

// ---- the agents ------------------------------------------------------------------------------

const unquote = (s) => s.replace(/^(['"])(.*)\1$/, "$2");

/** The front matter of agent.md: key: value, key: [a, b] and indented "- item" lists. */
export function frontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!m) return {};
  const out = {};
  let list = null;
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.replace(/^\s*#.*$/, "").replace(/\s+#.*$/, "");
    if (!line.trim()) continue;
    const item = line.match(/^\s*-\s+(.*)$/);
    if (item) {
      if (list) list.push(unquote(item[1].trim()));
      continue;
    }
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) {
      list = null;
      continue;
    }
    const [, key, value] = kv;
    if (value === "") out[key] = list = [];
    else {
      list = null;
      out[key] = value.startsWith("[") ? value.replace(/^\[|\]$/g, "").split(",").map((s) => unquote(s.trim())).filter(Boolean) : unquote(value.trim());
    }
  }
  return out;
}

const jobOf = (text) => text.match(/^##\s+Job\s*\n([\s\S]*?)(?=^##\s|(?![\s\S]))/m)?.[1].trim() ?? "";

/** Every Domain Agent: an agents/<name>/agent.md with an "owns:" list and a "## Job" section. */
export function domainAgents(root = ROOT) {
  let names = [];
  try {
    names = readdirSync(join(root, "agents"), { withFileTypes: true }).filter((e) => e.isDirectory() && NAME.test(e.name)).map((e) => e.name).sort();
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    let text;
    try {
      text = readFileSync(join(root, "agents", name, "agent.md"), "utf8");
    } catch {
      continue;
    }
    const front = frontMatter(text);
    const owns = (Array.isArray(front.owns) ? front.owns : []).filter((g) => typeof g === "string" && g.trim());
    const job = jobOf(text);
    if (!owns.length || !job) continue;
    const model = typeof front.model === "string" && front.model.trim() ? front.model.trim() : "haiku";
    out.push({ name, owns, job, model, home: `agents/${name}` });
  }
  return out;
}

const scenariosFile = (root, agent) => join(root, agent.home, "scenarios.md");

/** { run: [agent], skipped: [name] } for a name or "all". Throws CheckError with what to send instead. */
export function chooseAgents(root, agents, which) {
  if (which === "all") {
    const run = agents.filter((a) => existsSync(scenariosFile(root, a)));
    if (!run.length) throw new CheckError("no Domain Agent has a scenarios.md. Write agents/<agent>/scenarios.md first, then run the same command.");
    return { run, skipped: agents.filter((a) => !run.includes(a)).map((a) => a.name) };
  }
  if (!NAME.test(which ?? "")) throw new CheckError(`${which ?? ""}: use an agent folder name of lowercase letters, digits and dashes, or all.`);
  const agent = agents.find((a) => a.name === which);
  if (!agent) throw new CheckError(`${which}: agents/${which}/agent.md has no "owns:" list or no "## Job" section, or does not exist, so it is not a Domain Agent. Name a folder from agents/, or all.`);
  if (!existsSync(scenariosFile(root, agent))) throw new CheckError(`${which}: agents/${which}/scenarios.md does not exist. Write it first (## sections with Ask, Expect and Never lines), then run the same command.`);
  return { run: [agent], skipped: [] };
}

const sha = (text) => createHash("sha256").update(text).digest("hex").slice(0, 12);

/** The agent's files, read once: { "agent.md": { text, sha } | null, … }. */
export function snapshot(root, agent) {
  const files = {};
  for (const f of FILES) {
    try {
      const text = readFileSync(join(root, agent.home, f), "utf8");
      files[f] = { text, sha: sha(text) };
    } catch {
      files[f] = null;
    }
  }
  return files;
}

// ---- scenarios.md ----------------------------------------------------------------------------

const KEYWORD = /^(Ask|Expect|Never)\s*:\s*(.*)$/i;

/** scenarios.md as { title, scenarios: [{ id, title, line, ask, askLine, lines: [{ kind, text, line }] }] }. */
export function parseScenarios(markdown) {
  const out = { title: "", scenarios: [] };
  let s = null;
  let last = null;
  let n = 0;
  for (const raw of String(markdown).split(/\r?\n/)) {
    n++;
    const line = raw.replace(/^\s*[-*]\s+/, "").trimEnd();
    const t = line.trim();
    if (!t || t.startsWith("<!--")) continue;
    const h1 = line.match(/^#\s+(.*)$/);
    if (h1) {
      out.title = h1[1].trim();
      last = null;
      continue;
    }
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) {
      s = { id: out.scenarios.length + 1, title: h2[1].replace(/^\d+[.)]\s*/, "").trim(), line: n, question: null, lines: [] };
      out.scenarios.push(s);
      last = null;
      continue;
    }
    const m = line.match(KEYWORD);
    if (!m) {
      if (last && /^\s/.test(raw)) {
        last.text += ` ${t}`;
        continue;
      }
      if (!s) continue;
      throw new CheckError(`line ${n}: start it with Ask, Expect or Never, e.g. "Expect: names the rule with its reference"`);
    }
    const kind = m[1].toLowerCase();
    if (!s) throw new CheckError(`line ${n}: put "${m[1]}" under a "## <scenario>" heading`);
    if (!m[2].trim()) throw new CheckError(`line ${n}: "${m[1]}:" has no text`);
    if (kind === "ask") {
      if (s.question) throw new CheckError(`line ${n}: "${s.title}" already has an Ask (line ${s.question.line}); one question per scenario`);
      s.question = last = { text: m[2].trim(), line: n };
    } else {
      last = { kind, text: m[2].trim(), line: n };
      s.lines.push(last);
    }
  }
  if (!out.scenarios.length) throw new CheckError('no scenarios yet. Add a "## <scenario>" section with an Ask line and at least one Expect or Never line');
  for (const sc of out.scenarios) {
    if (!sc.question) throw new CheckError(`"${sc.title}" (line ${sc.line}) has no Ask line. Add one`);
    if (!sc.lines.length) throw new CheckError(`"${sc.title}" (line ${sc.line}) has no Expect or Never line. Add one`);
  }
  return { title: out.title, scenarios: out.scenarios.map(({ question, ...sc }) => ({ ...sc, ask: question.text, askLine: question.line })) };
}

// ---- the agent's prompt ----------------------------------------------------------------------

export const RUN_NOTE = "How this run works: a scenario check asks you one question about your area, as Main or its user might. You have no tools. Your owned paths, your glossary.md and your memories.md are given below in full, in place of reading them yourself.";
export const ANSWER_RULE = "Answer the question in at most five sentences, and end each claim with the reference its glossary entry or memory carries, in square brackets. Use only your glossary and memories; never invent a rule, a value or a reference. If neither applies, answer exactly: nothing relevant";

export const agentSystem = (agent) => [agent.job, "", RUN_NOTE, "", ANSWER_RULE].join("\n");

const cut = (s, n) => {
  const t = String(s ?? "");
  return t.length > n ? `${t.slice(0, n)}\n[… ${t.length - n} more characters]` : t;
};
const fileText = (home, files, f) => (files[f] ? files[f].text.trim() || `(${home}/${f} is empty)` : `(${home}/${f} does not exist)`);

export function agentInput(agent, files, ask) {
  return [
    `Your owned paths (${agent.home}/agent.md, "owns:"):`,
    ...agent.owns.map((o) => `- ${o}`),
    "",
    `Your glossary (${agent.home}/glossary.md):`,
    cut(fileText(agent.home, files, "glossary.md"), CUT),
    "",
    `Your memories (${agent.home}/memories.md):`,
    cut(fileText(agent.home, files, "memories.md"), CUT),
    "",
    "The question:",
    ask,
  ].join("\n");
}

// ---- the judge -------------------------------------------------------------------------------

export const JUDGE_SYSTEM = `You are the scenario judge, a black-box tester. A Domain Agent, an advisor for one area of a codebase, was asked one question. You judge lines that describe what its answer might say, against that answer and nothing else.

You get the scenario's title, the question, the lines, and the agent's answer between <answer> tags.

For each line, answer one question: does the answer say that? You are not told whether a line is wanted or unwanted, and you don't need to be: the check works out pass or fail from your answer.
- happened: "yes" when the answer says it, "no" when the answer does not say it or says something else, "unclear" when the answer is too vague to decide (say in reason what is missing).
- quote: copy, word for word, the shortest passage of the answer that shows your answer, and set "from" to "answer". For "no", quote what the answer says instead; when it says only "nothing relevant", quote that.

Judge each line by its own words: "and" needs every part, "or" needs one. A line about a value, a rule or a reference is met only when the answer states it, not when it could be worked out from the answer. Do not loosen or reinterpret a line, and do not judge what is right in the domain: judge only what the answer says.
Answer only with the JSON asked for.`;

export const JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "integer" },
          happened: { type: "string", enum: ["yes", "no", "unclear"] },
          from: { type: "string", enum: ["answer"] },
          quote: { type: "string" },
          reason: { type: "string" },
        },
        required: ["id", "happened", "from", "quote", "reason"],
      },
    },
  },
  required: ["verdicts"],
};

/** What the judge reads: each line's text only, never Expect or Never, then the answer. */
export function judgeInput(scenario, lines, captures) {
  const listed = lines.map((l, i) => `${i + 1}. ${l.text}`).join("\n");
  return `Scenario: ${scenario.title}\n\nThe question asked:\n${scenario.ask}\n\nLines to judge:\n${listed}\n\n<answer>\n${captures.answer}\n</answer>\n`;
}

/** Letters and digits only, so wrapping, punctuation and case don't decide whether a quote is found. */
export const fold = (text) => String(text).normalize("NFKC").toLowerCase().replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N}]+/gu, "");
export const contains = (haystack, quote) => {
  const q = fold(quote);
  return q.length > 0 && fold(haystack).includes(q);
};

/** Expect passes on "yes", Never on "no"; "unclear" or anything else fails. */
export function passes(kind, happened) {
  if (happened !== "yes" && happened !== "no") return false;
  return kind === "never" ? happened === "no" : happened === "yes";
}

/** Accept a verdict only with a quote found in the capture it names. A missing verdict fails. */
export function checkVerdicts(lines, answer, captures) {
  return lines.map((line, i) => {
    const v = (answer?.verdicts ?? []).find((x) => x.id === i + 1);
    if (!v) return { line, pass: false, quote: "", from: "", reason: "the judge gave no answer for this line" };
    const said = `happened: ${v.happened ?? "?"}`;
    const found = typeof captures[v.from] === "string" && contains(captures[v.from], v.quote);
    if (!found) return { line, pass: false, quote: v.quote, from: v.from, happened: v.happened, reason: `quote not found in ${v.from || "a capture"}; the judge said ${said}: ${v.reason}`, refused: true };
    return { line, pass: passes(line.kind, v.happened), quote: v.quote, from: v.from, happened: v.happened, reason: `${said}. ${v.reason}` };
  });
}

/** The second ask's opening: the refused quotes, numbered as the lines that follow, and the rule again. */
export function reaskNote(refused) {
  const listed = refused.map((r, i) => `${i + 1}. "${r.quote}" (from ${r.from || "no capture"})`).join("\n");
  return `Your earlier answer quoted text that is not, word for word, in the capture it named:\n${listed}\nAnswer these lines again. Each quote must be one unbroken passage copied exactly from one capture: leave no words out, add none, and use no "…".\n\n`;
}

/** Judge one scenario's lines against the answer; a line whose quote was refused is asked once more, alone. */
export async function judgeScenario({ scenario, answer, model, ask = claudeJson }) {
  const lines = scenario.lines;
  const captures = { answer };
  const call = (input) => ask({ system: JUDGE_SYSTEM, input, schema: JUDGE_SCHEMA, model, effort: "medium", timeoutSec: JUDGE_TIMEOUT_SEC });
  const first = await call(judgeInput(scenario, lines, captures));
  let costUsd = Number(first.costUsd ?? 0);
  const results = checkVerdicts(lines, first.value, captures);
  const at = results.flatMap((r, i) => (r.refused ? [i] : []));
  if (!at.length) return { results, costUsd };
  const again = at.map((i) => lines[i]);
  let second;
  try {
    second = await call(reaskNote(at.map((i) => results[i])) + judgeInput(scenario, again, captures));
  } catch (e) {
    for (const i of at) results[i] = { ...results[i], reason: `${results[i].reason} (asked again: ${e.message})` };
    return { results, costUsd };
  }
  costUsd += Number(second.costUsd ?? 0);
  checkVerdicts(again, second.value, captures).forEach((r, k) => {
    const before = results[at[k]];
    results[at[k]] = r.refused || !r.quote
      ? { ...r, pass: false, reasked: true, reason: `asked twice. First: ${before.reason}. Second: ${r.reason}` }
      : { ...r, reasked: true, reason: `second answer, after a refused quote: ${r.reason}` };
  });
  return { results, costUsd };
}

// ---- the run ---------------------------------------------------------------------------------

const failAll = (lines, reason) => lines.map((line) => ({ line, pass: false, quote: "", from: "", reason }));

/** Run the scenarios of one agent or of all: { id, which, runs, skipped }. The model calls can be replaced (tests). */
export async function checkScenarios({ root = ROOT, which, judgeModel = "sonnet", progress = () => {}, agent: callAgent = runAgent, ask = claudeJson, auth = authStatus, now = () => new Date() }) {
  const { run: agents, skipped } = chooseAgents(root, domainAgents(root), which);
  const plans = agents.map((agent) => {
    const files = snapshot(root, agent);
    try {
      return { agent, files, spec: parseScenarios(files["scenarios.md"]?.text ?? "") };
    } catch (error) {
      if (error instanceof CheckError) throw new CheckError(`${agent.name}: scenarios.md${/^line /.test(error.message) ? " " : ": "}${error.message}. Then run the same command.`);
      throw error;
    }
  });
  const signedIn = auth();
  if (!signedIn.loggedIn) throw new CheckError(`claude is not signed in (claude auth status: ${signedIn.authMethod || signedIn.reason || "not logged in"}). Sign in with claude login, or set CLAUDE_CODE_OAUTH_TOKEN (from claude setup-token) in CI, then run the same command.`);
  const id = `scen-${randomBytes(3).toString("hex")}`;
  const runs = [];
  for (const { agent, files, spec } of plans) {
    const run = {
      id, which, name: agent.name, home: agent.home, model: agent.model, owns: agent.owns, judgeModel, auth: signedIn,
      files: Object.fromEntries(FILES.map((f) => [f, files[f]?.sha ?? null])),
      started: now().toISOString(), scenarios: [], costs: { agent: 0, judge: 0 }, calls: { agent: 0, judge: 0 },
    };
    const judgeAsk = (o) => {
      run.calls.judge++;
      return ask(o);
    };
    const of = spec.scenarios.length;
    for (const sc of spec.scenarios) {
      progress(`${agent.name} ${sc.id}/${of} ${sc.title}: asking ${agent.model}`);
      const a = await callAgent({ model: agent.model, system: agentSystem(agent), input: agentInput(agent, files, sc.ask) });
      run.calls.agent++;
      run.costs.agent += Number(a.costUsd ?? 0);
      const text = a.ok ? String(a.text ?? "").trim() : "";
      const entry = { ...sc, answer: text || null, ms: a.ms ?? null, results: [] };
      if (!text) {
        entry.error = `the agent gave no answer: ${a.ok ? "empty answer" : a.error}`;
        entry.results = failAll(sc.lines, entry.error);
      } else {
        progress(`${agent.name} ${sc.id}/${of} ${sc.title}: judging with ${judgeModel}`);
        try {
          const j = await judgeScenario({ scenario: sc, answer: text, model: judgeModel, ask: judgeAsk });
          entry.results = j.results;
          run.costs.judge += Number(j.costUsd ?? 0);
        } catch (error) {
          entry.error = `the judge gave no answer: ${error.message}`;
          entry.results = failAll(sc.lines, entry.error);
        }
      }
      entry.pass = entry.results.length > 0 && entry.results.every((r) => r.pass);
      run.scenarios.push(entry);
    }
    run.finished = now().toISOString();
    runs.push(run);
  }
  return { id, which, runs, skipped };
}

export const passed = (result) => result.runs.every((r) => r.scenarios.every((s) => s.pass));

// ---- the report and the summary --------------------------------------------------------------

const one = (s, n) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const fence = (text) => `~~~~text\n${String(text ?? "").replace(/~~~~/g, "~ ~ ~ ~")}\n~~~~`;
const usd = (n) => `$${Number(n || 0).toFixed(4)}`;
const cell = (x) => one(x, 300).replace(/\|/g, "\\|");
const lineLabel = (l) => `${l.kind === "never" ? "Never" : "Expect"}: ${l.text}`;

export function reportPath(root, run) {
  const stamp = run.started.slice(0, 16).replace("T", "-").replace(":", "");
  return join(root, run.home, "reports", `${stamp}-scenarios-${run.id}.md`);
}

export function writeReport(root, run) {
  const ok = run.scenarios.filter((s) => s.pass).length;
  const a = run.auth ?? {};
  const out = [];
  out.push(`# Scenario check: ${run.name} · ${ok} of ${run.scenarios.length} passed`, "");
  out.push(`- Run \`${run.id}\` (\`scripts/scenario-check.mjs ${run.which}\`), ${run.started} to ${run.finished} (UTC).`);
  out.push(`- Domain Agent \`${run.name}\` on \`${run.model}\` (the model: line of \`${run.home}/agent.md\`), owns ${run.owns.map((o) => `\`${o}\``).join(", ")}. One fresh fenced \`claude -p\` per scenario: no tools, no MCP servers, no CLAUDE.md, no saved session, an empty folder; its Job as the system prompt, its owned paths, \`glossary.md\` and \`memories.md\` given in full, then the Ask. It never saw \`scenarios.md\`, \`expectations.md\`, the reports or the code.`);
  out.push(`- Judge \`${run.judgeModel}\`: a fenced \`claude -p\` with no tools and a JSON answer. It saw the title, the Ask, the lines without Expect or Never, and the answer; code checked its quotes against the answer and made the verdicts.`);
  out.push(`- Signed in with \`${a.authMethod ?? "?"}\`${a.subscriptionType ? `, plan \`${a.subscriptionType}\`` : ""}${a.apiProvider ? `, provider \`${a.apiProvider}\`` : ""} (\`claude auth status\`). \`ANTHROPIC_API_KEY\`, \`ANTHROPIC_AUTH_TOKEN\` and the Bedrock, Vertex and Foundry switches were removed from every call.`);
  out.push(`- Files as read at the start (sha256, first 12 hex digits): ${FILES.map((f) => `\`${f}\` ${run.files[f] ? `\`${run.files[f]}\`` : "missing"}`).join(", ")}.`);
  out.push(`- Model cost estimates, computed by Claude Code at list price, not a charge: Domain Agent ${usd(run.costs.agent)} over ${run.calls.agent} call(s), judge ${usd(run.costs.judge)} over ${run.calls.judge} call(s).`);
  out.push("", "## Result", "", "| | Scenario | Line | Quote | Why |", "|---|---|---|---|---|");
  for (const s of run.scenarios) {
    for (const r of s.results) out.push(`| ${r.pass ? "✓" : "✗"} | ${s.id} ${cell(s.title)} | ${cell(lineLabel(r.line))} | ${r.quote ? `"${cell(r.quote)}"` : "-"} | ${cell(r.reason)} |`);
  }
  for (const s of run.scenarios) {
    out.push("", `## ${s.id}. ${s.title} · ${s.pass ? "passed" : "failed"}`, "");
    out.push(`Ask (scenarios.md line ${s.askLine}): ${s.ask}`, "");
    if (s.answer) out.push(`The answer (${run.model}${s.ms ? `, ${(s.ms / 1000).toFixed(1)} s` : ""}):`, "", fence(s.answer));
    else out.push(`No answer: ${s.error}`);
  }
  const file = reportPath(root, run);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${out.join("\n")}\n`);
  return file;
}

export function summary(root, result, files) {
  const all = result.runs.flatMap((r) => r.scenarios);
  const lines = [`scenario check ${result.which} · ${all.filter((s) => s.pass).length} of ${all.length} passed · run ${result.id}`];
  result.runs.forEach((run, i) => {
    for (const s of run.scenarios) {
      lines.push(one(`${s.pass ? "✓" : "✗"} ${run.name} ${s.id} ${s.title}`, 160));
      if (s.pass) continue;
      for (const r of s.results.filter((x) => !x.pass)) {
        const why = r.quote && !r.refused ? `"${one(r.quote, 60)}"` : one(r.reason, 70);
        lines.push(`  ${one(`✗ ${one(lineLabel(r.line), 80)} · ${why}`, 158)}`);
      }
    }
    lines.push(`report ${relative(root, files[i])}`);
  });
  for (const name of result.skipped) lines.push(`skipped: ${name} (no scenarios.md)`);
  return lines.join("\n");
}

// ---- the command -----------------------------------------------------------------------------

const USAGE = "usage: node scripts/scenario-check.mjs <agent>|all [--judge-model <model>]";

export async function main(argv, { root = ROOT, out = process.stdout, err = process.stderr, deps = {} } = {}) {
  const names = [];
  let judgeModel = "sonnet";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      out.write(`${USAGE}\n`);
      return 0;
    }
    if (a === "--judge-model") {
      const v = argv[++i];
      if (!v || !MODEL.test(v)) {
        err.write(`scenario-check: --judge-model: "${v ?? ""}" is not a model name. Send a name such as sonnet or haiku.\n`);
        return 2;
      }
      judgeModel = v;
    } else if (a.startsWith("-")) {
      err.write(`scenario-check: ${a}: not an option. ${USAGE}\n`);
      return 2;
    } else names.push(a);
  }
  if (names.length !== 1) {
    err.write(`scenario-check: name one Domain Agent or all, e.g. booking. ${USAGE}\n`);
    return 2;
  }
  try {
    const result = await checkScenarios({ root, which: names[0], judgeModel, progress: (l) => err.write(`scenario-check: ${l}\n`), ...deps });
    const files = result.runs.map((run) => writeReport(root, run));
    out.write(`${summary(root, result, files)}\n`);
    return passed(result) ? 0 : 1;
  } catch (error) {
    err.write(`scenario-check: ${error instanceof CheckError ? error.message : `broke: ${error.stack}`}\n`);
    return error instanceof CheckError ? 2 : 3;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main(process.argv.slice(2));
