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
      // header badges & indicators
      ".wb-badge{display:inline-flex;align-items:center;font-size:11px;font-weight:600;padding:2px 7px;border-radius:5px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-brand-primary);letter-spacing:0.5px}",
      ".wb-status-dot{width:6px;height:6px;border-radius:50%;display:inline-block}",
      ".wb-status-dot--clean{background:var(--dsw-alias-state-success-primary)}",
      ".wb-status-dot--dirty{background:var(--dsw-alias-state-warn-label)}",
      // editor with gutter and syntax overlay
      ".wb-editor-wrap{flex:1;min-height:0;display:flex;position:relative;overflow:hidden;background:var(--dsw-alias-bg-layer-1)}",
      ".wb-gutter{flex:0 0 auto;min-width:44px;overflow:hidden;background:var(--dsw-alias-bg-layer-2);border-right:1px solid var(--dsw-alias-border-l2);user-select:none;box-sizing:border-box}",
      ".wb-gutter-text{margin:0;padding:10px 10px 10px 0;text-align:right;color:var(--dsw-alias-label-tertiary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;line-height:20px;font-variant-numeric:tabular-nums;white-space:pre}",
      ".wb-editor-viewport{position:relative;flex:1;min-height:0;min-width:0;overflow:hidden}",
      ".wb-editor-highlight{position:absolute;top:0;left:0;min-width:100%;pointer-events:none;box-sizing:border-box}",
      ".wb-code-pre{margin:0;padding:10px 12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;line-height:20px;tab-size:2;-moz-tab-size:2;white-space:pre;word-wrap:normal;overflow-wrap:normal;color:var(--shiki-foreground,var(--dsw-alias-label-primary))}",
      ".wb-editor-input{position:absolute;top:0;left:0;width:100%;height:100%;box-sizing:border-box;margin:0;padding:10px 12px;border:0;outline:0;resize:none;background:transparent;color:transparent;caret-color:var(--dsw-alias-label-primary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;line-height:20px;tab-size:2;-moz-tab-size:2;white-space:pre;word-wrap:normal;overflow:auto}",
      ".wb-editor-input::selection{background:var(--dsw-alias-interactive-bg-hover,rgba(56,139,253,0.3));color:transparent}",
      // syntax highlighting tokens
      ".wb-tok-kw{color:var(--shiki-token-keyword);font-weight:500}",
      ".wb-tok-str{color:var(--shiki-token-string)}",
      ".wb-tok-regex{color:var(--shiki-token-string-expression,var(--shiki-token-string))}",
      ".wb-tok-com{color:var(--shiki-token-comment);font-style:italic}",
      ".wb-tok-fn{color:var(--shiki-token-function)}",
      ".wb-tok-num{color:var(--shiki-token-constant)}",
      ".wb-tok-bool{color:var(--shiki-token-constant);font-weight:500}",
      ".wb-tok-type{color:var(--shiki-token-parameter)}",
      ".wb-tok-prop{color:var(--shiki-token-constant)}",
      ".wb-tok-tag{color:var(--shiki-token-keyword)}",
      ".wb-tok-attr{color:var(--shiki-token-function)}",
      ".wb-tok-punc{color:var(--shiki-token-punctuation)}",
      ".wb-tok-op{color:var(--shiki-token-punctuation)}",
      ".wb-tok-var{color:var(--shiki-token-parameter)}",
      ".wb-tok-head{color:var(--shiki-token-keyword);font-weight:600}",
      // improved diff view
      ".wb-diff-view{flex:1;min-height:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);overflow:hidden}",
      ".wb-diff-bar{display:flex;align-items:center;gap:8px;padding:6px 12px;background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-border-l2)}",
      ".wb-diff-badge{font-size:11px;font-weight:600;padding:1px 6px;border-radius:4px}",
      ".wb-diff-badge--add{background:rgba(46,160,67,0.2);color:var(--dsw-alias-state-success-primary)}",
      ".wb-diff-badge--del{background:rgba(248,81,73,0.2);color:var(--dsw-alias-state-error-primary)}",
      ".wb-diff-scroll{flex:1;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:20px}",
      ".wb-diff-row{display:flex;align-items:stretch;min-width:max-content;white-space:pre}",
      ".wb-diff-row:hover{background:var(--dsw-alias-interactive-bg-hover)}",
      ".wb-diff-row--add{background:rgba(46,160,67,0.12)}",
      ".wb-diff-row--del{background:rgba(248,81,73,0.12)}",
      ".wb-diff-row--hunk{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary);font-weight:500;padding:2px 0}",
      ".wb-diff-row--meta{color:var(--dsw-alias-label-tertiary);opacity:.8}",
      ".wb-diff-num{width:38px;padding-right:8px;text-align:right;color:var(--dsw-alias-label-tertiary);user-select:none;flex-shrink:0;font-variant-numeric:tabular-nums}",
      ".wb-diff-mark{width:18px;text-align:center;user-select:none;flex-shrink:0;font-weight:600}",
      ".wb-diff-row--add .wb-diff-mark{color:var(--dsw-alias-state-success-primary)}",
      ".wb-diff-row--del .wb-diff-mark{color:var(--dsw-alias-state-error-primary)}",
      ".wb-diff-line{flex:1;padding-right:12px;white-space:pre}",
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

