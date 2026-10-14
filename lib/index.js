import {createRequire as __createRequire} from 'node:module';const require=__createRequire(import.meta.url);

// src/workbook-writer.mjs
import { readFile } from "node:fs/promises";
import { extname, isAbsolute } from "node:path";
import { execFile as execFile2 } from "node:child_process";
import { promisify as promisify2 } from "node:util";

// src/platform-workbook.mjs
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { win32 } from "node:path";
var exec = promisify(execFile);
function powershellCommand(script, systemRoot = process.env.SystemRoot || "C:\\Windows") {
  return { file: win32.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), args: ["-NoProfile", "-NonInteractive", "-STA", "-EncodedCommand", Buffer.from("$ErrorActionPreference='Stop'; [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false);\n" + script, "utf16le").toString("base64")] };
}
async function runPowerShell(script, runner = exec) {
  const command = powershellCommand(script);
  try {
    const { stdout } = await runner(command.file, command.args, { timeout: 12e4, windowsHide: true, maxBuffer: 1024 * 1024, encoding: "utf8" });
    return stdout.replace(/^\uFEFF/, "").trim();
  } catch (e) {
    throw Error(e.killed ? "\u6587\u4EF6\u9009\u62E9\u7A97\u53E3\u672A\u54CD\u5E94\uFF0C\u8BF7\u91CD\u8BD5\u3002" : `Windows \u6587\u4EF6\u64CD\u4F5C\u5931\u8D25\uFF1A${e.stderr || e.message}`);
  }
}
var FILE_PICKER_SCRIPT = String.raw`Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = '选择要查看的采购表'
$dialog.Filter = '采购表 (*.xlsx;*.xls)|*.xlsx;*.xls'
$dialog.CheckFileExists = $true
$dialog.Multiselect = $false
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
try { if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Write($dialog.FileName) } } finally { $dialog.Dispose(); $owner.Dispose() }`;
async function chooseWorkbook({ platform = process.platform, apple: apple2, powerShell = runPowerShell } = {}) {
  let path;
  if (platform === "win32") path = await powerShell(FILE_PICKER_SCRIPT);
  else if (platform === "darwin") path = await apple2('try\n return POSIX path of (choose file with prompt "\u9009\u62E9\u8981\u67E5\u770B\u7684\u91C7\u8D2D\u8868")\n on error number -128\n return ""\nend try');
  else throw Error("\u5F53\u524D\u652F\u6301 Windows \u548C macOS \u672C\u673A\u9009\u62E9\u91C7\u8D2D\u8868\u3002");
  return path?.trim() || null;
}

// src/workbook-writer.mjs
var exec2 = promisify2(execFile2);
var apple = async (script) => {
  try {
    const { stdout } = await exec2("/usr/bin/osascript", ["-e", script], { timeout: 12e4 });
    return stdout.trim();
  } catch (e) {
    throw Error(e.killed ? "\u6587\u4EF6\u9009\u62E9\u7A97\u53E3\u672A\u54CD\u5E94\uFF0C\u8BF7\u91CD\u8BD5\u3002" : `\u6587\u4EF6\u9009\u62E9\u5931\u8D25\uFF1A${e.stderr || e.message}`);
  }
};
async function openWorkbook(path) {
  if (!path) path = await chooseWorkbook({ apple });
  if (!path) return { cancelled: true };
  if (!isAbsolute(path) || ![".xls", ".xlsx"].includes(extname(path).toLowerCase())) throw Error("\u8BF7\u9009\u62E9\u672C\u673A .xls \u6216 .xlsx \u6587\u4EF6");
  const bytes = await readFile(path);
  if (bytes.length > 20 * 1024 * 1024) throw Error("Excel \u8D85\u8FC7 20 MB");
  return { path, content: bytes.toString("base64") };
}

// src/storage.mjs
import { readFile as readFile2, mkdir, open, rename, unlink } from "node:fs/promises";
import { join, dirname, isAbsolute as isAbsolute2, normalize } from "node:path";
import { homedir } from "node:os";
import { randomUUID, createHash } from "node:crypto";

