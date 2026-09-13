// editor-syntax.js — Syntax highlighting and diff parsing for Workbench
const COMMON_KW = "break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|function|if|import|in|instanceof|new|return|super|switch|this|throw|try|typeof|var|void|while|with|yield";
const JS_KW = COMMON_KW + "|let|static|implements|interface|package|private|protected|public|enum|as|async|await|of|from|type|declare|namespace|abstract|override|readonly";
const PY_KW = "and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|match|case";
const RS_KW = "as|async|await|break|const|continue|crate|dyn|else|enum|extern|false|fn|for|if|impl|in|let|loop|match|mod|move|mut|pub|ref|return|self|Self|static|struct|super|trait|true|type|unsafe|use|where|while";
const GO_KW = "break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go|goto|if|import|interface|map|package|range|return|select|struct|switch|type|var";
const SH_KW = "if|then|else|elif|fi|case|esac|for|while|until|do|done|in|function|select|time|return|exit|export|local|declare|alias";
const SQL_KW = "SELECT|FROM|WHERE|INSERT|INTO|UPDATE|DELETE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|AS|AND|OR|NOT|IN|IS|NULL|CREATE|TABLE|DROP|ALTER|INDEX|VIEW|UNION|ALL|DISTINCT|CASE|WHEN|THEN|ELSE|END";

export const GRAMMARS = {
  js: [
    { type: "com", pattern: /\/\/[^\n]*|\/\*[\s\S]*?\*\// },
    { type: "str", pattern: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`/ },
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
    { type: "tag", pattern: /<\/?(?:[a-zA-Z0-9-]+)(?=\s|>|\/)/ },
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

export function tokenize(text, lang) {
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

export function langBadge(rel, lang) {
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

export function parseDiff(diffText) {
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
