// dsh-console — browser half. Registers a "Skills & MCP" page in Settings that
// reads the host remotes `dshConsole/skills` and `dshConsole/mcp` through the
// generic connection RPC (third-party namespaces are not in the static ctx.remote table).
// Lazy-CJS shape expected by the dsh client module loader; no build step.
window.__ModuleLoader__.load({
  id: "dsh-console",
  factory: (require) => {
    "use strict";
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    const h = React.createElement;
    const { useState, useEffect, useMemo } = React;

    const PLUGIN_ID = "dsh-console";
    const NS = "settings.dshConsole";
    const zh = { nav: "技能与 MCP" };
    const en = { nav: "Skills & MCP" };

    const CSS = [
      ".mc-root{display:flex;flex-direction:column;gap:22px;color:var(--dsw-alias-label-primary)}",
      ".mc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}",
      ".mc-title{font-size:16px;font-weight:600;line-height:24px}",
      ".mc-sub{font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:18px;margin-top:2px}",
      ".mc-count{font-size:12px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap}",
      ".mc-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}",
      ".mc-input{font:inherit;font-size:13px;line-height:20px;padding:5px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);min-width:180px;outline:none}",
      ".mc-input--wide{min-width:260px;max-width:100%;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}",
      ".mc-input:focus{border-color:var(--dsw-alias-brand-primary)}",
      ".mc-btn{font:inherit;font-size:12px;line-height:20px;padding:4px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-button-floating-fill);color:var(--dsw-alias-label-primary);cursor:pointer}",
      ".mc-btn:hover{background:var(--dsw-alias-button-floating-hover)}",
      ".mc-list{display:flex;flex-direction:column;gap:6px}",
      ".mc-row{display:grid;grid-template-columns:minmax(170px,230px) 1fr;gap:12px;padding:9px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2)}",
      ".mc-row:hover{background:var(--dsw-alias-interactive-bg-hover-solid)}",
      ".mc-name{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;line-height:18px;word-break:break-all}",
      ".mc-desc{font-size:12.5px;line-height:18px;color:var(--dsw-alias-label-secondary)}",
      ".mc-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}",
      ".mc-badge{display:inline-block;font-size:10.5px;line-height:14px;padding:1px 6px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-1)}",
      ".mc-badge--project{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}",
      ".mc-badge--warn{color:var(--dsw-alias-state-warn-label)}",
      ".mc-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px;vertical-align:1px;background:var(--dsw-alias-label-dimmed)}",
      ".mc-dot--ok{background:var(--dsw-alias-state-success-primary)}",
      ".mc-dot--warn{background:var(--dsw-alias-state-warn-primary)}",
      ".mc-dot--err{background:var(--dsw-alias-state-error-primary)}",
      ".mc-srv{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2)}",
      ".mc-srv-head{display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer}",
      ".mc-srv-name{font-weight:600;font-size:13px;line-height:20px}",
      ".mc-srv-target{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--dsw-alias-label-tertiary);word-break:break-all}",
      ".mc-srv-tools{display:flex;flex-wrap:wrap;gap:4px 10px;padding-top:6px;border-top:1px dashed var(--dsw-alias-border-l2)}",
      ".mc-srv-tool{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--dsw-alias-label-secondary)}",
      ".mc-empty{font-size:12.5px;color:var(--dsw-alias-label-tertiary);padding:12px;border:1px dashed var(--dsw-alias-border-l2);border-radius:10px}",
      ".mc-err{font-size:12.5px;color:var(--dsw-alias-state-error-primary)}",
    ].join("\n");

    function installStyles(ctx) {
      if (typeof document === "undefined") return;
      ctx.effect(() => {
        const tag = document.createElement("style");
        tag.dataset.plugin = PLUGIN_ID;
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => tag.remove();
      }, "dsh-console: styles");
    }

    function useRemote(callRpc, method, args, tick) {
      const [state, setState] = useState({ loading: true, data: null, error: null });
      const key = JSON.stringify(args);
      useEffect(() => {
        let alive = true;
        setState((s) => ({ loading: true, data: s.data, error: null }));
        Promise.resolve()
          .then(() => callRpc(method, args))
          .then((data) => { if (alive) setState({ loading: false, data, error: null }); })
          .catch((e) => { if (alive) setState({ loading: false, data: null, error: String((e && e.message) || e) }); });
        return () => { alive = false; };
      }, [method, key, tick]);
      return state;
    }

    // ── skills ────────────────────────────────────────────────────────────
    function SkillsPanel({ callRpc, cwd, tick }) {
      const [q, setQ] = useState("");
      const { loading, data, error } = useRemote(callRpc, "skills", { cwd }, tick);
      const skills = (data && data.skills) || [];
      const shown = useMemo(() => {
        const needle = q.trim().toLowerCase();
        if (!needle) return skills;
        return skills.filter((s) => (s.name + " " + (s.description || "")).toLowerCase().includes(needle));
      }, [skills, q]);
      return h("section", { className: "mc-root" },
        h("div", { className: "mc-head" },
          h("div", null,
            h("div", { className: "mc-title" }, "Skills"),
            h("div", { className: "mc-sub" }, data
              ? data.project + " from the project (.agents/skills, .dsh/skills), " + data.user + " global (~/.agents/skills). Type / in the composer to invoke one."
              : "Skills the agent can load in this workspace.")),
          h("div", { className: "mc-tools" },
            h("input", { className: "mc-input", placeholder: "Filter skills…", value: q, onChange: (e) => setQ(e.target.value) }),
            h("span", { className: "mc-count" }, loading ? "…" : shown.length + " / " + skills.length))),
        error ? h("div", { className: "mc-err" }, "Could not read the skill catalog: " + error) : null,
        !loading && !error && shown.length === 0 ? h("div", { className: "mc-empty" }, "No matching skills.") : null,
        h("div", { className: "mc-list" }, shown.map((s) => h("div", { className: "mc-row", key: s.name },
          h("div", null,
            h("div", { className: "mc-name" }, "/" + s.name),
            h("div", { className: "mc-meta" },
              h("span", { className: "mc-badge" + (s.scope === "project" ? " mc-badge--project" : "") }, s.scope),
              s.modelInvocable === false ? h("span", { className: "mc-badge mc-badge--warn" }, "user only") : null,
              s.userInvocable === false ? h("span", { className: "mc-badge mc-badge--warn" }, "model only") : null)),
          h("div", { className: "mc-desc" }, s.description || "—")))));
    }

    // ── mcp ───────────────────────────────────────────────────────────────
    function ServerCard({ srv }) {
      const [open, setOpen] = useState(false);
      const dot = srv.state === "connected" ? " mc-dot--ok" : srv.state === "disabled" ? "" : srv.state === "error" ? " mc-dot--err" : " mc-dot--warn";
      const label = srv.state === "connected" ? srv.toolCount + " tools" : srv.state === "disabled" ? "disabled" : srv.state === "error" ? "failed" : srv.state === "no-tools" ? "no tools" : srv.state;
      return h("div", { className: "mc-srv" },
        h("div", { className: "mc-srv-head", onClick: () => setOpen((v) => !v) },
          h("div", null,
            h("div", { className: "mc-srv-name" }, h("span", { className: "mc-dot" + dot }), srv.serverName),
            h("div", { className: "mc-srv-target" }, srv.transport + " · " + (srv.target || ""))),
          h("div", { className: "mc-count" }, label + (srv.toolCount ? (open ? "  ▾" : "  ▸") : ""))),
        open && srv.tools && srv.tools.length
          ? h("div", { className: "mc-srv-tools" }, srv.tools.map((t) => h("span", { className: "mc-srv-tool", key: t }, t)))
          : null);
    }
    function McpPanel({ callRpc, tick }) {
      const { loading, data, error } = useRemote(callRpc, "mcp", {}, tick);
      const servers = (data && data.servers) || [];
      return h("section", { className: "mc-root" },
        h("div", { className: "mc-head" },
          h("div", null,
            h("div", { className: "mc-title" }, "MCP servers"),
            h("div", { className: "mc-sub" }, "dsh-mcp-client rows of this deployment. Connected = the server answered tools/list; the model sees them as mcp__<server>__<tool>.")),
          h("span", { className: "mc-count" }, loading ? "…" : (data ? data.connected + " / " + servers.length + " connected · " + data.totalTools + " tools" : ""))),
        error ? h("div", { className: "mc-err" }, "Could not read MCP status: " + error) : null,
        !loading && !error && servers.length === 0 ? h("div", { className: "mc-empty" }, "No MCP servers in this composition.") : null,
        h("div", { className: "mc-list" }, servers.map((s) => h(ServerCard, { srv: s, key: s.id }))));
    }

    // ── page ──────────────────────────────────────────────────────────────
    function readWorkspaces(useWorkspaces) {
      try {
        const st = typeof useWorkspaces === "function" ? useWorkspaces((s) => s) : null;
        const items = st && Array.isArray(st.items) ? st.items : [];
        const paths = items.map((i) => i && typeof i.path === "string" ? i.path : null).filter(Boolean);
        const recent = st && st.recentWorkspaceId ? items.find((i) => i.workspaceId === st.recentWorkspaceId) : null;
        return { paths, current: (recent && recent.path) || paths[0] || "" };
      } catch (e) {
        return { paths: [], current: "" };
      }
    }
    function ConsoleSection(props) {
      const { callRpc, useWorkspaces } = props;
      const ws = readWorkspaces(useWorkspaces);
      const [cwd, setCwd] = useState(ws.current);
      const [draft, setDraft] = useState(ws.current);
      const [tick, setTick] = useState(0);
      useEffect(() => { if (!cwd && ws.current) { setCwd(ws.current); setDraft(ws.current); } }, [ws.current]);
      return h("div", { className: "mc-root" },
        h("div", { className: "mc-head" },
          h("div", null,
            h("div", { className: "mc-title" }, "Skills & MCP"),
            h("div", { className: "mc-sub" }, "What Mind can do right now: the skills for a workspace and the MCP servers with their live status.")),
          h("div", { className: "mc-tools" },
            h("input", {
              className: "mc-input mc-input--wide", list: "mc-cwd-options", value: draft, placeholder: "workspace path",
              onChange: (e) => setDraft(e.target.value),
              onKeyDown: (e) => { if (e.key === "Enter") setCwd(draft.trim()); },
              onBlur: () => setCwd(draft.trim()),
            }),
            h("datalist", { id: "mc-cwd-options" }, ws.paths.map((p) => h("option", { value: p, key: p }))),
            h("button", { className: "mc-btn", onClick: () => setTick((t) => t + 1) }, "Refresh"))),
        h(McpPanel, { callRpc, tick }),
        h(SkillsPanel, { callRpc, cwd, tick }));
    }

    // ── plugin body ───────────────────────────────────────────────────────
    const inject = ["slots", "locale", "connection"];
    function apply(ctx) {
      installStyles(ctx);
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-console: dictionaries");
      const t = ctx.locale.bind(NS);
      const callRpc = async (method, args) => {
        const r = await ctx.connection.rpc.call("/api", "dshConsole/" + method, { args: args || {} });
        if (r && r.ok) return r.value;
        const e = r && r.error;
        throw new Error(e ? e.code + ": " + e.message : "rpc failed");
      };
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section",
        id: "dsh-console",
        order: 15,
        label: () => t("nav"),
        locale: NS,
        inject: () => ({ callRpc }),
      }, ConsoleSection));
    }
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