// src/destination.mjs
var regions = {
  "\u5317\u4EAC\u5E02": "\u5317\u4EAC",
  "\u5929\u6D25\u5E02": "\u5929\u6D25",
  "\u4E0A\u6D77\u5E02": "\u4E0A\u6D77",
  "\u91CD\u5E86\u5E02": "\u91CD\u5E86",
  "\u6CB3\u5317\u7701": "\u6CB3\u5317|\u77F3\u5BB6\u5E84|\u5510\u5C71|\u4FDD\u5B9A|\u5F20\u5BB6\u53E3",
  "\u5C71\u897F\u7701": "\u5C71\u897F|\u592A\u539F|\u664B\u4E2D",
  "\u8FBD\u5B81\u7701": "\u8FBD\u5B81|\u6C88\u9633|\u5927\u8FDE",
  "\u5409\u6797\u7701": "\u5409\u6797|\u957F\u6625",
  "\u9ED1\u9F99\u6C5F\u7701": "\u9ED1\u9F99\u6C5F|\u54C8\u5C14\u6EE8|\u5927\u5E86",
  "\u6C5F\u82CF\u7701": "\u6C5F\u82CF|\u5357\u4EAC|\u82CF\u5DDE|\u65E0\u9521|\u5E38\u5DDE|\u5F90\u5DDE|\u5357\u901A|\u76D0\u57CE",
  "\u6D59\u6C5F\u7701": "\u6D59\u6C5F|\u676D\u5DDE|\u5B81\u6CE2|\u6E29\u5DDE|\u53F0\u5DDE|\u91D1\u534E|\u4E49\u4E4C|\u5609\u5174|\u7ECD\u5174|\u6E56\u5DDE",
  "\u5B89\u5FBD\u7701": "\u5B89\u5FBD|\u5408\u80A5|\u829C\u6E56|\u9A6C\u978D\u5C71",
  "\u798F\u5EFA\u7701": "\u798F\u5EFA|\u798F\u5DDE|\u53A6\u95E8|\u6CC9\u5DDE",
  "\u6C5F\u897F\u7701": "\u6C5F\u897F|\u5357\u660C|\u4E0A\u9976|\u8D63\u5DDE",
  "\u5C71\u4E1C\u7701": "\u5C71\u4E1C|\u6D4E\u5357|\u9752\u5C9B|\u6D4E\u5B81|\u70DF\u53F0|\u6DC4\u535A|\u6F4D\u574A",
  "\u6CB3\u5357\u7701": "\u6CB3\u5357|\u90D1\u5DDE|\u6D1B\u9633|\u5F00\u5C01",
  "\u6E56\u5317\u7701": "\u6E56\u5317|\u6B66\u6C49|\u8944\u9633|\u5B9C\u660C|\u5341\u5830|\u8346\u95E8",
  "\u6E56\u5357\u7701": "\u6E56\u5357|\u957F\u6C99|\u6E58\u6F6D|\u682A\u6D32",
  "\u5E7F\u4E1C\u7701": "\u5E7F\u4E1C|\u5E7F\u5DDE|\u6DF1\u5733|\u4F5B\u5C71|\u4E1C\u839E|\u73E0\u6D77|\u60E0\u5DDE",
  "\u6D77\u5357\u7701": "\u6D77\u5357|\u6D77\u53E3|\u4E09\u4E9A",
  "\u56DB\u5DDD\u7701": "\u56DB\u5DDD|\u6210\u90FD|\u7EF5\u9633|\u5357\u5145|\u5B9C\u5BBE",
  "\u8D35\u5DDE\u7701": "\u8D35\u5DDE|\u8D35\u9633",
  "\u4E91\u5357\u7701": "\u4E91\u5357|\u6606\u660E",
  "\u9655\u897F\u7701": "\u9655\u897F|\u897F\u5B89|\u5B9D\u9E21|\u54B8\u9633",
  "\u7518\u8083\u7701": "\u7518\u8083|\u5170\u5DDE",
  "\u9752\u6D77\u7701": "\u9752\u6D77|\u897F\u5B81",
  "\u5185\u8499\u53E4\u81EA\u6CBB\u533A": "\u5185\u8499\u53E4|\u547C\u548C\u6D69\u7279|\u5305\u5934",
  "\u5E7F\u897F\u58EE\u65CF\u81EA\u6CBB\u533A": "\u5E7F\u897F|\u5357\u5B81|\u67F3\u5DDE|\u6842\u6797",
  "\u897F\u85CF\u81EA\u6CBB\u533A": "\u897F\u85CF|\u62C9\u8428",
  "\u5B81\u590F\u56DE\u65CF\u81EA\u6CBB\u533A": "\u5B81\u590F|\u94F6\u5DDD",
  "\u65B0\u7586\u7EF4\u543E\u5C14\u81EA\u6CBB\u533A": "\u65B0\u7586|\u4E4C\u9C81\u6728\u9F50",
  "\u9999\u6E2F\u7279\u522B\u884C\u653F\u533A": "\u9999\u6E2F",
  "\u6FB3\u95E8\u7279\u522B\u884C\u653F\u533A": "\u6FB3\u95E8",
  "\u53F0\u6E7E\u7701": "\u53F0\u6E7E|\u53F0\u5317"
};
var provinceOptions = Object.keys(regions);
var normalizeCompany = (value) => String(value || "").normalize("NFKC").replace(/\s/g, "");

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
var emptyData = () => ({ suppliers: [], prices: [], channels: [], rules: [], companies: [] });
function validateData(d) {
  if (!d || typeof d !== "object") throw Error("\u8D44\u6599\u5FC5\u987B\u662F\u5BF9\u8C61");
  for (const key of ["suppliers", "prices", "channels", "rules"]) if (!Array.isArray(d[key]) || d[key].some((x) => !x || typeof x !== "object" || Array.isArray(x))) throw Error(`${key} \u5FC5\u987B\u662F\u8BB0\u5F55\u5217\u8868`);
  for (const key of ["suppliers", "prices", "channels", "rules"]) for (const record of d[key]) for (const [field, value] of Object.entries(record)) if (value !== null && !["string", "number", "boolean"].includes(typeof value)) throw Error(`${key}.${field} \u5FC5\u987B\u662F\u6587\u672C\u3001\u6570\u5B57\u6216\u5E03\u5C14\u503C`);
  if (d.companies !== void 0) {
    if (!Array.isArray(d.companies)) throw Error("\u516C\u53F8\u7701\u4EFD\u5FC5\u987B\u662F\u8BB0\u5F55\u5217\u8868");
    const names = /* @__PURE__ */ new Set();
    for (const c of d.companies) {
      if (!c || typeof c.company !== "string" || !normalizeCompany(c.company)) throw Error("\u516C\u53F8\u7701\u4EFD\u5FC5\u987B\u586B\u5199\u9700\u6C42\u516C\u53F8");
      if (!provinceOptions.includes(c.province)) throw Error("\u8BF7\u9009\u62E9\u6709\u6548\u7684\u53D1\u5F80\u7701\u4EFD");
      const name2 = normalizeCompany(c.company);
      if (names.has(name2)) throw Error("\u540C\u4E00\u9700\u6C42\u516C\u53F8\u53EA\u80FD\u914D\u7F6E\u4E00\u6761\u7701\u4EFD\u8BB0\u5F55\uFF0C\u8BF7\u7F16\u8F91\u5DF2\u6709\u8BB0\u5F55");
      names.add(name2);
      for (const value of Object.values(c)) if (value !== null && !["string", "number", "boolean"].includes(typeof value)) throw Error("\u516C\u53F8\u7701\u4EFD\u5B57\u6BB5\u5FC5\u987B\u662F\u6587\u672C\u3001\u6570\u5B57\u6216\u5E03\u5C14\u503C");
    }
  }
  for (const s of d.suppliers) {
    if (!String(s.brand || "").trim()) throw Error("\u4F9B\u8D27\u5546\u8D44\u6599\u5FC5\u987B\u586B\u5199\u54C1\u724C");
    if (s.url && !safeUrl(s.url)) throw Error("\u4F9B\u8D27\u5546\u5E97\u94FA\u7F51\u5740\u5FC5\u987B\u662F\u6709\u6548\u7684 http \u6216 https \u94FE\u63A5");
  }
  for (const p of d.prices) if (!p.brand || !p.model || !p.unit || p.price === "" || !Number.isFinite(Number(p.price)) || Number(p.price) < 0) throw Error("\u4EF7\u683C\u5FC5\u987B\u586B\u5199\u54C1\u724C\u3001\u578B\u53F7\u3001\u5355\u4F4D\u548C\u975E\u8D1F\u5355\u4EF7");
  for (const c of d.channels) if (!c.brand || !safeUrl(c.url) || !c.source || !safeUrl(c.source) || !validDate(c.checkedAt)) throw Error("\u6E20\u9053\u5FC5\u987B\u586B\u5199\u54C1\u724C\u3001\u6709\u6548\u7F51\u5740\u3001\u6838\u5B9E\u6765\u6E90\u7F51\u5740\u548C\u6838\u5B9E\u65E5\u671F");
  for (const r of d.rules) if (!r.message) throw Error("\u63D0\u9192\u5FC5\u987B\u586B\u5199\u5185\u5BB9");
  return d;
}