// ── syntax highlighting tokenizer & grammars ────────────────────────
    const COMMON_KW = "break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|function|if|import|in|instanceof|new|return|super|switch|this|throw|try|typeof|var|void|while|with|yield";
    const JS_KW = COMMON_KW + "|let|static|implements|interface|package|private|protected|public|enum|as|async|await|of|from|type|declare|namespace|abstract|override|readonly";
    const PY_KW = "and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|match|case";
    const RS_KW = "as|async|await|break|const|continue|crate|dyn|else|enum|extern|false|fn|for|if|impl|in|let|loop|match|mod|move|mut|pub|ref|return|self|Self|static|struct|super|trait|true|type|unsafe|use|where|while";
    const GO_KW = "break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go|goto|if|import|interface|map|package|range|return|select|struct|switch|type|var";
    const SH_KW = "if|then|else|elif|fi|case|esac|for|while|until|do|done|in|function|select|time|return|exit|export|local|declare|alias";
    const SQL_KW = "SELECT|FROM|WHERE|INSERT|INTO|UPDATE|DELETE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|AS|AND|OR|NOT|IN|IS|NULL|CREATE|TABLE|DROP|ALTER|INDEX|VIEW|UNION|ALL|DISTINCT|CASE|WHEN|THEN|ELSE|END";

    const GRAMMARS = {
      js: [
        { type: "com", pattern: /\/\/[^\n]*|\/\*[\s\S]*?\*\// },
        { type: "str", pattern: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\[\s\S]|[^`\\])*`/ },
        { type: "regex", pattern: /\/(?![*\/])(?:\\.|[^/\\\n])+\/[gimsuy]*/ },
        { type: "num", pattern: /\b(?:0[xXbBoO][0-9a-fA-F_]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/ },
        { type: "bool", pattern: /\b(?:true|false|null|undefined|NaN|Infinity)\b/ },
        { type: "kw", pattern: new RegExp(`\\b(?:${JS_KW})\\b`) },
        { type: "type", pattern: /\b(?:any|boolean|never|number|string|symbol|unknown|void|Array|Record|Promise|Map|Set|Object|Function)\b|\b[A-Z][a-zA-Z0-9_$]*\b/ },
        { type: "fn", pattern: /\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\()/ },
        { type: "prop", pattern: /\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*:)/ },
        { type: "op", pattern: /=>|===|!==|==|!=|<=|>=|&&|\|\||\?\?|\+\+|--|[+\-*\/%&|^!=<>?~:]/ },
        { type: "punc", pattern: /[{}\[\]();,.]/ },
      ],
      py: [
        { type: "com", pattern: /#[^\n]*/ },
        { type: "str", pattern: /"""[\s\S]*?"""|'''[\s\S]*?'''|f?"(?:\\.|[^"\\])*"|f?'(?:\\.|[^'\\])*'/ },
        { type: "num", pattern: /\b(?:0[xXbBoO][0-9a-fA-F_]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/ },
        { type: "bool", pattern: /\b(?:True|False|None)\b/ },
        { type: "kw", pattern: new RegExp(`\\b(?:${PY_KW})\\b`) },
        { type: "fn", pattern: /(?:def\s+)([a-zA-Z_]\w*)|\b[a-zA-Z_]\w*(?=\s*\()/ },
        { type: "type", pattern: /\b(?:int|float|str|bool|list|dict|set|tuple|bytes|object)\b|\b[A-Z][a-zA-Z0-9_]*\b/ },
        { type: "var", pattern: /@[a-zA-Z_]\w*/ },
        { type: "op", pattern: /==|!=|<=|>=|:=|\*\*|\/\/|>>|<<|[+\-*\/%&|^!=<>~]/ },
        { type: "punc", pattern: /[{}\[\]();,.:]/ },
      ],
      json: [
        { type: "prop", pattern: /"(?:\\.|[^"\\])*"(?=\s*:)/ },
        { type: "str", pattern: /"(?:\\.|[^"\\])*"/ },
        { type: "num", pattern: /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/ },
        { type: "bool", pattern: /\b(?:true|false|null)\b/ },
        { type: "punc", pattern: /[{}\[\](),:]/ },
      ],
      sh: [
        { type: "com", pattern: /#[^\n]*/ },
        { type: "str", pattern: /"(?:\\.|[^"\\])*"|'[^']*'/ },
        { type: "var", pattern: /\$[a-zA-Z_][a-zA-Z0-9_]*|\$\{[^}]+\}/ },
        { type: "kw", pattern: new RegExp(`\\b(?:${SH_KW})\\b`) },
        { type: "num", pattern: /\b\d+\b/ },
        { type: "op", pattern: /&&|\|\||;;|<<|>>|[|&;><=]/ },
        { type: "punc", pattern: /[{}\[\]()]/ },
      ],
      yaml: [
        { type: "com", pattern: /#[^\n]*/ },
        { type: "prop", pattern: /^[ \t]*[\w.-]+(?=\s*:)/m },
        { type: "str", pattern: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/ },
        { type: "bool", pattern: /\b(?:true|false|yes|no|null)\b/i },
        { type: "num", pattern: /\b\d+(?:\.\d+)?\b/ },
        { type: "punc", pattern: /[:-]/ },
      ],
      sql: [
        { type: "com", pattern: /--[^\n]*|\/\*[\s\S]*?\*\// },
        { type: "str", pattern: /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/ },
        { type: "kw", pattern: new RegExp(`\\b(?:${SQL_KW})\\b`, "i") },
        { type: "num", pattern: /\b\d+(?:\.\d+)?\b/ },
        { type: "bool", pattern: /\b(?:TRUE|FALSE|NULL)\b/i },
        { type: "op", pattern: /<>|!=|<=|>=|[=<>+\-*\/%]/ },
        { type: "punc", pattern: /[();,.]/ },
      ],
      rust: [
        { type: "com", pattern: /\/\/[^\n]*|\/\*[\s\S]*?\*\// },
        { type: "str", pattern: /"(?:\\.|[^"\\])*"|r#*"[\s\S]*?"#*/ },
        { type: "num", pattern: /\b(?:0[xXbBoO][0-9a-fA-F_]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?:[ui](?:8|16|32|64|128|size)|f(?:32|64))?\b/ },
        { type: "kw", pattern: new RegExp(`\\b(?:${RS_KW})\\b`) },
        { type: "type", pattern: /\b(?:bool|char|i8|i16|i32|i64|i128|isize|u8|u16|u32|u64|u128|usize|f32|f64|str|Option|Result|Vec|String)\b|\b[A-Z][a-zA-Z0-9_]*\b/ },
        { type: "fn", pattern: /\b[a-zA-Z_]\w*!(?=\s*[({\[])|\b[a-zA-Z_]\w*(?=\s*\()/ },
        { type: "op", pattern: /=>|->|::|==|!=|<=|>=|&&|\|\||[+\-*\/%&|^!=<>?]/ },
        { type: "punc", pattern: /[{}\[\]();,.]/ },
      ],
      html: [
        { type: "com", pattern: /<!--[\s\S]*?-->/ },
        { type: "tag", pattern: /<\/?[a-zA-Z0-9-]+(?=\s|>|\/)/ },
        { type: "attr", pattern: /[a-zA-Z0-9_-]+(?=\s*=)/ },
        { type: "str", pattern: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/ },
        { type: "op", pattern: /[=>\/]/ },
        { type: "punc", pattern: /[<>]/ },
      ],
      css: [
        { type: "com", pattern: /\/\*[\s\S]*?\*\// },
        { type: "str", pattern: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/ },
        { type: "prop", pattern: /[a-zA-Z-]+(?=\s*:)/ },
        { type: "num", pattern: /#[0-9a-fA-F]{3,8}|\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms|deg|fr)?\b/ },
        { type: "fn", pattern: /\b(?:var|calc|rgb|rgba|hsl|hsla|linear-gradient|url)(?=\s*\()/ },
        { type: "kw", pattern: /@(?:media|import|keyframes|supports|font-face)\b|!(?:important)\b/ },
        { type: "punc", pattern: /[{}\[\]():;,]/ },
      ],
      markdown: [
        { type: "head", pattern: /^#{1,6}\s+[^\n]*/m },
        { type: "com", pattern: /<!--[\s\S]*?-->/ },
        { type: "str", pattern: /`[^`\n]+`/ },
        { type: "kw", pattern: /^\s*(?:[*+-]|\d+\.)\s+/m },
        { type: "fn", pattern: /\[[^\]]+\]\([^)]+\)/ },
        { type: "op", pattern: /[*_~]{1,2}/ },
      ],
    };

    GRAMMARS.typescript = GRAMMARS.js;
    GRAMMARS.javascript = GRAMMARS.js;
    GRAMMARS.jsx = GRAMMARS.js;
    GRAMMARS.tsx = GRAMMARS.js;
    GRAMMARS.jsonc = GRAMMARS.json;
    GRAMMARS.python = GRAMMARS.py;
    GRAMMARS.bash = GRAMMARS.sh;
    GRAMMARS.shell = GRAMMARS.sh;
    GRAMMARS.zsh = GRAMMARS.sh;
    GRAMMARS.yml = GRAMMARS.yaml;
    GRAMMARS.toml = GRAMMARS.yaml;
    GRAMMARS.xml = GRAMMARS.html;
    GRAMMARS.svg = GRAMMARS.html;
    GRAMMARS.scss = GRAMMARS.css;
    GRAMMARS.less = GRAMMARS.css;
    GRAMMARS.go = GRAMMARS.js;
    GRAMMARS.c = GRAMMARS.js;
    GRAMMARS.cpp = GRAMMARS.js;
    GRAMMARS.java = GRAMMARS.js;

    function tokenize(text, lang) {
      if (typeof text !== "string" || text.length === 0) return [];
      const rules = GRAMMARS[lang] || GRAMMARS.js;
      let tokens = [text];
      for (let r = 0; r < rules.length; r++) {
        const rule = rules[r];
        const next = [];
        for (let i = 0; i < tokens.length; i++) {
          const item = tokens[i];
          if (typeof item !== "string") {
            next.push(item);
            continue;
          }
          const flags = rule.pattern.flags.includes("g") ? rule.pattern.flags : rule.pattern.flags + "g";
          const re = new RegExp(rule.pattern.source, flags);
          let lastIndex = 0;
          let match;
          while ((match = re.exec(item)) !== null) {
            if (match.index > lastIndex) {
              next.push(item.slice(lastIndex, match.index));
            }
            next.push({ type: rule.type, content: match[0] });
            lastIndex = re.lastIndex;
            if (match[0].length === 0) {
              re.lastIndex++;
              lastIndex = re.lastIndex;
            }
          }
          if (lastIndex < item.length) {
            next.push(item.slice(lastIndex));
          }
        }
        tokens = next;
      }
      return tokens;
    }

    function langBadge(rel, lang) {
      const name = (rel || "").split("/").pop() || "";
      const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
      if (ext === "ts" || ext === "mts" || ext === "cts") return "TS";
      if (ext === "tsx") return "TSX";
      if (ext === "js" || ext === "mjs" || ext === "cjs") return "JS";
      if (ext === "jsx") return "JSX";
      if (ext === "py") return "PYTHON";
      if (ext === "rs") return "RUST";
      if (ext === "go") return "GO";
      if (ext === "json") return "JSON";
      if (ext === "yaml" || ext === "yml") return "YAML";
      if (ext === "toml") return "TOML";
      if (ext === "md" || ext === "markdown") return "MARKDOWN";
      if (ext === "sh" || ext === "bash" || ext === "zsh") return "SHELL";
      if (ext === "html" || ext === "htm") return "HTML";
      if (ext === "css" || ext === "scss" || ext === "less") return "CSS";
      if (ext === "sql") return "SQL";
      if (name === "Dockerfile") return "DOCKER";
      if (name === "Makefile" || name === "Justfile") return "MAKE";
      if (lang) return lang.toUpperCase();
      if (ext) return ext.toUpperCase();
      return "TXT";
    }

    function parseDiff(diffText) {
      const rawLines = (diffText || "").split("\n");
      const rows = [];
      let oldLine = 0;
      let newLine = 0;
      let addedCount = 0;
      let deletedCount = 0;

      for (let i = 0; i < rawLines.length; i++) {
        const text = rawLines[i];
        if (text.startsWith("@@")) {
          const match = text.match(/@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
          if (match) {
            oldLine = parseInt(match[1], 10);
            newLine = parseInt(match[2], 10);
          }
          rows.push({ kind: "hunk", text, oldNum: null, newNum: null });
        } else if (text.startsWith("+++") || text.startsWith("---") || text.startsWith("diff ") || text.startsWith("index ")) {
          rows.push({ kind: "meta", text, oldNum: null, newNum: null });
        } else if (text.startsWith("+")) {
          rows.push({ kind: "add", text: text.slice(1), prefix: "+", oldNum: null, newNum: newLine++ });
          addedCount++;
        } else if (text.startsWith("-")) {
          rows.push({ kind: "del", text: text.slice(1), prefix: "-", oldNum: oldLine++, newNum: null });
          deletedCount++;
        } else if (text.startsWith(" ")) {
          rows.push({ kind: "ctx", text: text.slice(1), prefix: " ", oldNum: oldLine++, newNum: newLine++ });
        } else if (text === "" && i === rawLines.length - 1) {
          // trailing newline
        } else {
          rows.push({ kind: "meta", text, oldNum: null, newNum: null });
        }
      }
      return { rows, addedCount, deletedCount };
    }

    function DiffView(props) {
      const { text, language } = props;
      const { rows, addedCount, deletedCount } = useMemo(() => parseDiff(text), [text]);

      if (!text) {
        return h("div", { className: "wb-empty" }, "No diff against HEAD for this path.");
      }

      return h("div", { className: "wb-diff-view" },
        h("div", { className: "wb-diff-bar" },
          h("span", { className: "wb-diff-badge wb-diff-badge--add" }, "+" + addedCount),
          h("span", { className: "wb-diff-badge wb-diff-badge--del" }, "-" + deletedCount),
          h("span", { className: "wb-note" }, rows.length + " lines in diff")),
        h("div", { className: "wb-diff-scroll" },
          rows.map((row, i) => {
            const isCode = row.kind === "add" || row.kind === "del" || row.kind === "ctx";
            const rowTokens = isCode ? tokenize(row.text, language) : null;
            const renderedLine = rowTokens
              ? rowTokens.map((tok, j) => typeof tok === "string" ? tok : h("span", { key: j, className: "wb-tok-" + tok.type }, tok.content))
              : row.text;

            return h("div", { key: i, className: "wb-diff-row wb-diff-row--" + row.kind },
              h("span", { className: "wb-diff-num wb-diff-num--old" }, row.oldNum !== null ? String(row.oldNum) : ""),
              h("span", { className: "wb-diff-num wb-diff-num--new" }, row.newNum !== null ? String(row.newNum) : ""),
              h("span", { className: "wb-diff-mark" }, row.kind === "hunk" ? "" : (row.prefix || " ")),
              h("span", { className: "wb-diff-line" }, row.kind === "hunk" ? row.text : (row.text === "" ? " " : renderedLine)));
          })));
    }

    function CodeEditor(props) {
      const { initialText, language, onSave, onDirtyChange, editorRef } = props;
      const [text, setText] = useState(initialText);
      const preRef = useRef(null);
      const gutterRef = useRef(null);
      const localEditorRef = useRef(null);
      const ref = editorRef || localEditorRef;

      useEffect(() => {
        setText(initialText);
      }, [initialText]);

      const lineCount = useMemo(() => text.split("\n").length, [text]);

      const gutterText = useMemo(() => {
        let res = "";
        for (let i = 1; i <= lineCount; i++) {
          res += (i === 1 ? "" : "\n") + i;
        }
        return res;
      }, [lineCount]);

      const tokens = useMemo(() => tokenize(text, language), [text, language]);

      const renderedTokens = useMemo(() => {
        return tokens.map((tok, i) => {
          if (typeof tok === "string") return tok;
          return h("span", { key: i, className: "wb-tok-" + tok.type }, tok.content);
        });
      }, [tokens]);

      const onScroll = useCallback((e) => {
        const { scrollTop, scrollLeft } = e.currentTarget;
        if (preRef.current) {
          preRef.current.style.transform = `translate(${-scrollLeft}px, ${-scrollTop}px)`;
        }
        if (gutterRef.current) {
          gutterRef.current.scrollTop = scrollTop;
        }
      }, []);

      const onInput = useCallback((e) => {
        const val = e.target.value;
        setText(val);
        if (onDirtyChange) onDirtyChange(val !== initialText);
      }, [initialText, onDirtyChange]);

      const onKeyDown = useCallback((e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          if (onSave) onSave(e.currentTarget.value);
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          const ta = e.currentTarget;
          const start = ta.selectionStart;
          const end = ta.selectionEnd;
          const val = ta.value;
          const nextVal = val.slice(0, start) + "  " + val.slice(end);
          ta.value = nextVal;
          ta.selectionStart = ta.selectionEnd = start + 2;
          setText(nextVal);
          if (onDirtyChange) onDirtyChange(nextVal !== initialText);
        }
      }, [initialText, onSave, onDirtyChange]);

      return h("div", { className: "wb-editor-wrap" },
        h("div", { className: "wb-gutter", ref: gutterRef },
          h("pre", { className: "wb-gutter-text" }, gutterText)),
        h("div", { className: "wb-editor-viewport" },
          h("div", { className: "wb-editor-highlight", ref: preRef, "aria-hidden": "true" },
            h("pre", { className: "wb-code-pre" },
              renderedTokens,
              text.endsWith("\n") ? "\n " : ""
            )),
          h("textarea", {
            ref,
            className: "wb-editor-input",
            value: text,
            onInput,
            onKeyDown,
            onScroll,
            spellCheck: false,
            wrap: "off",
            autoFocus: true,
          }))
      );
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

      const save = useCallback((textOverride) => {
        const editor = editorRef.current;
        if (open === null) return;
        const text = typeof textOverride === "string" ? textOverride : (editor ? editor.value : open.text);
        setBusy(true); setError(""); setNotice("");
        call("save", { sessionId, root: "", rel: open.rel, text, version: open.version })
          .then((data) => {
            setOpen((cur) => (cur === null ? cur : { ...cur, text, version: data.version, size: data.size }));
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
            h("span", { className: "wb-badge" }, langBadge(open.rel, open.language)),
            h("span", { className: "wb-note" }, (open.text.split("\n").length) + " lines · " + fmtSize(open.size)),
            h("span", { className: "wb-note" + (dirty ? " wb-dirty" : "") },
              h("span", { className: "wb-status-dot wb-status-dot--" + (dirty ? "dirty" : "clean") }),
              dirty ? "unsaved (Cmd+S)" : (notice || "saved")),
            h("button", { className: "wb-btn", onClick: () => showDiff(open.rel), disabled: busy }, "Diff"),
            h("button", { className: "wb-btn wb-btn--primary", onClick: () => save(), disabled: busy || !dirty }, "Save")) : null,
          diff !== null ? h("button", { className: "wb-btn", onClick: () => openFile(diff.rel), disabled: busy }, "Edit") : null,
          h("button", { className: "wb-btn", onClick: refresh, disabled: busy }, "Refresh")),
        error !== "" ? h("div", { className: "wb-err" }, error) : null,
        h("div", { className: "wb-body" },
          h("div", { className: "wb-pane wb-left" }, rows.length === 0 ? h("div", { className: "wb-empty" }, emptyText) : rows),
          h("div", { className: "wb-pane wb-right" },
            open !== null
              ? h(CodeEditor, {
                  key: open.rel + "#" + open.nonce,
                  initialText: open.text,
                  language: open.language,
                  editorRef: editorRef,
                  onDirtyChange: (isDirty) => setDirty(isDirty),
                  onSave: (currentText) => save(currentText),
                })
              : diff !== null
                ? h(DiffView, { text: diff.text, language: open?.language })
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
          for (const block of document.querySelectorAll('[data-mind-runnable="1"]')) delete block.dataset.dshRunnable;
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
        const r = await ctx.connection.rpc.call("/api", "workbench/" + method, { args: args || {} });
        if (r && r.ok) return r.value;
        const e = r && r.error;
        throw new Error(e ? e.message : "request failed");
      };
      const withCall = (Comp) => function WorkbenchView(props) { return h(Comp, Object.assign({}, props, { call })); };
      const Files = withCall(FilesTab);
      const Terminal = withCall(TerminalTab);
      installRunnableBlocks(ctx, call);
      ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register(
        { name: "conversation.session.header.utilities", id: "mind-session-probe", order: 900 }, SessionProbe));
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
