const fs = require('fs');
const path = require('path');
const { app, net, session } = require('electron');
const { PARTITION } = require('./config');

const LISTS = ['https://easylist.to/easylist/easylist.txt'];
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

const cacheFile = () => path.join(app.getPath('userData'), 'easylist.txt');

let block = new Set();
let allow = new Set();

const parse = (text) => {
  const block = new Set();
  const allow = new Set();
  for (const line of text.split('\n')) {
    const rule = line.trim();
    if (!rule || rule[0] === '!' || rule[0] === '[') continue;
    const exception = rule.startsWith('@@');
    const match = /^\|\|([^/^*|]+)\^/.exec(exception ? rule.slice(2) : rule);
    if (match) (exception ? allow : block).add(match[1].toLowerCase());
  }
  return { block, allow };
};

const inSet = (set, host) => {
  for (let h = host; h; h = h.slice(h.indexOf('.') + 1)) {
    if (set.has(h)) return true;
    if (h.indexOf('.') === -1) return false;
  }
  return false;
};

const isBlocked = (url) => {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  return !inSet(allow, host) && inSet(block, host);
};

const refresh = async () => {
  try {
    const texts = await Promise.all(LISTS.map(async (url) => {
      const res = await net.fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`${url} ${res.status}`);
      return res.text();
    }));
    const text = texts.join('\n');
    fs.writeFileSync(cacheFile(), text);
    ({ block, allow } = parse(text));
  } catch (err) {
    console.warn('[adblock] list update failed:', err.message);
  }
};

function setupAdBlock() {
  session
    .fromPartition(PARTITION)
    .webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
      callback({ cancel: isBlocked(details.url) });
    });

  let cached = null;
  let fresh = false;
  try {
    cached = fs.readFileSync(cacheFile(), 'utf8');
    fresh = Date.now() - fs.statSync(cacheFile()).mtimeMs < REFRESH_MS;
  } catch {}
  if (cached) ({ block, allow } = parse(cached));
  if (!fresh) refresh();
}

module.exports = { setupAdBlock };
