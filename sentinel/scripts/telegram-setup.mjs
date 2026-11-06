#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const root = new URL('../../', import.meta.url);

// Telegram API: https://core.telegram.org/bots/api#getupdates
export async function setupTelegram({
  envPath = new URL('.env', root),
  configPath = new URL('sentinel/hexfence-sentinel/config.json', root),
  examplePath = new URL('sentinel/hexfence-sentinel/config.example.json', root),
  apiBase = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org',
} = {}) {
  let env;
  try { env = await readFile(envPath, 'utf8'); }
  catch { throw Error('Cannot read root .env. Add TELEGRAM_BOT_TOKEN_ALL there, then rerun.'); }
  const line = env.split(/\r?\n/).find(line => /^\s*(?:export\s+)?TELEGRAM_BOT_TOKEN_ALL\s*=/.test(line));
  let token = line?.slice(line.indexOf('=') + 1).trim() || '';
  if (token.startsWith('"') || token.startsWith("'")) {
    const end = token.indexOf(token[0], 1);
    token = end > 0 ? token.slice(1, end) : '';
  } else token = token.replace(/\s+#.*$/, '').trim();
  if (!token) throw Error('TELEGRAM_BOT_TOKEN_ALL is missing or empty in root .env. Add it, message the bot, then rerun.');
  if (!/^[A-Za-z0-9_:-]+$/.test(token)) throw Error('The bot token format in root .env is invalid.');
  let base;
  try { base = new URL(apiBase); } catch { throw Error('Invalid TELEGRAM_API_BASE.'); }
  if (base.username || base.password || base.search || base.hash ||
      !((base.origin === 'https://api.telegram.org' && base.pathname === '/') ||
        (base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)))) {
    throw Error('TELEGRAM_API_BASE must be the official HTTPS API or a local HTTP test server.');
  }
  async function call(method, body = {}) {
    try {
      const response = await fetch(base.href.replace(/\/$/, '') + '/bot' + token + '/' + method, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000), redirect: 'error',
      });
      const data = await response.json();
      if (!response.ok || data.ok !== true) {
        if (data.error_code === 409) throw Error('conflict');
        throw Error('rejected');
      }
      return data.result;
    } catch (error) {
      // Never expose fetch errors or Telegram response bodies: either can contain credentials.
      if (error.message === 'conflict') throw Error('Telegram updates conflict: stop other polling or check the bot webhook, then rerun.');
      throw Error('Telegram ' + method + ' failed. Check the token, network and bot settings, then rerun.');
    }
  }
  const me = await call('getMe');
  if (!me?.is_bot) throw Error('Telegram getMe did not return a bot.');
  let newest, offset;
  for (;;) {
    const updates = await call('getUpdates', { limit: 100, timeout: 0, allowed_updates: ['message'], ...(offset === undefined ? {} : { offset }) });
    if (!Array.isArray(updates)) throw Error('Telegram returned an invalid updates list.');
    for (const update of updates) {
      const message = update.message;
      if (message?.from && !message.from.is_bot && Number.isSafeInteger(message.chat?.id) && Number.isFinite(message.date)) {
        if (!newest || message.date > newest.message.date || (message.date === newest.message.date && update.update_id > newest.update_id)) newest = update;
      }
    }
    if (updates.length < 100) break;
    const next = Math.max(...updates.map(u => u.update_id)) + 1;
    if (!Number.isSafeInteger(next) || (offset !== undefined && next <= offset)) throw Error('Telegram returned invalid update identifiers.');
    offset = next;
  }
  if (!newest) throw Error('No incoming messages found. Send a new message to the bot in Telegram, then rerun. Pending updates may have expired or been read elsewhere.');
  let config;
  try { config = JSON.parse(await readFile(configPath, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw Error('Cannot read config.json; check that it contains valid JSON.');
    config = JSON.parse(await readFile(examplePath, 'utf8'));
  }
  config.telegram = { ...config.telegram, enabled: true, chatId: String(newest.message.chat.id) };
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
  await call('sendMessage', { chat_id: config.telegram.chatId, text: 'HexFence Sentinel setup test. This is a setup message, not a poisoning alert.' });
  return 'Telegram enabled in config.json; Telegram accepted one setup test message.';
}

if (globalThis.process?.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  setupTelegram().then(message => console.log(message)).catch(error => {
    // Only deliberate, credential-free errors are shown.
    const known = /^(Cannot read root|TELEGRAM_BOT_TOKEN_ALL|The bot token|Invalid TELEGRAM_API_BASE|TELEGRAM_API_BASE|Telegram |No incoming|Cannot read config)/;
    console.error(known.test(error.message) ? error.message : 'Setup failed while reading or writing local configuration.');
    process.exitCode = 1;
  });
}
