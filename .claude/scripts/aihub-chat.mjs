#!/usr/bin/env node
/**
 * aihub-chat.mjs — Single-Shot-Brücke zum adesso AI Hub (OpenAI-kompatibel).
 *
 * Muster: Aufgabe zuteilen → Output ernten. Kein Agent-Loop, ein Request.
 *
 * Aufruf:
 *   node .claude/scripts/aihub-chat.mjs --model deepseek-v4-flash-sovereign "PROMPT"
 *   cat brief.md | node .claude/scripts/aihub-chat.mjs --model qwen-3.6-35b-sovereign
 *
 * Optionen:
 *   --model <id>       Pflicht. Modell-ID laut ~/.claude/models.json bzw. GET /v1/models
 *   --system "<text>"  Optionale System-Instruktion
 *   --max-tokens <n>   Default 8000
 *   --thinking         Qwen-Reasoning AN lassen (Default: reasoning_effort=none bei qwen-*)
 *   --list-models      Gibt die aktuell freigeschalteten souveränen Modell-IDs aus und
 *                      beendet sich. Die Freischaltung ändert sich ohne Ankündigung —
 *                      deshalb wird hier nie eine Liste gepflegt, sondern immer die
 *                      lebende abgefragt.
 *   --all              Nur mit --list-models: zeigt auch die nicht-souveränen Modelle.
 *   --allow-non-sovereign
 *                      Hebt die Souveränitäts-Sperre für EINEN Aufruf auf. Ohne dieses
 *                      Flag lehnt das Skript jedes Modell ohne "-sovereign"-Suffix ab.
 *                      Grund: Vorgabe des Projekts ist, nur EU-souveräne Modelle zu nutzen;
 *                      eine Vorgabe, die nur in einer Notiz steht, wird irgendwann gebrochen.
 *
 * Konfiguration (Key + baseURL): ~/.claude/models.json, Provider "adesso-ai-hub".
 * Der Key wird niemals ausgegeben.
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function fail(msg) {
  process.stderr.write(`aihub-chat: ${msg}\n`);
  process.exit(1);
}

/** Souveräne Modelle tragen beim Hub das Suffix "-sovereign". */
const SOVEREIGN = /-sovereign$/;

// --- Args ---
const args = process.argv.slice(2);
const opts = { maxTokens: 8000, thinking: false, system: null, model: null, listModels: false, all: false, allowNonSovereign: false };
const positional = [];
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--model': opts.model = args[++i]; break;
    case '--system': opts.system = args[++i]; break;
    case '--max-tokens': opts.maxTokens = Number(args[++i]); break;
    case '--thinking': opts.thinking = true; break;
    case '--list-models': opts.listModels = true; break;
    case '--all': opts.all = true; break;
    case '--allow-non-sovereign': opts.allowNonSovereign = true; break;
    default: positional.push(args[i]);
  }
}
let prompt = '';
if (!opts.listModels) {
  if (!opts.model) fail('--model <id> ist Pflicht');
  if (!SOVEREIGN.test(opts.model) && !opts.allowNonSovereign) {
    fail(
      `"${opts.model}" ist kein souveränes Modell. Projektvorgabe: nur EU-souveräne Modelle ` +
      '(Suffix "-sovereign"). Verfügbare mit --list-models anzeigen. ' +
      'Bewusste Ausnahme: --allow-non-sovereign.'
    );
  }
  if (!Number.isFinite(opts.maxTokens) || opts.maxTokens <= 0) fail('--max-tokens muss eine positive Zahl sein');
  prompt = positional.join(' ').trim();
  if (!prompt) {
    prompt = readFileSync(0, 'utf8').trim(); // stdin
  }
  if (!prompt) fail('kein Prompt (Argument oder stdin)');
}

// --- Config ---
let provider;
try {
  const cfg = JSON.parse(readFileSync(join(homedir(), '.claude', 'models.json'), 'utf8'));
  provider = (cfg.providers ?? []).find((p) => p.name === 'adesso-ai-hub');
} catch (e) {
  fail(`~/.claude/models.json nicht lesbar: ${e.message}`);
}
if (!provider?.baseURL || !provider?.apiKey) fail('Provider "adesso-ai-hub" ohne baseURL/apiKey in ~/.claude/models.json');

// --- Modell-Liste ---
// Bewusst vor dem Request: Wer wissen will, was es gibt, braucht kein Modell zu nennen.
if (opts.listModels) {
  const res = await fetch(`${provider.baseURL.replace(/\/$/, '')}/models`, {
    headers: { Authorization: `Bearer ${provider.apiKey}` },
  });
  if (!res.ok) fail(`HTTP ${res.status} beim Abruf von /models`);
  const list = await res.json();
  const all = (list.data ?? []).map((m) => m.id).filter(Boolean).sort();
  if (all.length === 0) fail('/models lieferte keine Modell-IDs');
  const ids = opts.all ? all : all.filter((id) => SOVEREIGN.test(id));
  process.stdout.write(ids.join('\n') + '\n');
  if (!opts.all) {
    const hidden = all.length - ids.length;
    process.stderr.write(`(${ids.length} souverän, ${hidden} weitere ausgeblendet — mit --all sichtbar)\n`);
  }
  process.exit(0);
}

// --- Request ---
const messages = [];
if (opts.system) messages.push({ role: 'system', content: opts.system });
messages.push({ role: 'user', content: prompt });

const body = { model: opts.model, max_tokens: opts.maxTokens, messages };
// Qwen 3.x denkt per Default; top-level enable_thinking:false wird vom Proxy ignoriert —
// reasoning_effort ist der zuverlässige Schalter (verprobt 2026-07-14).
if (/^qwen/i.test(opts.model) && !opts.thinking) body.reasoning_effort = 'none';

const res = await fetch(`${provider.baseURL}/chat/completions`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).catch((e) => fail(`Netzwerkfehler: ${e.message}`));

const text = await res.text();
if (!res.ok) {
  let detail = text.slice(0, 400);
  try { detail = JSON.stringify(JSON.parse(text).error).slice(0, 400); } catch { /* raw */ }
  fail(`HTTP ${res.status}: ${detail}`);
}

let json;
try { json = JSON.parse(text); } catch { fail(`Antwort kein JSON: ${text.slice(0, 200)}`); }

const choice = json.choices?.[0];
const content = choice?.message?.content;
if (choice?.finish_reason === 'length') {
  const rLen = choice?.message?.reasoning_content?.length ?? 0;
  const cLen = content?.length ?? 0;
  fail(`Token-Budget erschöpft (finish_reason: length, content: ${cLen} Zeichen, reasoning_content: ${rLen} Zeichen) — Antwort ist abgeschnitten und unbrauchbar. max_tokens erhöhen oder Thinking abschalten.`);
}
if (content == null || content === '') fail(`leerer content (finish_reason: ${choice?.finish_reason ?? '?'})`);

process.stdout.write(content.trim() + '\n');