// src/storage.mjs
var DATA_FILE = "procurement-workbench.json";
var defaultConfigPath = () => join(homedir(), ".config", "dsh-procurement-workbench", "storage.json");
var defaultDirectory = () => join(homedir(), "buyer", "data");
var blankPayload = () => ({ version: 1, data: emptyData() });
function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}
function validatePayload(p) {
  if (!p || p.version !== 1) throw fail("\u6570\u636E\u6587\u4EF6\u683C\u5F0F\u4E0D\u6B63\u786E\uFF1A\u7F3A\u5C11\u8D44\u6599\u6216\u91C7\u8D2D\u660E\u7EC6\u3002");
  validateData(p.data);
  if (JSON.stringify(p).length > 20 * 1024 * 1024) throw fail("\u8D44\u6599\u8D85\u8FC7 20 MB\uFF0C\u8BF7\u5148\u7CBE\u7B80\u8D44\u6599\u3002", 413);
  return { version: 1, data: p.data };
}
function directoryPath(value) {
  if (typeof value !== "string" || !value.trim()) throw fail("\u8BF7\u586B\u5199\u7EDD\u5BF9\u76EE\u5F55\u8DEF\u5F84\u3002");
  const s = value.trim().replace(/^~(?=[/\\]|$)/, homedir());
  if (!isAbsolute2(s)) throw fail("\u8BF7\u586B\u5199\u672C\u673A\u7EDD\u5BF9\u76EE\u5F55\u8DEF\u5F84\uFF0C\u4F8B\u5982 Windows \u7684 D:\\\u91C7\u8D2D\u8D44\u6599 \u6216 macOS \u7684 /Users/\u7528\u6237\u540D/buyer/data\u3002");
  return normalize(s);
}
async function readOptional(path) {
  try {
    return await readFile2(path, "utf8");
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
      payload = validatePayload(payload);
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
      if (req.method === "GET") result = { ...await store.read(), capabilities: { openExcel: true, saveExcel: false }, apiVersion: 2 };
      else if (req.method === "PUT") {
        const body = await bodyOf(req);
        result = await store.save(body.payload, body.revision);
      } else if (req.method === "POST") {
        const body = await bodyOf(req);
        if (body.action === "openExcel") result = await openWorkbook(body.path);
        else if (body.action === "saveExcel") throw fail("\u91C7\u8D2D\u8868\u4E3A\u53EA\u8BFB\u6A21\u5F0F\uFF0C\u4E0D\u652F\u6301\u4FDD\u5B58\u6216\u4FEE\u6539\u539F Excel\u3002", 405);
        else if (!body.action && ["copy", "open"].includes(body.mode)) result = await store.changeDirectory(body.directory, body.mode, body.revision);
        else throw fail("\u65E0\u6CD5\u8BC6\u522B\u6B64\u64CD\u4F5C\uFF0C\u8BF7\u66F4\u65B0\u63D2\u4EF6\u5E76\u91CD\u542F DeepSeek Harness\u3002");
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
