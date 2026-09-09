/**
 * dsh-ssh — браузерная половина.
 *
 * Рисуется штатными элементами харнесса (`dsh-client-ui-primitives`): те же
 * `Menu`, `Modal`, `Button`, `Input` и иконки, которыми собран остальной
 * интерфейс. Своего оформления ровно столько, сколько нужно плашке машины и
 * списку каталогов; всё остальное берёт стиль оттуда и меняется вместе с ним.
 *
 * Три поверхности:
 *   • плашка машины в ряду над вводом — Local или имя хоста;
 *   • форма подключения — поля как у Claude Code, с проверкой связи;
 *   • меню рабочих папок — своё, потому что показывает папки ВЫБРАННОЙ машины,
 *     а штатное показывает все подряд.
 */
window.__ModuleLoader__.load({
  id: "dsh-ssh",
  factory: (require) => {
    "use strict";
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const h = React.createElement;
    const { useState, useEffect, useCallback, useRef, useMemo } = React;
    const UI = require("@deepseek-ai/dsh-client-ui-primitives");

    /** Элемент харнесса; если его когда-нибудь не станет, место просто пустует. */
    const P = (name) => UI[name] ?? null;
    const Menu = P("Menu");
    const Modal = P("Modal");
    const Button = P("Button");
    const TextInput = P("Input");
    const icon = (name, props) => (UI[name] ? h(UI[name], props ?? {}) : null);

    const NS = "sidebar.dshSsh";
    const zh = {
      local: "本机", ssh: "SSH", add: "添加 SSH 连接…", probing: "检查中…",
      unreachable: "无法连接", target: "新会话运行于", cancel: "取消", save: "保存",
      nameLabel: "名称", nameHint: "此 SSH 连接的友好名称。",
      hostLabel: "SSH 主机", hostHint: "user@myserver.com 或 ~/.ssh/config 中的主机。",
      portLabel: "SSH 端口", portHint: "留空则使用默认 22 或 SSH 配置。",
      keyLabel: "SSH 密钥（可选）", keyHint: "私钥路径。留空则使用 SSH 配置或代理。",
      cwdLabel: "远程工作目录", cwdHint: "该主机上会话的工作目录。以 / 或 ~/ 开头。",
      test: "测试连接", testing: "连接中…", browse: "浏览…",
      use: "选择文件夹", loading: "加载中…", empty: "没有子文件夹",
      pickTitle: "选择远程文件夹", go: "前往", close: "关闭", recent: "最近使用",
      addWorkspace: "添加工作区…", chooseWorkspace: "选择工作区", timedOut: "主机 40 秒未响应",
    };
    const en = {
      local: "Local", ssh: "SSH", add: "Add SSH connection…", probing: "Checking…",
      unreachable: "Unreachable", target: "New sessions run on", cancel: "Cancel", save: "Save",
      nameLabel: "Name", nameHint: "A friendly name for this SSH connection.",
      hostLabel: "SSH host", hostHint: "user@myserver.com or a host from ~/.ssh/config.",
      portLabel: "SSH port", portHint: "Leave empty to use default (22) or SSH config.",
      keyLabel: "SSH key (optional)", keyHint: "Path to a private key. Leave empty to use your SSH config or agent.",
      cwdLabel: "Remote working folder", cwdHint: "Folder on that host where sessions run. Start with / or ~/.",
      test: "Test connection", testing: "Connecting…", browse: "Browse…",
      use: "Select Folder", loading: "Loading…", empty: "No subfolders",
      pickTitle: "Select Remote Folder", go: "Go", close: "Close", recent: "Recent",
      addWorkspace: "Add workspace…", chooseWorkspace: "Choose workspace", timedOut: "the host did not answer in 40 seconds",
    };

    /**
     * Своё оформление: плашка машины повторяет штатную плашку каталога (та же
     * высота, скругление и цвета), список каталогов — строки штатного обзора.
     * Значения взяты из переменных темы, поэтому светлая и тёмная работают обе.
     */
    const CSS = `
.mssh-seat{max-width:min(100%,360px);min-height:28px;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;
  border:none;border-radius:16px;align-items:center;gap:4px;padding:0 8px;font:inherit;font-size:13px;font-weight:500;
  line-height:20px;display:inline-flex}
.mssh-seat:not(:disabled):hover,.mssh-seat[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover)}
.mssh-seat-label{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}
.mssh-seat-icon{color:var(--dsw-alias-label-primary);flex:none}
.mssh-seat-chevron{color:var(--dsw-alias-label-caption);flex:none}
.mssh-hero{display:inline-flex;align-items:center}
.mssh-form{display:flex;flex-direction:column;gap:14px;min-width:min(420px,80vw)}
.mssh-field{display:flex;flex-direction:column;gap:6px}
.mssh-label{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;line-height:20px}
.mssh-hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.mssh-err{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}
.mssh-ok{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.mssh-inline{display:flex;gap:8px;align-items:center}
.mssh-inline>:first-child{flex:1 1 0;min-width:0}
.mssh-browser{display:flex;flex-direction:column;gap:10px;width:min(560px,84vw)}
.mssh-crumbs{display:flex;flex-wrap:wrap;align-items:center;gap:2px;min-height:24px}
.mssh-crumb{color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:6px;
  padding:1px 5px;font:inherit;font-size:13px;font-weight:500;line-height:20px;max-width:160px;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.mssh-crumb:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.mssh-crumb-sep{color:var(--dsw-alias-label-caption);flex:none}
.mssh-list{display:flex;flex-direction:column;gap:2px;height:280px;overflow-y:auto;padding-right:4px}
.mssh-row{text-align:left;cursor:pointer;background:0 0;border:none;border-radius:6px;flex:none;align-items:center;
  gap:6px;width:100%;height:28px;padding:4px;font:inherit;display:flex}
.mssh-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.mssh-row[data-sel=true]{background:var(--dsw-alias-interactive-bg-active,var(--dsw-alias-interactive-bg-hover))}
.mssh-row-icon{color:var(--dsw-alias-label-secondary);flex:none;display:inline-flex}
.mssh-row-name{color:var(--dsw-alias-label-primary);flex:1 1 0;min-width:0;font-size:13px;font-weight:500;
  line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mssh-status{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;padding:4px}
.mssh-recent{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.mssh-recent-label{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}`;

    function installStyles(ctx) {
      ctx.effect(() => {
        const tag = document.createElement("style");
        tag.dataset.dshSsh = "1";
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => tag.remove();
      }, "dsh-ssh: styles");
    }

    /** Шина между меню и окном обзора: они живут в разных гнёздах. */
    const picker = {
      req: null, subs: new Set(),
      open(req) { this.req = req; this.emit(); },
      close() { this.req = null; this.emit(); },
      emit() { for (const f of this.subs) f(); },
      subscribe(f) { this.subs.add(f); return () => this.subs.delete(f); },
    };

    /** Смена машины: меню папок обязано перечитать список, не дожидаясь открытия. */
    const TARGET_EVENT = "dsh-ssh:target";
    const announceTarget = () => window.dispatchEvent(new CustomEvent(TARGET_EVENT));
    function useTargetTick() {
      const [tick, setTick] = useState(0);
      useEffect(() => {
        const bump = () => setTick((v) => v + 1);
        window.addEventListener(TARGET_EVENT, bump);
        return () => window.removeEventListener(TARGET_EVENT, bump);
      }, []);
      return tick;
    }

    /** Хлебные крошки из абсолютного пути. */
    function crumbsOf(path) {
      const parts = String(path || "/").split("/").filter(Boolean);
      const out = [{ label: "/", path: "/" }];
      let acc = "";
      for (const seg of parts) { acc += "/" + seg; out.push({ label: seg, path: acc }); }
      return out;
    }

    const basename = (p) => String(p || "").split("/").filter(Boolean).pop() ?? String(p || "");

    /** Папки этой машины: те, что не лежат в тени удалённых. */
    function isLocalPath(mirrorRoot, path) {
      return !mirrorRoot || !String(path || "").startsWith(mirrorRoot + "/");
    }

    /** Папки конкретного хоста: тени под его именем. */
    function isHostPath(mirrorRoot, hostName, path) {
      if (!mirrorRoot || !hostName) return false;
      const base = `${mirrorRoot}/${hostName}`;
      const p = String(path || "");
      return p === base || p.startsWith(base + "/");
    }

    /** Настоящий путь на той машине по локальной тени. */
    function remotePathOf(mirrorRoot, hostName, path) {
      const base = `${mirrorRoot}/${hostName}`;
      const p = String(path || "");
      if (p === base) return "/";
      return p.startsWith(base + "/") ? p.slice(base.length) : p;
    }

    // ── Форма подключения ─────────────────────────────────────────────────────

    /** Поля повторяют форму Claude Code: имя, адрес, порт, ключ, рабочая папка. */
    function AddConnection({ t, open, suggestions, onCancel, onSaved, callRpc }) {
      const [f, setF] = useState({ name: "", ssh: "", port: "", identityFile: "", cwd: "" });
      const [busy, setBusy] = useState(false);
      const [err, setErr] = useState(null);
      const [probe, setProbe] = useState(null);
      useEffect(() => {
        if (!open) return;
        setF({ name: "", ssh: "", port: "", identityFile: "", cwd: "" });
        setErr(null); setProbe(null); setBusy(false);
      }, [open]);

      const set = (k) => (e) => { const v = e.target.value; setF((s) => ({ ...s, [k]: v })); setErr(null); setProbe(null); };
      // Имя из ~/.ssh/config само подставляется в адрес: там уже есть и хост, и ключ.
      const onNameBlur = () => setF((v) => (!v.ssh && suggestions.includes(v.name.trim()) ? { ...v, ssh: v.name.trim() } : v));
      const entry = () => ({
        name: f.name.trim(), ssh: f.ssh.trim() || f.name.trim(), port: f.port.trim(),
        identityFile: f.identityFile.trim(), cwd: f.cwd.trim(),
      });

      const test = async () => {
        setBusy(true); setErr(null); setProbe(null);
        try {
          const r = await callRpc("probe", { entry: entry() });
          setProbe(r);
          if (!r.ok) setErr(r.error || t("unreachable"));
        } catch (e) { setErr(String((e && e.message) || e)); }
        finally { setBusy(false); }
      };

      const save = async () => {
        setBusy(true); setErr(null);
        try {
          const r = await callRpc("addHost", entry());
          if (!r.ok) { setErr(r.error); setBusy(false); return; }
          await onSaved(r.name);
        } catch (e) { setErr(String((e && e.message) || e)); setBusy(false); }
      };

      const ready = f.name.trim() && f.cwd.trim();
      const field = (key, label, hint, extra) => h("div", { key, className: "mssh-field" }, [
        h("div", { key: "l", className: "mssh-label" }, label),
        h(TextInput, {
          key: "i", value: f[key], disabled: busy, ...extra,
          onChange: set(key),
          onKeyDown: (e) => { if (e.key === "Enter" && ready) save(); },
        }),
        h("div", { key: "h", className: "mssh-hint" }, hint),
      ]);

      return h(Modal, {
        open, onClose: onCancel, title: t("add"), closeLabel: t("close"),
        footer: h(React.Fragment, null, [
          h(Button, { key: "t", variant: "outline", onClick: test, disabled: busy || !ready }, busy ? t("testing") : t("test")),
          h(Button, { key: "c", variant: "outline", onClick: onCancel, disabled: busy }, t("cancel")),
          h(Button, { key: "s", variant: "primary", onClick: save, disabled: busy || !ready }, t("save")),
        ]),
      }, h("div", { className: "mssh-form" }, [
        field("name", t("nameLabel"), t("nameHint"), { autoFocus: true, list: "mssh-hosts", onBlur: onNameBlur }),
        h("datalist", { key: "dl", id: "mssh-hosts" }, suggestions.map((s) => h("option", { key: s, value: s }))),
        field("ssh", t("hostLabel"), t("hostHint"), { placeholder: "user@hostname" }),
        field("port", t("portLabel"), t("portHint"), { placeholder: "22", inputMode: "numeric" }),
        field("identityFile", t("keyLabel"), t("keyHint"), { placeholder: "~/.ssh/id_ed25519" }),
        h("div", { key: "cwd", className: "mssh-field" }, [
          h("div", { key: "l", className: "mssh-label" }, t("cwdLabel")),
          h("div", { key: "r", className: "mssh-inline" }, [
            h(TextInput, {
              key: "i", value: f.cwd, disabled: busy, placeholder: "/home/user/project",
              onChange: set("cwd"), onKeyDown: (e) => { if (e.key === "Enter" && ready) save(); },
            }),
            h(Button, {
              key: "b", variant: "outline",
              disabled: busy || !(f.ssh.trim() || f.name.trim()),
              onClick: () => picker.open({
                entry: entry(), path: f.cwd.trim() || "~",
                onPick: (p) => setF((v) => ({ ...v, cwd: p })),
              }),
            }, t("browse")),
          ]),
          h("div", { key: "h", className: "mssh-hint" }, t("cwdHint")),
        ]),
        err ? h("div", { key: "e", className: "mssh-err" }, err) : null,
        probe && probe.ok ? h("div", { key: "p", className: "mssh-ok" }, `${probe.agent} · ${probe.ms} ms`) : null,
      ]));
    }

    // ── Плашка машины ─────────────────────────────────────────────────────────

    /**
     * Local или имя хоста; выбор действует на следующую созданную сессию, а
     * открытые остаются на своей машине — как в Claude Code.
     */
    function MachineSeat({ callRpc, t }) {
      const [open, setOpen] = useState(false);
      const [adding, setAdding] = useState(false);
      const [data, setData] = useState({ hosts: [], suggestions: [], target: null });

      const load = useCallback(async () => {
        try { setData(await callRpc("hosts", {})); } catch { /* хостовая половина ещё не встала */ }
      }, [callRpc]);
      useEffect(() => { load(); }, [load]);

      const choose = async (name) => {
        setOpen(false);
        try {
          const r = await callRpc("setTarget", { name });
          setData((d) => ({ ...d, target: r.target }));
          announceTarget();
        } catch { /* хост пропал между открытием меню и выбором */ }
      };

      const current = data.target ?? null;
      const label = current ?? t("local");
      const hosts = data.hosts ?? [];

      const items = [
        { id: "::local", label: t("local"), icon: icon("IconPersonalizationOutline16", { size: 16 }) },
        ...(hosts.length ? [{ id: "::sep", type: "separator" }] : []),
        // Связь тут не проверяется: проба поднимает мост на той машине и стоит
        // секунд. Её место — кнопка «Test connection» в форме подключения.
        ...hosts.map((hst) => ({
          id: hst.name,
          icon: icon("IconGlobeOutline14", { size: 14 }),
          label: hst.name,
        })),
      ];

      const seat = h("button", {
        type: "button", className: "mssh-seat",
        "aria-haspopup": "menu", "aria-expanded": open,
        "aria-label": t("target"), title: `${t("target")}: ${label}`,
        onClick: () => { setOpen((v) => !v); load(); },
      }, [
        icon(current === null ? "IconPersonalizationOutline16" : "IconGlobeOutline14",
          { key: "i", className: "mssh-seat-icon", size: current === null ? 16 : 14 }),
        h("span", { key: "l", className: "mssh-seat-label" }, label),
        icon("IconChevronDownOutline14", { key: "c", className: "mssh-seat-chevron", size: 12 }),
      ]);

      return h(React.Fragment, null, [
        h(Menu, {
          key: "m", open, anchor: seat, items, align: "start", portal: true,
          selectedId: current ?? "::local",
          footer: [{ id: "::add", label: t("add"), icon: icon("IconPlusOutline16", { size: 16 }) }],
          onClose: () => setOpen(false),
          onSelect: (id) => {
            if (id === "::add") { setOpen(false); setAdding(true); return; }
            choose(id === "::local" ? null : id);
          },
        }),
        h(AddConnection, {
          key: "a", t, callRpc, open: adding, suggestions: data.suggestions ?? [],
          onCancel: () => setAdding(false),
          onSaved: async (name) => { setAdding(false); await load(); await choose(name); },
        }),
      ]);
    }

    // ── Обзор каталогов на удалённой машине ───────────────────────────────────

    function FolderBrowser({ callRpc, t }) {
      const [req, setReq] = useState(picker.req);
      useEffect(() => picker.subscribe(() => setReq(picker.req)), []);
      const [st, setSt] = useState(null);
      const [sel, setSel] = useState(null);

      const go = useCallback(async (path) => {
        setSt({ loading: true }); setSel(null);
        // Своё ограничение по времени: если ssh подвиснет, крутилка иначе останется навсегда.
        const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error(t("timedOut"))), 40000));
        try {
          const r = await Promise.race([callRpc("listDir", { entry: picker.req?.entry, path }), timeout]);
          if (r && r.ok) setSt({ path: r.path, parent: r.parent, entries: r.entries });
          else setSt({ error: (r && r.error) || "не удалось прочитать каталог", path });
        } catch (e) { setSt({ error: String((e && e.message) || e), path }); }
      }, [callRpc, t]);

      useEffect(() => { if (req) { setSt(null); setSel(null); go(req.path || "~"); } }, [req, go]);
      if (!req) return null;

      const dirs = (st?.entries ?? []).filter((e) => e.isDirectory);
      const join = (n) => `${String(st.path).replace(/\/$/, "")}/${n}`;
      const chosen = sel ? join(sel) : st?.path;
      const close = () => { req.onCancel?.(); picker.close(); };

      const row = (key, name, { selected = false, onClick, onDoubleClick }) => h("button", {
        key, type: "button", className: "mssh-row", "data-sel": String(selected), onClick, onDoubleClick,
      }, [
        h("span", { key: "i", className: "mssh-row-icon" }, icon("IconFolderClose16", { size: 16 })),
        h("span", { key: "n", className: "mssh-row-name" }, name),
      ]);

      return h(Modal, {
        open: true, onClose: close, title: t("pickTitle"), closeLabel: t("close"),
        footer: h(React.Fragment, null, [
          h(Button, { key: "c", variant: "outline", onClick: close }, t("cancel")),
          h(Button, { key: "o", variant: "primary", disabled: !chosen, onClick: () => { req.onPick(chosen); picker.close(); } }, t("use")),
        ]),
      }, h("div", { className: "mssh-browser" }, [
        (req.recent ?? []).length ? h("div", { key: "r", className: "mssh-recent" }, [
          h("span", { key: "l", className: "mssh-recent-label" }, t("recent")),
          ...req.recent.map((p) => h(Button, { key: p, variant: "outline", onClick: () => go(p) }, basename(p))),
        ]) : null,
        h("div", { key: "c", className: "mssh-crumbs" }, st?.path
          // Разделитель со второй крошки: корень сам нарисован слэшем.
          ? crumbsOf(st.path).flatMap((c, i) => [
              i > 1 ? h("span", { key: "s" + i, className: "mssh-crumb-sep" }, "/") : null,
              h("button", { key: "c" + i, type: "button", className: "mssh-crumb", onClick: () => go(c.path) }, c.label),
            ])
          : null),
        h("div", { key: "l", className: "mssh-list" },
          st?.loading ? h("div", { className: "mssh-status" }, t("loading"))
          : st?.error ? h("div", { className: "mssh-err" }, st.error)
          : [
              st?.parent ? row("..", "..", { onClick: () => go(st.parent) }) : null,
              ...dirs.map((e) => row(e.name, e.name, {
                selected: sel === e.name,
                onClick: () => setSel(e.name),
                onDoubleClick: () => go(join(e.name)),
              })),
              !dirs.length ? h("div", { key: "e", className: "mssh-status" }, t("empty")) : null,
            ]),
      ]));
    }

    // ── Меню рабочих папок ────────────────────────────────────────────────────

    /**
     * Замещает штатное меню каталога, оставляя штатную плашку на месте.
     *
     * Причина одна: у каждой машины свои папки. Штатное меню показывает все
     * подряд, а выбрав сервер, видеть надо его папки. Локальные и удалённые
     * различаются по пути: тень удалённой лежит под корнем теней и именем хоста.
     *
     * Добавление папки идёт по цели: для Local — тот же системный выбор, что
     * делал штатный занимающий, для сервера — обзор по ssh.
     */
    function WorkspaceMenu(props) {
      const { open, anchorRef, selectedId, onPick, onClose, useWorkspaces, callRpc, pick, t } = props;
      const snapshot = useWorkspaces((s) => s);
      const tick = useTargetTick();
      const [info, setInfo] = useState({ target: null, mirrorRoot: null, hosts: [] });
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState(null);
      const alive = useRef(true);
      useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

      const reload = useCallback(async () => {
        try { const d = await callRpc("hosts", {}); if (alive.current) setInfo(d); }
        catch { /* хостовая половина ещё не встала — показываем как есть */ }
      }, [callRpc]);
      useEffect(() => { reload(); }, [reload, tick]);
      useEffect(() => { if (open) reload(); }, [open, reload]);

      const { target, mirrorRoot } = info;
      const host = (info.hosts ?? []).find((x) => x.name === target) ?? null;

      const items = useMemo(() => {
        const all = snapshot.items ?? [];
        const mine = target === null
          ? all.filter((w) => isLocalPath(mirrorRoot, w.path))
          : all.filter((w) => isHostPath(mirrorRoot, target, w.path));
        return mine.map((w) => ({
          id: w.workspaceId,
          label: w.title,
          icon: icon("IconFolderClose16", { size: 16 }),
          disabled: busy,
        }));
      }, [snapshot.items, target, mirrorRoot, busy]);

      const adopt = useCallback(async (remotePath) => {
        setBusy(true); setError(null);
        try {
          const r = await callRpc("adoptFolder", { name: target, path: remotePath });
          if (!r.ok) { setError(r.error); return; }
          if (alive.current) onPick(r.workspaceId);
        } catch (e) { setError(String((e && e.message) || e)); }
        finally { if (alive.current) setBusy(false); }
      }, [callRpc, target, onPick]);

      const adoptLocal = useCallback(async (path) => {
        setBusy(true); setError(null);
        try {
          const r = await callRpc("adoptFolder", { name: null, path });
          if (!r.ok) { setError(r.error); return; }
          if (alive.current) onPick(r.workspaceId);
        } catch (e) { setError(String((e && e.message) || e)); }
        finally { if (alive.current) setBusy(false); }
      }, [callRpc, onPick]);

      const openAdd = useCallback(() => {
        onClose();
        setError(null);
        if (!host) {
          // Local — прежний системный выбор, ровно тот же вызов.
          pick().then((path) => { if (path !== null && alive.current) adoptLocal(path); },
                      (r) => alive.current && setError(r instanceof Error ? r.message : String(r)));
          return;
        }
        picker.open({
          entry: { name: host.name, ssh: host.ssh, port: host.port, identityFile: host.identityFile, cwd: host.cwd },
          path: (host.recent ?? [])[0] || host.cwd || "~",
          recent: host.recent ?? [],
          onPick: (p) => adopt(p),
        });
      }, [host, pick, adopt, adoptLocal, onClose]);

      // Пустой список — сразу обзор, без меню из одного пункта: так же ведёт
      // себя штатное меню, и на свежем сервере это единственное осмысленное действие.
      const onlyAdd = open && !busy && snapshot.phase === "ready" && items.length === 0;
      useEffect(() => { if (onlyAdd) openAdd(); }, [onlyAdd, openAdd]);

      return h(React.Fragment, null, [
        h(Menu, {
          key: "m",
          open: open && !onlyAdd,
          anchor: null,
          getAnchorRect: () => anchorRef?.current?.getBoundingClientRect() ?? null,
          items, selectedId, side: "bottom", portal: true,
          footer: [{ id: "::add", label: t("addWorkspace"), icon: icon("IconPlusOutline16", { size: 16 }), disabled: busy }],
          onClose,
          onSelect: (id) => (id === "::add" ? openAdd() : onPick(id)),
        }),
        error ? h(Modal, {
          key: "e", open: true, onClose: () => setError(null), title: t("chooseWorkspace"), closeLabel: t("close"),
          footer: h(Button, { variant: "primary", onClick: () => { setError(null); openAdd(); } }, t("addWorkspace")),
        }, h("div", { className: "mssh-err" }, error)) : null,
      ]);
    }

    /**
     * Тот же выбор для кнопки «добавить» в боковой панели.
     *
     * Контракт дырки: на каждый подъём `open` ровно один исход — onPicked,
     * onCancel или onError. Взводимся один раз за открытие, иначе повторный
     * рендер запустит второй выбор.
     */
    function DirectoryFlow(props) {
      const { open, onPicked, onCancel, onError, pick, callRpc } = props;
      const armed = useRef(false);
      const alive = useRef(true);
      useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
      useEffect(() => {
        if (!open) { armed.current = false; return; }
        if (armed.current) return;
        armed.current = true;
        (async () => {
          let host = null;
          try { const d = await callRpc("hosts", {}); host = (d.hosts ?? []).find((x) => x.name === d.target) ?? null; }
          catch (e) { if (alive.current) onError(String((e && e.message) || e)); return; }
          if (!alive.current) return;
          if (!host) {
            pick().then((path) => { if (alive.current) (path === null ? onCancel() : onPicked(path)); },
                        (r) => { if (alive.current) onError(r instanceof Error ? r.message : String(r)); });
            return;
          }
          picker.open({
            entry: { name: host.name, ssh: host.ssh, port: host.port, identityFile: host.identityFile, cwd: host.cwd },
            path: (host.recent ?? [])[0] || host.cwd || "~",
            recent: host.recent ?? [],
            onPick: async (p) => {
              try {
                const r = await callRpc("adoptFolder", { name: host.name, path: p });
                if (!alive.current) return;
                if (r.ok) onPicked(r.path); else onError(r.error);
              } catch (e) { if (alive.current) onError(String((e && e.message) || e)); }
            },
            onCancel: () => { if (alive.current) onCancel(); },
          });
        })();
      }, [open, pick, callRpc, onPicked, onCancel, onError]);
      return null;
    }

    /**
     * Ставит плашку машины в ряд рядом со штатными, ничего не замещая.
     *
     * Гнёзда того ряда одиночные и заняты выбором каталога и пресета, поэтому
     * встать туда через реестр нельзя. Портал цепляется к самому ряду: находим
     * кнопку выбора каталога и подвешиваем свой узел её соседом. Если харнесс
     * поменяет разметку, узел просто не найдётся и плашки не будет — молча, но
     * без поломки остального.
     */
    function HeroPortal({ callRpc, t }) {
      const ReactDOM = require("react-dom");
      const [host, setHost] = useState(null);
      useEffect(() => {
        let node = null;
        const place = () => {
          // Точное совпадение, а не вхождение: в панели есть «Add workspace»,
          // и она встречается в разметке раньше — по вхождению цеплялись к ней.
          const anchor = [...document.querySelectorAll('button[aria-label="Choose workspace"]')]
            .find((b) => b.parentElement && b.parentElement.querySelectorAll("button").length > 1);
          const row = anchor?.parentElement;
          if (!row) { if (node) { node.remove(); node = null; setHost(null); } return; }
          if (node && node.parentElement === row) return;
          node = document.createElement("span");
          node.dataset.dshSsh = "hero";
          node.className = "mssh-hero";
          row.appendChild(node);
          setHost(node);
        };
        place();
        const mo = new MutationObserver(place);
        mo.observe(document.body, { childList: true, subtree: true });
        return () => { mo.disconnect(); node?.remove(); };
      }, []);
      if (!host) return null;
      return ReactDOM.createPortal(h(MachineSeat, { callRpc, t }), host);
    }

    const inject = ["slots", "locale", "connection", "sessions", "uiWorkspace"];

    function apply(ctx) {
      installStyles(ctx);
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-ssh: dictionaries");
      const t = ctx.locale.bind(NS);
      const rpc = async (method, args) => {
        const r = await ctx.connection.rpc.call("/api", method, { args: args || {} });
        if (r && r.ok) return r.value;
        const e = r && r.error;
        throw new Error(e ? e.code + ": " + e.message : "rpc failed");
      };
      const callRpc = (method, args) => rpc("dshSsh/" + method, args);

      ctx.slots.inject("conversation.hero.workspace", () =>
        ctx.slots.inject("sidebar.workspaces.directoryFlow", function* () {
          // Штатные занимающие стоят с приоритетом 0; харнесс разрешает перекрыть
          // их меньшим приоритетом — рисуется нижний. Так штатный пакет остаётся
          // смонтированным, а ведём выбор мы.
          yield ctx.slots.register({
            name: "conversation.hero.workspace", priority: -10, locale: NS,
            inject: () => ({ callRpc, pick: () => ctx.uiWorkspace.pickDirectory(), t }),
          }, WorkspaceMenu);
          yield ctx.slots.register({
            name: "sidebar.workspaces.directoryFlow", priority: -10, locale: NS,
            inject: () => ({ callRpc, pick: () => ctx.uiWorkspace.pickDirectory(), t }),
          }, DirectoryFlow);
        }));

      ctx.slots.inject("shell.overlay", () => ctx.slots.register({
        name: "shell.overlay", id: "dsh-ssh-hero-chip", locale: NS,
        inject: () => ({ callRpc, t }),
      }, HeroPortal));
      ctx.slots.inject("shell.overlay", () => ctx.slots.register({
        name: "shell.overlay", id: "dsh-ssh-folder-picker", locale: NS,
        inject: () => ({ callRpc, t }),
      }, FolderBrowser));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
