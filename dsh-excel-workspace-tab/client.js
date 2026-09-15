window.__ModuleLoader__.load({
  id: "dsh-excel-workspace-tab",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    const React = require("react");

    const PANEL_ID = "excel-workspace";
    const EXTENSIONS = /\.(xlsx|xls|xlsm|xlsb)$/i;
    const BATCH_SIZE = 6;

    function isExcel(name) {
      return !name.startsWith("~$") && EXTENSIONS.test(name);
    }

    function childPath(parent, name) {
      return `${parent.replace(/[/\\]+$/, "")}/${name}`;
    }

    function describeError(error) {
      if (typeof error?.message === "string") return error.message;
      if (typeof error?.code === "string") return error.code;
      return "读取失败";
    }

    async function scanExcelFiles(list, sessionId, root, signal, onProgress = () => {}) {
      const queue = [{ absolute: root, relative: "" }];
      const files = [];
      const errors = [];
      let index = 0;
      let truncated = false;

      while (index < queue.length) {
        if (signal.aborted) throw new DOMException("扫描已取消", "AbortError");
        const batch = queue.slice(index, index + BATCH_SIZE);
        index += batch.length;
        const results = await Promise.all(batch.map(async (directory) => {
          try {
            return await list(sessionId, directory.absolute, signal);
          } catch (error) {
            if (signal.aborted) throw error;
            return { ok: false, error };
          }
        }));

        for (let position = 0; position < batch.length; position += 1) {
          const directory = batch[position];
          const result = results[position];
          if (!result.ok) {
            errors.push({ path: directory.relative || ".", reason: describeError(result.error) });
            continue;
          }
          truncated ||= result.value.truncated === true;
          for (const entry of result.value.entries) {
            const relative = directory.relative ? `${directory.relative}/${entry.name}` : entry.name;
            if (entry.type === "directory") {
              queue.push({ absolute: childPath(directory.absolute, entry.name), relative });
            } else if (entry.type === "file" && isExcel(entry.name)) {
              files.push({ name: entry.name, relative, size: entry.size });
            }
          }
        }
        onProgress({ directories: index, found: files.length });
      }

      files.sort((a, b) => a.relative.localeCompare(b.relative, "zh-CN", { numeric: true }));
      return { files, directories: index, errors, truncated };
    }

    function ExcelGlyph({ size = 18, active = false }) {
      return React.createElement("span", {
        "data-state": active ? "active" : "idle",
        style: {
          width: size + 8, height: size + 8, margin: -4, borderRadius: 6,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: active ? "#236b59" : "transparent",
          color: active ? "#fff" : "currentColor",
          boxShadow: active ? "0 0 0 2px rgba(35,107,89,.28)" : "none",
          transition: "background-color .15s ease, color .15s ease, box-shadow .15s ease"
        }
      }, React.createElement("svg", {
        width: size, height: size, viewBox: "0 0 20 20", fill: "none",
        stroke: "currentColor", strokeWidth: active ? 1.8 : 1.5, strokeLinecap: "round",
        strokeLinejoin: "round", "aria-hidden": "true", style: { opacity: active ? 1 : .78 }
      },
        React.createElement("rect", { x: 3, y: 2.5, width: 14, height: 15, rx: 2 }),
        React.createElement("path", { d: "M3.5 7.5h13M8 7.5v9.5M8 12h8.5" })
      ));
    }

    function formatSize(bytes) {
      if (typeof bytes !== "number") return "";
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function ExcelPanel({ useSessions, scan }) {
      const sessionId = useSessions((snapshot) => snapshot.current);
      const cwd = useSessions((snapshot) =>
        snapshot.current === undefined ? undefined : snapshot.byId[snapshot.current]?.cwd
      );
      const [refresh, setRefresh] = React.useState(0);
      const [state, setState] = React.useState({ status: "idle", files: [], errors: [], truncated: false });

      React.useEffect(() => {
        if (!sessionId || !cwd) {
          setState({ status: "idle", files: [], errors: [], truncated: false });
          return;
        }
        const controller = new AbortController();
        setState({ status: "loading", files: [], errors: [], truncated: false, directories: 0, found: 0 });
        scan(sessionId, cwd, controller.signal, (progress) => {
          if (!controller.signal.aborted) setState((previous) => ({ ...previous, ...progress }));
        }).then((result) => {
          if (!controller.signal.aborted) setState({ status: "ready", ...result });
        }).catch((error) => {
          if (!controller.signal.aborted) setState({ status: "error", files: [], errors: [], truncated: false, reason: describeError(error) });
        });
        return () => controller.abort();
      }, [sessionId, cwd, refresh, scan]);

      const h = React.createElement;
      const rootName = cwd?.split(/[/\\]/).filter(Boolean).at(-1) || "工作区";
      return h("section", { className: "dsh-excel-panel", "aria-label": "Excel 表格" },
        h("header", { className: "dsh-excel-header" },
          h("div", { className: "dsh-excel-heading" },
            h("span", { className: "dsh-excel-kicker" }, "工作区文件"),
            h("h1", null, "Excel 表格"),
            h("p", { className: "dsh-excel-path", title: cwd || "" }, cwd || "请选择工作区")
          ),
          h("button", {
            type: "button", className: "dsh-excel-refresh", disabled: !cwd || state.status === "loading",
            onClick: () => setRefresh((value) => value + 1)
          }, "刷新")
        ),
        h("div", { className: "dsh-excel-meta" },
          h("span", { className: "dsh-excel-root" }, rootName),
          h("span", null, state.status === "loading"
            ? `已找到 ${state.found || 0} 个文件 · 已扫描 ${state.directories || 0} 个目录`
            : `${state.files.length} 个文件`)
        ),
        state.status === "idle" && h("div", { className: "dsh-excel-message" },
          h("strong", null, "尚未选择工作区"),
          h("p", null, "先在左侧选择一个工作区或打开其中的会话。")
        ),
        state.status === "loading" && h("div", { className: "dsh-excel-message", role: "status" },
          h("span", { className: "dsh-excel-spinner", "aria-hidden": "true" }),
          h("span", null, "正在查找当前工作目录及子目录中的 Excel 表格…")
        ),
        state.status === "error" && h("div", { className: "dsh-excel-message", role: "alert" },
          h("strong", null, "无法读取工作目录"),
          h("p", null, state.reason || "请检查工作区权限后重试。")
        ),
        state.status === "ready" && h(React.Fragment, null,
          (state.truncated || state.errors.length > 0) && h("div", { className: "dsh-excel-warning", role: "status" },
            state.truncated ? "有目录的条目超过 Harness 上限；列表可能不完整。" : "",
            state.errors.length > 0 ? ` ${state.errors.length} 个目录读取失败。` : ""
          ),
          state.files.length === 0
            ? h("div", { className: "dsh-excel-message" },
                h("strong", null, "这里还没有 Excel 表格"),
                h("p", null, "将 .xlsx、.xls、.xlsm 或 .xlsb 文件放入工作目录，再点击刷新。"))
            : h("ul", { className: "dsh-excel-list" }, state.files.map((file) =>
                h("li", { className: "dsh-excel-item", key: file.relative, title: file.relative },
                  h("span", { className: "dsh-excel-file-icon", "aria-hidden": "true" }, "X"),
                  h("div", { className: "dsh-excel-file-text" },
                    h("strong", null, file.name),
                    h("span", null, file.relative)
                  ),
                  h("span", { className: "dsh-excel-size" }, formatSize(file.size))
                )
              ))
        )
      );
    }

    const css = `

      .dsh-excel-panel{box-sizing:border-box;min-height:100%;padding:clamp(28px,5vw,64px);background:var(--dsw-alias-bg-primary,var(--dsw-specific-main-fill,#1b1b1b));color:var(--dsw-alias-label-primary,#f4f4f4);font-family:var(--ds-font-family-base,system-ui,sans-serif)}
      .dsh-excel-header{max-width:1120px;margin:0 auto;display:flex;align-items:end;justify-content:space-between;gap:24px;border-bottom:1px solid var(--dsw-alias-border-l3,#454545);padding-bottom:28px}
      .dsh-excel-heading{min-width:0}.dsh-excel-kicker{font-size:12px;letter-spacing:.12em;color:var(--dsw-alias-label-secondary,#aaa)}
      .dsh-excel-heading h1{font-size:clamp(28px,3vw,42px);font-weight:600;letter-spacing:-.04em;line-height:1.15;margin:10px 0 12px}
      .dsh-excel-path{font-size:13px;color:var(--dsw-alias-label-secondary,#aaa);overflow-wrap:anywhere;margin:0}
      .dsh-excel-refresh{flex:none;border:1px solid var(--dsw-alias-border-l3,#555);border-radius:10px;background:var(--dsw-alias-button-elevated-fill,#363636);color:inherit;padding:9px 17px;font:inherit;cursor:pointer}
      .dsh-excel-refresh:hover:not(:disabled){background:var(--dsw-alias-button-floating-hover,#494949)}.dsh-excel-refresh:disabled{opacity:.45;cursor:default}.dsh-excel-refresh:focus-visible{outline:2px solid #58b99e;outline-offset:2px}
      .dsh-excel-meta{max-width:1120px;margin:22px auto 18px;display:flex;align-items:center;gap:12px;color:var(--dsw-alias-label-secondary,#aaa);font-size:13px}
      .dsh-excel-root{color:var(--dsw-alias-label-primary,#fff);padding:5px 9px;border-radius:6px;background:var(--dsw-alias-interactive-bg-hover,#353535);max-width:40vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dsh-excel-message{max-width:1120px;margin:0 auto;padding:48px 24px;border:1px dashed var(--dsw-alias-border-l3,#555);border-radius:14px;color:var(--dsw-alias-label-secondary,#aaa);display:flex;align-items:center;gap:12px;flex-wrap:wrap}
      .dsh-excel-message strong{color:var(--dsw-alias-label-primary,#fff);font-weight:600}.dsh-excel-message p{width:100%;margin:0}.dsh-excel-warning{max-width:1120px;margin:0 auto 14px;padding:12px 16px;border-radius:8px;background:rgba(205,141,47,.14);color:var(--dsw-alias-label-primary,#fff);font-size:13px}
      .dsh-excel-list{max-width:1120px;margin:0 auto;padding:0;list-style:none;display:grid;gap:8px}.dsh-excel-item{min-width:0;display:flex;align-items:center;gap:14px;padding:15px 17px;border:1px solid var(--dsw-alias-border-l3,#454545);border-radius:10px;background:var(--dsw-alias-button-elevated-fill,#272727)}
      .dsh-excel-file-icon{width:32px;height:36px;border-radius:7px;background:#236b59;color:#fff;display:grid;place-items:center;flex:none;font-size:15px;font-weight:700}.dsh-excel-file-text{min-width:0;display:flex;flex-direction:column;gap:3px;flex:1}.dsh-excel-file-text strong{font-size:14px;font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh-excel-file-text span{font-size:12px;color:var(--dsw-alias-label-secondary,#aaa);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh-excel-size{flex:none;font-size:12px;color:var(--dsw-alias-label-secondary,#aaa)}
      .dsh-excel-spinner{width:16px;height:16px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:dsh-excel-spin .8s linear infinite}@keyframes dsh-excel-spin{to{transform:rotate(360deg)}}
      @media(max-width:640px){.dsh-excel-panel{padding:24px 18px}.dsh-excel-header{align-items:start}.dsh-excel-size{display:none}}@media(prefers-reduced-motion:reduce){.dsh-excel-spinner{animation:none}}
    `;

    const inject = ["slots", "sessions", "remote", "remote.workspaceFiles"];
    function apply(ctx) {
      ctx.effect(() => {
        const style = document.createElement("style");
        style.dataset.plugin = "dsh-excel-workspace-tab";
        style.textContent = css;
        document.head.appendChild(style);
        return () => style.remove();
      }, "excel-workspace-tab: styles");

      const scan = (sessionId, cwd, signal, onProgress) =>
        scanExcelFiles((id, path, abortSignal) => ctx.remote.workspaceFiles.list(id, path, abortSignal),
          sessionId, cwd, signal, onProgress);

      ctx.effect(() => ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
        name: "sidebar.panellist", id: PANEL_ID, label: "Excel 表格", order: 40
      }, ExcelGlyph)), "excel-workspace-tab: sidebar entry");
      ctx.effect(() => ctx.slots.inject("main", () => ctx.slots.register({
        name: "main", key: PANEL_ID, inject: () => ({ scan })
      }, ExcelPanel)), "excel-workspace-tab: main panel");
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.scanExcelFiles = scanExcelFiles;
    return module.exports;
  }
});
