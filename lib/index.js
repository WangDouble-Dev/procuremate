// src/storage.mjs
import { readFile, mkdir, open, rename, unlink } from "node:fs/promises";
import { join, dirname, isAbsolute, normalize } from "node:path";
import { homedir } from "node:os";
import { randomUUID, createHash } from "node:crypto";

// src/core.mjs
function validDate(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v || "")) return false;
  const d = /* @__PURE__ */ new Date(v + "T00:00:00Z");
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v;
}
function safeUrl(value) {
  try {
    let u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
var emptyData = () => ({ suppliers: [], prices: [], channels: [], rules: [] });
function validateData(d) {
  if (!d || typeof d !== "object") throw Error("\u8D44\u6599\u5FC5\u987B\u662F\u5BF9\u8C61");
  for (const key of ["suppliers", "prices", "channels", "rules"]) if (!Array.isArray(d[key]) || d[key].some((x) => !x || typeof x !== "object" || Array.isArray(x))) throw Error(`${key} \u5FC5\u987B\u662F\u8BB0\u5F55\u5217\u8868`);
  for (const key of ["suppliers", "prices", "channels", "rules"]) for (const record of d[key]) for (const [field, value] of Object.entries(record)) if (value !== null && !["string", "number", "boolean"].includes(typeof value)) throw Error(`${key}.${field} \u5FC5\u987B\u662F\u6587\u672C\u3001\u6570\u5B57\u6216\u5E03\u5C14\u503C`);
  for (const s of d.suppliers) if (!s.brand || !s.name) throw Error("\u4F9B\u8D27\u5546\u5FC5\u987B\u586B\u5199\u54C1\u724C\u548C\u540D\u79F0");
  for (const p of d.prices) if (!p.brand || !p.model || !p.unit || p.price === "" || !Number.isFinite(Number(p.price)) || Number(p.price) < 0) throw Error("\u4EF7\u683C\u5FC5\u987B\u586B\u5199\u54C1\u724C\u3001\u578B\u53F7\u3001\u5355\u4F4D\u548C\u975E\u8D1F\u5355\u4EF7");
  for (const c of d.channels) if (!c.brand || !safeUrl(c.url) || !c.source || !safeUrl(c.source) || !validDate(c.checkedAt)) throw Error("\u6E20\u9053\u5FC5\u987B\u586B\u5199\u54C1\u724C\u3001\u6709\u6548\u7F51\u5740\u3001\u6838\u5B9E\u6765\u6E90\u7F51\u5740\u548C\u6838\u5B9E\u65E5\u671F");
  for (const r of d.rules) if (!r.message || !["\u5168\u90E8", "\u5BFC\u5165", "\u8BE2\u4EF7", "\u56DE\u586B", "\u5BFC\u51FA"].includes(r.stage || "\u5168\u90E8")) throw Error("\u63D0\u9192\u5FC5\u987B\u586B\u5199\u5185\u5BB9\u548C\u6709\u6548\u573A\u666F");
  return d;
}

// src/storage.mjs
var DATA_FILE = "procurement-workbench.json";
var defaultConfigPath = () => join(homedir(), ".config", "dsh-procurement-workbench", "storage.json");
var defaultDirectory = () => join(homedir(), "buyer", "data");
var blankPayload = () => ({ version: 1, data: emptyData(), rows: [], history: [] });
function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}
function validatePayload(p) {
  if (!p || p.version !== 1 || !Array.isArray(p.rows) || !Array.isArray(p.history)) throw fail("\u6570\u636E\u6587\u4EF6\u683C\u5F0F\u4E0D\u6B63\u786E\uFF1A\u7F3A\u5C11\u8D44\u6599\u3001\u91C7\u8D2D\u660E\u7EC6\u6216\u8BE2\u4EF7\u8BB0\u5F55\u3002");
  validateData(p.data);
  if (p.rows.some((r) => !r || typeof r !== "object" || Array.isArray(r)) || p.history.some((r) => !r || typeof r !== "object" || Array.isArray(r))) throw fail("\u660E\u7EC6\u548C\u8BB0\u5F55\u5FC5\u987B\u662F\u5BF9\u8C61\u5217\u8868\u3002");
  if (JSON.stringify(p).length > 20 * 1024 * 1024) throw fail("\u8D44\u6599\u8D85\u8FC7 20 MB\uFF0C\u8BF7\u5148\u7CBE\u7B80\u5386\u53F2\u8BB0\u5F55\u3002", 413);
  return p;
}
function directoryPath(value) {
  if (typeof value !== "string" || !value.trim()) throw fail("\u8BF7\u586B\u5199\u7EDD\u5BF9\u76EE\u5F55\u8DEF\u5F84\u3002");
  const s = value.trim().replace(/^~(?=[/\\]|$)/, homedir());
  if (!isAbsolute(s)) throw fail("\u8BF7\u586B\u5199\u7EDD\u5BF9\u76EE\u5F55\u8DEF\u5F84\uFF0C\u4F8B\u5982 /Users/double/buyer/data/\u3002");
  return normalize(s);
}
async function readOptional(path) {
  try {
    return await readFile(path, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}
async function atomicWrite(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 448 });
  const temp = path + ".tmp-" + randomUUID();
  let handle;
  try {
    handle = await open(temp, "wx", 384);
    await handle.writeFile(JSON.stringify(value, null, 2) + "\n", "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temp, path);
  } finally {
    if (handle) await handle.close().catch(() => {
    });
    await unlink(temp).catch(() => {
    });
  }
}
function revision(directory, raw) {
  return createHash("sha256").update(directory + "\0" + (raw ?? "<missing>")).digest("hex");
}
function createStorage({ configPath = defaultConfigPath(), dataDir = defaultDirectory() } = {}) {
  configPath = normalize(configPath);
  dataDir = directoryPath(dataDir);
  const lockPath = configPath + ".lock";
  async function withLock(fn) {
    await mkdir(dirname(configPath), { recursive: true, mode: 448 });
    let handle;
    const token = randomUUID();
    for (let n = 0; n < 40; n++) {
      try {
        handle = await open(lockPath, "wx", 384);
        await handle.writeFile(JSON.stringify({ pid: process.pid, token }));
        break;
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
        const lock = await readOptional(lockPath);
        if (lock) {
          try {
            const owner = JSON.parse(lock);
            if (Number.isInteger(owner.pid) && owner.pid > 0) {
              try {
                process.kill(owner.pid, 0);
              } catch (error) {
                if (error.code === "ESRCH" && await readOptional(lockPath) === lock) await unlink(lockPath).catch(() => {
                });
              }
            }
          } catch {
          }
        }
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    if (!handle) throw fail("\u53E6\u4E00\u4E2A\u7A97\u53E3\u6B63\u5728\u4FDD\u5B58\uFF0C\u6216\u4E0A\u6B21\u5F02\u5E38\u9000\u51FA\u7559\u4E0B\u6587\u4EF6\u9501\u3002\u8BF7\u7A0D\u540E\u91CD\u8BD5\uFF1B\u82E5\u6301\u7EED\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5 " + lockPath, 409);
    try {
      return await fn();
    } finally {
      await handle.close();
      const raw = await readOptional(lockPath);
      if (raw) {
        try {
          if (JSON.parse(raw).token === token) await unlink(lockPath);
        } catch {
        }
      }
    }
  }
  async function activeDirectory() {
    const raw = await readOptional(configPath);
    if (raw === null) return dataDir;
    let config;
    try {
      config = JSON.parse(raw);
    } catch {
      throw fail("\u4FDD\u5B58\u76EE\u5F55\u8BBE\u7F6E\u635F\u574F\uFF0C\u8BF7\u68C0\u67E5 " + configPath);
    }
    return directoryPath(config.dataDir);
  }
  async function snapshot(directory) {
    const file = join(directory, DATA_FILE), raw = await readOptional(file);
    let payload = blankPayload();
    if (raw !== null) {
      try {
        payload = validatePayload(JSON.parse(raw));
      } catch (e) {
        throw fail("\u65E0\u6CD5\u8BFB\u53D6\u6570\u636E\u6587\u4EF6 " + file + "\uFF1A" + e.message);
      }
    }
    return { directory, file, configPath, exists: raw !== null, revision: revision(directory, raw), payload };
  }
  function expectRevision(current, expected) {
    if (current.revision !== expected) throw fail("\u8D44\u6599\u5DF2\u88AB\u5176\u4ED6\u7A97\u53E3\u4FEE\u6539\uFF0C\u6216\u4FDD\u5B58\u76EE\u5F55\u5DF2\u7ECF\u6539\u53D8\u3002\u5F53\u524D\u4FEE\u6539\u5C1A\u672A\u4FDD\u5B58\uFF0C\u8BF7\u5148\u5BFC\u51FA\u5F53\u524D\u8D44\u6599\uFF0C\u518D\u91CD\u65B0\u8F7D\u5165\u3002", 409);
  }
  return {
    read: () => withLock(async () => snapshot(await activeDirectory())),
    save: (payload, expected) => withLock(async () => {
      validatePayload(payload);
      const current = await snapshot(await activeDirectory());
      expectRevision(current, expected);
      await atomicWrite(current.file, payload);
      return snapshot(current.directory);
    }),
    changeDirectory: (requested, mode, expected) => withLock(async () => {
      if (!["copy", "open"].includes(mode)) throw fail("\u8BF7\u9009\u62E9\u590D\u5236\u5F53\u524D\u8D44\u6599\u6216\u4F7F\u7528\u76EE\u6807\u76EE\u5F55\u8D44\u6599\u3002");
      const directory = directoryPath(requested), current = await snapshot(await activeDirectory());
      expectRevision(current, expected);
      if (directory === current.directory) return current;
      const target = await snapshot(directory);
      if (mode === "copy" && target.exists) throw fail("\u76EE\u6807\u76EE\u5F55\u5DF2\u7ECF\u6709\u91C7\u8D2D\u8D44\u6599\uFF0C\u672A\u8986\u76D6\u3002\u8BF7\u6539\u9009\u300C\u4F7F\u7528\u76EE\u6807\u76EE\u5F55\u8D44\u6599\u300D\u6216\u9009\u62E9\u7A7A\u76EE\u5F55\u3002", 409);
      if (mode === "copy" || !target.exists) await atomicWrite(target.file, mode === "copy" ? current.payload : blankPayload());
      await atomicWrite(configPath, { version: 1, dataDir: directory });
      return snapshot(directory);
    })
  };
}
var API_PATH = "/procurement-workbench/api";
function checkRequest(req) {
  const host = new URL("http://" + (req.headers.host || "invalid")).hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) throw fail("\u91C7\u8D2D\u8D44\u6599\u63A5\u53E3\u4EC5\u4F9B\u672C\u673A\u4F7F\u7528\u3002", 403);
  const remote = req.socket?.remoteAddress;
  if (remote && !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote)) throw fail("\u91C7\u8D2D\u8D44\u6599\u63A5\u53E3\u4EC5\u4F9B\u672C\u673A\u4F7F\u7528\u3002", 403);
  if (req.headers["x-procurement-workbench"] !== "1") throw fail("\u8BF7\u6C42\u7F3A\u5C11\u5DE5\u4F5C\u53F0\u6807\u8BC6\u3002", 403);
  const origin = req.headers.origin;
  if (origin && origin !== "null") {
    let u;
    try {
      u = new URL(origin);
    } catch {
      throw fail("\u8BF7\u6C42\u6765\u6E90\u65E0\u6548\u3002", 403);
    }
    if (u.host !== req.headers.host || !["http:", "https:"].includes(u.protocol)) throw fail("\u8BF7\u6C42\u6765\u6E90\u4E0D\u5339\u914D\u3002", 403);
  }
}
async function bodyOf(req) {
  if (!String(req.headers["content-type"] || "").startsWith("application/json")) throw fail("\u8BF7\u6C42\u5185\u5BB9\u5FC5\u987B\u662F JSON\u3002", 415);
  let bytes = 0;
  const parts = [];
  for await (const part of req) {
    bytes += part.length;
    if (bytes > 24 * 1024 * 1024) throw fail("\u8BF7\u6C42\u8D85\u8FC7 24 MB\u3002", 413);
    parts.push(part);
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch {
    throw fail("JSON \u683C\u5F0F\u9519\u8BEF\u3002");
  }
}
function createStorageHandler(store) {
  return async (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      checkRequest(req);
      let result;
      if (req.method === "GET") result = await store.read();
      else if (req.method === "PUT") {
        const body = await bodyOf(req);
        result = await store.save(body.payload, body.revision);
      } else if (req.method === "POST") {
        const body = await bodyOf(req);
        result = await store.changeDirectory(body.directory, body.mode, body.revision);
      } else throw fail("\u4E0D\u652F\u6301\u6B64\u64CD\u4F5C\u3002", 405);
      res.writeHead(200).end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(e.status || 500).end(JSON.stringify({ error: e.code ? `\u6587\u4EF6\u64CD\u4F5C\u5931\u8D25\uFF08${e.code}\uFF09\uFF1A${e.message}` : e.message }));
    }
  };
}

// src/index.mjs
var name = "procurement-workbench";
var inject = ["webServer"];
function apply(ctx) {
  const handler = createStorageHandler(createStorage());
  ctx.effect(() => ctx.webServer.register({ kind: "exact", path: API_PATH, handler }));
}
export {
  apply,
  inject,
  name
};
