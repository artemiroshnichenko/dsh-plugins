// dsh-workbench — browser half.
//
// Adds two tabs to the conversation view ring (the strip that already carries
// Chat and Trajectory): "Files" — a directory tree, git changes, diffs and an
// editor that saves back to disk — and "Terminal" — one command per run in the
// session's working directory.
//
// Both tabs receive `sessionId` as a standard prop and hand it to the host, which
// resolves the working directory itself, so nothing here can point at another
// directory. Lazy-CJS shape expected by the dsh client module loader; no build step.
window.__ModuleLoader__.load({
  id: "dsh-workbench",
  factory: (require) => {
    "use strict";
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useRef, useState } = React;

    const PLUGIN_ID = "dsh-workbench";
    const NS = "conversation.workbench";
    const zh = { files: "文件", terminal: "终端" };
    const en = { files: "Files", terminal: "Terminal" };

    const CSS = [
      // shell
      // The session shell floats its composer over the view, so reserve its measured
      // height (the conversation package publishes --dsh-composer-height) at the bottom.
      ".wb{display:flex;flex-direction:column;height:100%;min-height:0;padding-bottom:calc(var(--dsh-composer-height, 152px) + 12px);box-sizing:border-box;color:var(--dsw-alias-label-primary);font-size:13px}",
      ".wb-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l2);flex-wrap:wrap}",
      ".wb-body{flex:1;min-height:0;display:flex}",
      ".wb-pane{display:flex;flex-direction:column;min-height:0;min-width:0}",
      ".wb-left{width:290px;flex:0 0 290px;border-right:1px solid var(--dsw-alias-border-l2);overflow:auto}",
      ".wb-right{flex:1;overflow:hidden}",
      // controls
      ".wb-seg{display:inline-flex;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;overflow:hidden}",
      ".wb-seg button{font:inherit;font-size:12px;padding:3px 11px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}",
      ".wb-seg button[data-on=true]{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary)}",
      ".wb-btn{font:inherit;font-size:12px;line-height:20px;padding:3px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-button-floating-fill);color:var(--dsw-alias-label-primary);cursor:pointer}",
      ".wb-btn:hover:not(:disabled){background:var(--dsw-alias-button-floating-hover)}",
      ".wb-btn:disabled{opacity:.45;cursor:default}",
      ".wb-btn--primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border-color:transparent}",
      ".wb-btn--primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}",
      ".wb-spacer{flex:1}",
      ".wb-note{font-size:11.5px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".wb-err{font-size:12px;color:var(--dsw-alias-state-error-primary);padding:8px 12px}",
      // crumbs
      ".wb-crumbs{display:flex;gap:2px;align-items:center;flex-wrap:wrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;min-width:0}",
      ".wb-crumb{background:0;border:0;font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:1px 3px;border-radius:5px}",
      ".wb-crumb:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
      ".wb-crumb--last{color:var(--dsw-alias-label-primary);cursor:default}",
      ".wb-crumb--last:hover{background:0}",
      // rows
      ".wb-row{display:flex;align-items:center;gap:7px;width:100%;text-align:left;background:0;border:0;font:inherit;font-size:12.5px;padding:4px 12px;color:var(--dsw-alias-label-primary);cursor:pointer}",
      ".wb-row:hover{background:var(--dsw-alias-interactive-bg-hover)}",
      ".wb-row[data-on=true]{background:var(--dsw-alias-bg-module-platform)}",
      ".wb-row__name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}",
      ".wb-row__name[data-dir=true]{font-family:inherit}",
      ".wb-row__dim{color:var(--dsw-alias-label-tertiary)}",
      ".wb-glyph{width:14px;text-align:center;color:var(--dsw-alias-label-tertiary);flex:0 0 14px}",
      ".wb-mark{font-size:10.5px;font-weight:600;flex:0 0 auto}",
      ".wb-mark--modified{color:var(--dsw-alias-state-warn-label)}",
      ".wb-mark--added,.wb-mark--untracked{color:var(--dsw-alias-state-success-primary)}",
      ".wb-mark--deleted,.wb-mark--conflict{color:var(--dsw-alias-state-error-primary)}",
      ".wb-mark--renamed{color:var(--dsw-alias-brand-primary)}",
      ".wb-empty{padding:14px 12px;color:var(--dsw-alias-label-tertiary);font-size:12px}",
      // editor + code
      ".wb-editor{flex:1;min-height:0;width:100%;resize:none;border:0;outline:0;padding:10px 12px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;line-height:1.55;tab-size:2;white-space:pre;overflow:auto}",
      ".wb-code{flex:1;min-height:0;margin:0;padding:10px 12px;overflow:auto;background:var(--dsw-alias-bg-layer-1);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;line-height:1.55;white-space:pre}",
      ".wb-diff-add{color:var(--dsw-alias-state-success-primary)}",
      ".wb-diff-del{color:var(--dsw-alias-state-error-primary)}",
      ".wb-diff-hunk{color:var(--dsw-alias-brand-primary)}",
      ".wb-diff-meta{color:var(--dsw-alias-label-tertiary)}",
      ".wb-dirty{color:var(--dsw-alias-state-warn-label)}",
      // terminal
      ".wb-term{flex:1;min-height:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1)}",
      ".wb-term__log{flex:1;min-height:0;overflow:auto;padding:10px 12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;line-height:1.5;white-space:pre-wrap;word-break:break-word}",
      ".wb-term__cmd{color:var(--dsw-alias-brand-primary)}",
      ".wb-term__fail{color:var(--dsw-alias-state-error-primary)}",
      ".wb-term__meta{color:var(--dsw-alias-label-tertiary);font-size:11.5px}",
      ".wb-term__form{display:flex;align-items:center;gap:8px;padding:8px 12px;border-top:1px solid var(--dsw-alias-border-l2)}",
      ".wb-term__prompt{color:var(--dsw-alias-brand-primary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}",
      ".wb-term__input{flex:1;min-width:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;padding:5px 9px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);outline:none}",
      ".wb-term__input:focus{border-color:var(--dsw-alias-brand-primary)}",
      // runnable code blocks in the chat: the Run button sits beside the shipped Copy
      ".wb-runbtn{font:inherit;font-size:11.5px;line-height:16px;padding:1px 8px;margin-left:6px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}",
      ".wb-runbtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
      ".wb-runbtn:disabled{opacity:.5;cursor:default}",
      ".wb-runout{border-top:1px dashed var(--dsw-alias-border-l2);padding:8px 12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-secondary);max-height:340px;overflow:auto}",
      ".wb-runout__head{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-tertiary);font-size:11px;margin-bottom:4px}",
      ".wb-runout__head button{font:inherit;font-size:11px;background:0;border:0;color:var(--dsw-alias-label-tertiary);cursor:pointer;padding:0}",
      ".wb-runout__head button:hover{color:var(--dsw-alias-label-primary)}",
      ".wb-runout__fail{color:var(--dsw-alias-state-error-primary)}",
      ".wb-runout__spacer{flex:1}",
    ].join("\n");

    function installStyles(ctx) {
      if (typeof document === "undefined") return;
      ctx.effect(() => {
        const tag = document.createElement("style");
        tag.dataset.plugin = PLUGIN_ID;
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => tag.remove();
      }, "dsh-workbench: styles");
    }

    const fmtSize = (n) => (n < 1024 ? n + " B" : n < 1024 * 1024 ? (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB" : (n / 1048576).toFixed(1) + " MB");
    const MARK = { modified: "M", added: "A", untracked: "U", deleted: "D", renamed: "R", conflict: "!" };

    /**
     * Root of a workbench tab. The session body renders views inside a scroll
     * container whose child box is auto-height, so a plain `height: 100%` grows
     * with the content and slides under the floating composer. Measuring the
     * scrollport and pinning the panel to it keeps the toolbar, the file list and
     * the terminal prompt where they belong, and lets the inner panes scroll.
     */
    function Panel(props) {
      const ref = useRef(null);
      const [height, setHeight] = useState(0);
      useEffect(() => {
        const node = ref.current;
        if (node === null || typeof node.closest !== "function") return undefined;
        const port = node.closest("[data-conversation-scroll]");
        if (port === null) return undefined;
        const apply = () => setHeight(port.clientHeight);
        apply();
        if (typeof ResizeObserver === "undefined") {
          window.addEventListener("resize", apply);
          return () => window.removeEventListener("resize", apply);
        }
        const observer = new ResizeObserver(apply);
        observer.observe(port);
        return () => observer.disconnect();
      }, []);
      return h("div", { className: "wb", ref, style: height > 0 ? { height: height + "px" } : undefined }, props.children);
    }

    // ── files tab ─────────────────────────────────────────────────────────
    function Crumbs({ rel, onGo }) {
      const parts = rel === "" ? [] : rel.split("/");
      const nodes = [h("button", { key: "root", className: "wb-crumb" + (parts.length === 0 ? " wb-crumb--last" : ""), onClick: () => onGo("") }, "/")];
      parts.forEach((part, i) => {
        const last = i === parts.length - 1;
        if (i > 0) nodes.push(h("span", { key: "s" + i, className: "wb-row__dim" }, "/"));
        nodes.push(h("button", {
          key: "p" + i, className: "wb-crumb" + (last ? " wb-crumb--last" : ""),
          onClick: last ? undefined : () => onGo(parts.slice(0, i + 1).join("/")),
        }, part));
      });
      return h("div", { className: "wb-crumbs" }, nodes);
    }

    function DiffText({ text }) {
      const lines = useMemo(() => text.split("\n"), [text]);
      return h("pre", { className: "wb-code" }, lines.map((line, i) => {
        const cls = line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff ") || line.startsWith("index ")
          ? "wb-diff-meta"
          : line.startsWith("@@") ? "wb-diff-hunk"
          : line.startsWith("+") ? "wb-diff-add"
          : line.startsWith("-") ? "wb-diff-del" : "";
        return h("div", { key: i, className: cls }, line === "" ? " " : line);
      }));
    }

    function FilesTab(props) {
      const { call, sessionId } = props;
      const [mode, setMode] = useState("tree");          // tree | changes
      const [dir, setDir] = useState("");
      const [listing, setListing] = useState(null);
      const [changes, setChanges] = useState(null);
      const [open, setOpen] = useState(null);            // { rel, text, version, language, nonce }
      const [dirty, setDirty] = useState(false);
      const [diff, setDiff] = useState(null);
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState("");
      const [notice, setNotice] = useState("");
      const [tick, setTick] = useState(0);
      const editorRef = useRef(null);

      const refresh = useCallback(() => setTick((t) => t + 1), []);

      useEffect(() => {
        let alive = true;
        setError("");
        const args = { sessionId, root: "", rel: dir };
        call(mode === "tree" ? "list" : "changes", mode === "tree" ? args : { sessionId, root: "" })
          .then((data) => { if (!alive) return; if (mode === "tree") setListing(data); else setChanges(data); })
          .catch((e) => { if (alive) setError(String(e.message || e)); });
        return () => { alive = false; };
      }, [call, sessionId, dir, mode, tick]);

      const openFile = useCallback((rel) => {
        setBusy(true); setError(""); setNotice(""); setDiff(null);
        call("read", { sessionId, root: "", rel })
          .then((data) => { setOpen({ ...data, nonce: Date.now() }); setDirty(false); })
          .catch((e) => setError(String(e.message || e)))
          .finally(() => setBusy(false));
      }, [call, sessionId]);

      const showDiff = useCallback((rel) => {
        setBusy(true); setError(""); setNotice("");
        call("diff", { sessionId, root: "", rel })
          .then((data) => { setDiff({ rel, text: data.text || "" }); setOpen(null); })
          .catch((e) => setError(String(e.message || e)))
          .finally(() => setBusy(false));
      }, [call, sessionId]);

      const save = useCallback(() => {
        const editor = editorRef.current;
        if (open === null || editor === null) return;
        const text = editor.value;
        setBusy(true); setError(""); setNotice("");
        call("save", { sessionId, root: "", rel: open.rel, text, version: open.version })
          .then((data) => {
            setOpen((cur) => (cur === null ? cur : { ...cur, text, version: data.version }));
            setDirty(false);
            setNotice("Saved " + new Date().toLocaleTimeString());
            refresh();
          })
          .catch((e) => setError(String(e.message || e)))
          .finally(() => setBusy(false));
      }, [call, sessionId, open, refresh]);

      const onKeyDown = useCallback((e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); return; }
        if (e.key === "Tab") {
          e.preventDefault();
          // insertText keeps the native undo stack, which a value rewrite would discard
          if (typeof document.execCommand === "function") document.execCommand("insertText", false, "  ");
          if (open !== null) setDirty(e.target.value !== open.text);
        }
      }, [save, open]);

      const onInput = useCallback((e) => {
        if (open !== null) setDirty(e.target.value !== open.text);
      }, [open]);

      const rows = mode === "tree"
        ? (listing?.entries ?? []).map((e) => h("button", {
            key: e.rel, className: "wb-row", "data-on": open?.rel === e.rel,
            onClick: () => (e.dir ? (setDir(e.rel), setOpen(null), setDiff(null)) : e.editable ? openFile(e.rel) : setError("Not a text file: " + e.name)),
            title: e.dir ? e.name : e.name + " · " + fmtSize(e.size),
          },
            h("span", { className: "wb-glyph" }, e.dir ? "▸" : "◦"),
            h("span", { className: "wb-row__name", "data-dir": e.dir }, e.name),
            e.status ? h("span", { className: "wb-mark wb-mark--" + e.status, title: e.status }, MARK[e.status] ?? "•") : null,
            e.dir ? null : h("span", { className: "wb-row__dim", style: { fontSize: "11px" } }, fmtSize(e.size))))
        : (changes?.files ?? []).map((f) => h("button", {
            key: f.rel, className: "wb-row", "data-on": diff?.rel === f.rel || open?.rel === f.rel,
            onClick: () => showDiff(f.rel), title: f.rel + " · " + f.status,
          },
            h("span", { className: "wb-mark wb-mark--" + f.status }, MARK[f.status] ?? "•"),
            h("span", { className: "wb-row__name" }, f.rel)));

      const emptyText = mode === "tree" ? "Empty directory." : changes?.git === false ? "Not a git repository." : "No changes in the working tree.";

      return h(Panel, null,
        h("div", { className: "wb-bar" },
          h("div", { className: "wb-seg" },
            h("button", { "data-on": mode === "tree", onClick: () => setMode("tree") }, "Tree"),
            h("button", { "data-on": mode === "changes", onClick: () => setMode("changes") }, "Changes")),
          mode === "tree"
            ? h(Crumbs, { rel: dir, onGo: (next) => { setDir(next); setOpen(null); setDiff(null); } })
            : h("span", { className: "wb-note" }, changes?.branch ? "branch " + changes.branch : ""),
          h("span", { className: "wb-spacer" }),
          open !== null ? h(React.Fragment, null,
            h("span", { className: "wb-note" + (dirty ? " wb-dirty" : "") }, dirty ? "unsaved" : (notice || "saved")),
            h("button", { className: "wb-btn", onClick: () => showDiff(open.rel), disabled: busy }, "Diff"),
            h("button", { className: "wb-btn wb-btn--primary", onClick: save, disabled: busy || !dirty }, "Save")) : null,
          diff !== null ? h("button", { className: "wb-btn", onClick: () => openFile(diff.rel), disabled: busy }, "Edit") : null,
          h("button", { className: "wb-btn", onClick: refresh, disabled: busy }, "Refresh")),
        error !== "" ? h("div", { className: "wb-err" }, error) : null,
        h("div", { className: "wb-body" },
          h("div", { className: "wb-pane wb-left" }, rows.length === 0 ? h("div", { className: "wb-empty" }, emptyText) : rows),
          h("div", { className: "wb-pane wb-right" },
            open !== null
              ? h("textarea", {
                  // keyed per load, not per save: remounting on save would throw the undo stack away
                  key: open.rel + "#" + open.nonce,
                  ref: editorRef, className: "wb-editor", defaultValue: open.text,
                  spellCheck: false, wrap: "off", onInput, onKeyDown,
                })
              : diff !== null
                ? (diff.text === "" ? h("div", { className: "wb-empty" }, "No diff against HEAD for this path.") : h(DiffText, { text: diff.text }))
                : h("div", { className: "wb-empty" }, mode === "tree" ? "Pick a file to edit it. Cmd+S saves." : "Pick a changed file to see its diff."))));
    }

    // ── terminal tab ──────────────────────────────────────────────────────
    function TerminalTab(props) {
      const { call, sessionId } = props;
      const [log, setLog] = useState([]);
      const [line, setLine] = useState("");
      const [busy, setBusy] = useState(false);
      const [history, setHistory] = useState([]);
      const [cursor, setCursor] = useState(-1);
      const logRef = useRef(null);

      useEffect(() => {
        const el = logRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }, [log, busy]);

      const submit = useCallback(() => {
        const command = line.trim();
        if (command === "" || busy) return;
        if (command === "clear") { setLog([]); setLine(""); return; }
        if (command === "reset") {
          setLine("");
          call("resetShell", { sessionId, root: "" })
            .then((r) => setLog((prev) => [...prev, { command, text: "back to " + r.cwd, code: 0, ms: 0, cwd: r.cwd }]))
            .catch((e) => setLog((prev) => [...prev, { command, text: String(e.message || e), code: -1, ms: 0 }]));
          return;
        }
        setBusy(true); setLine("");
        setHistory((h0) => (h0[h0.length - 1] === command ? h0 : [...h0, command])); setCursor(-1);
        call("run", { sessionId, root: "", command })
          .then((r) => setLog((prev) => [...prev, {
            command, text: r.text, code: r.code, ms: r.durationMs, cwd: r.cwd,
            truncated: r.truncated, timedOut: r.timedOut,
          }]))
          .catch((e) => setLog((prev) => [...prev, { command, text: String(e.message || e), code: -1, ms: 0 }]))
          .finally(() => setBusy(false));
      }, [call, sessionId, line, busy]);

      const onKeyDown = useCallback((e) => {
        if (e.key === "Enter") { e.preventDefault(); submit(); return; }
        if (e.key === "ArrowUp" && history.length > 0) {
          e.preventDefault();
          const next = cursor < 0 ? history.length - 1 : Math.max(0, cursor - 1);
          setCursor(next); setLine(history[next]);
        }
        if (e.key === "ArrowDown" && cursor >= 0) {
          e.preventDefault();
          const next = cursor + 1;
          if (next >= history.length) { setCursor(-1); setLine(""); } else { setCursor(next); setLine(history[next]); }
        }
      }, [submit, history, cursor]);

      return h(Panel, null,
        h("div", { className: "wb-bar" },
          h("span", { className: "wb-note" }, log.length > 0 && log[log.length - 1].cwd ? log[log.length - 1].cwd : "Runs in the session's working directory"),
          h("span", { className: "wb-spacer" }),
          h("span", { className: "wb-note" }, "cd carries over · `reset` returns to the workspace root"),
          h("button", { className: "wb-btn", onClick: () => setLog([]), disabled: log.length === 0 }, "Clear")),
        h("div", { className: "wb-term" },
          h("div", { className: "wb-term__log", ref: logRef },
            log.length === 0 && !busy ? h("div", { className: "wb-empty" }, "Type a command and press Enter. Up and down walk the history; `clear` empties this log and `reset` returns to the workspace root.") : null,
            log.map((entry, i) => h("div", { key: i },
              h("div", { className: "wb-term__cmd" }, "$ " + entry.command),
              entry.text !== "" ? h("div", null, entry.text) : null,
              h("div", { className: "wb-term__meta" + (entry.code !== 0 ? " wb-term__fail" : "") },
                (entry.code === 0 ? "ok" : "exit " + entry.code) + " · " + entry.ms + " ms"
                + (entry.timedOut ? " · timed out" : "") + (entry.truncated ? " · output truncated" : "")))),
            busy ? h("div", { className: "wb-term__meta" }, "running…") : null),
          h("div", { className: "wb-term__form" },
            h("span", { className: "wb-term__prompt" }, "$"),
            h("input", {
              className: "wb-term__input", value: line, placeholder: "command", spellCheck: false,
              onChange: (e) => setLine(e.target.value), onKeyDown, disabled: busy, autoFocus: true,
            }),
            h("button", { className: "wb-btn wb-btn--primary", onClick: submit, disabled: busy || line.trim() === "" }, "Run"))));
    }

    // ── runnable bash blocks in the chat ──────────────────────────────────
    // The shipped markdown renderer already gives every fenced block a Copy button.
    // What it has no notion of is running one. This walks the rendered blocks, and
    // for shell-tagged ones adds a Run button next to Copy plus an output panel
    // underneath, filled from the same host RPC the Terminal tab uses. Nothing runs
    // on its own: the command leaves the browser only when the button is pressed.
    const RUNNABLE_LANGS = new Set(["bash", "sh", "shell", "zsh", "console", "shell-session", "shellsession"]);
    let activeSessionId = "";

    /** Invisible occupant of a session-scoped seat: records which session is on screen. */
    function SessionProbe(props) {
      useEffect(() => {
        if (typeof props.sessionId !== "string" || props.sessionId === "") return;
        activeSessionId = props.sessionId;
        // also readable from the DOM, which makes the wiring checkable without a debugger
        if (typeof document !== "undefined") document.body.dataset.dshSession = props.sessionId;
      }, [props.sessionId]);
      return null;
    }

    function blockLanguage(block) {
      const banner = block.querySelector('[class*="_banner_"]');
      const label = banner === null ? null : banner.firstElementChild;
      return (label === null ? "" : label.textContent || "").trim().toLowerCase();
    }

    function renderOutput(out, result, onClear) {
      out.textContent = "";
      const head = document.createElement("div");
      head.className = "wb-runout__head";
      const status = document.createElement("span");
      const failed = result.code !== 0;
      if (failed) status.className = "wb-runout__fail";
      status.textContent = (failed ? "exit " + result.code : "ok")
        + " · " + result.durationMs + " ms"
        + (result.timedOut ? " · timed out" : "")
        + (result.truncated ? " · output truncated" : "");
      const where = document.createElement("span");
      where.textContent = result.cwd || "";
      const spacer = document.createElement("span");
      spacer.className = "wb-runout__spacer";
      const clear = document.createElement("button");
      clear.type = "button";
      clear.textContent = "Hide";
      clear.addEventListener("click", onClear);
      head.append(status, spacer, where, clear);
      const body = document.createElement("div");
      body.textContent = result.text === "" ? "(no output)" : result.text;
      out.append(head, body);
      out.hidden = false;
    }

    /** Output panels, kept per block so a re-render cannot lose or duplicate one. */
    const outputs = new WeakMap();

    function enhanceBlock(block, call) {
      if (block.dataset.dshRunnable === "1") {
        // React re-inserts its own children on re-render and can leave the panel
        // sitting above the code; putting it back last is cheap and idempotent.
        const known = outputs.get(block);
        if (known !== undefined && block.lastElementChild !== known) block.appendChild(known);
        return;
      }
      if (!RUNNABLE_LANGS.has(blockLanguage(block))) return;
      const copy = block.querySelector('button[class*="_copyButton_"]');
      const actions = copy === null ? null : copy.parentElement;
      if (actions === null) return;
      block.dataset.dshRunnable = "1";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "wb-runbtn";
      button.textContent = "Run";
      actions.appendChild(button);

      const out = document.createElement("div");
      out.className = "wb-runout";
      out.hidden = true;
      block.appendChild(out);
      outputs.set(block, out);

      button.addEventListener("click", () => {
        const pre = block.querySelector("pre");
        const command = (pre === null ? "" : pre.textContent || "").trim();
        if (command === "" || button.disabled) return;
        button.disabled = true;
        const previous = button.textContent;
        button.textContent = "Running…";
        out.hidden = false;
        out.textContent = "running…";
        call("run", { sessionId: activeSessionId, root: "", command })
          .then((result) => renderOutput(out, result, () => { out.hidden = true; out.textContent = ""; }))
          .catch((e) => {
            out.textContent = "";
            const err = document.createElement("div");
            err.className = "wb-runout__fail";
            err.textContent = String((e && e.message) || e);
            out.appendChild(err);
          })
          .finally(() => { button.disabled = false; button.textContent = previous; });
      });
    }

    /** Watch the rendered conversation and keep every shell block enhanced. */
    function installRunnableBlocks(ctx, call) {
      if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
      ctx.effect(() => {
        let queued = false;
        const sweep = () => {
          queued = false;
          for (const block of document.querySelectorAll(".md-code-block")) {
            try { enhanceBlock(block, call); } catch { /* one bad block must not stop the rest */ }
          }
        };
        // a timer, not requestAnimationFrame: frames stop firing while the tab is
        // hidden, and a block rendered in a background tab must still get its button
        const schedule = () => { if (!queued) { queued = true; setTimeout(sweep, 16); } };
        const observer = new MutationObserver(schedule);
        observer.observe(document.body, { childList: true, subtree: true });
        sweep();
        return () => {
          observer.disconnect();
          for (const node of document.querySelectorAll(".wb-runbtn, .wb-runout")) node.remove();
          for (const block of document.querySelectorAll('[data-dsh-runnable="1"]')) delete block.dataset.dshRunnable;
        };
      }, "dsh-workbench: runnable code blocks");
    }

    // ── plugin body ───────────────────────────────────────────────────────
    const inject = ["slots", "locale", "connection"];
    function apply(ctx) {
      installStyles(ctx);
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-workbench: dictionaries");
      const t = ctx.locale.bind(NS);
      const call = async (method, args) => {
        const r = await ctx.connection.rpc.call("/api", "dshWorkbench/" + method, { args: args || {} });
        if (r && r.ok) return r.value;
        const e = r && r.error;
        throw new Error(e ? e.message : "request failed");
      };
      const withCall = (Comp) => function WorkbenchView(props) { return h(Comp, Object.assign({}, props, { call })); };
      const Files = withCall(FilesTab);
      const Terminal = withCall(TerminalTab);
      installRunnableBlocks(ctx, call);
      ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register(
        { name: "conversation.session.header.utilities", id: "dsh-workbench-session-probe", order: 900 }, SessionProbe));
      ctx.slots.inject("conversation.view", function* () {
        yield ctx.slots.register({ name: "conversation.view", id: "files", order: 60, label: () => t("files") }, Files);
        yield ctx.slots.register({ name: "conversation.view", id: "terminal", order: 70, label: () => t("terminal") }, Terminal);
      });
    }
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
