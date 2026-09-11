// dsh-updater — browser client plugin.
// Adds an "Updates" page to Settings and an update indicator badge to conversation header.
// Supports one-click updates, live step logs, and automatic reconnect/reload after restart.
window.__ModuleLoader__.load({
  id: "dsh-updater",
  factory: (require) => {
    "use strict";
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const h = React.createElement;
    const { useState, useEffect, useRef, useMemo } = React;

    const PLUGIN_ID = "dsh-updater";
    const NS = "settings.dshUpdater";

    const ru = {
      nav: "Обновления",
      badge: "Доступно обновление",
      updateAvailable: "Доступно обновление",
      upToDate: "Установлена последняя версия",
      checkUpdates: "Проверить обновления",
      checking: "Проверка...",
      updateAll: "Обновить всё и перезапустить",
      updating: "Обновление...",
      restart: "Перезапустить DSH",
      restarting: "Перезапуск DeepSeek Harness...",
      reconnectHint: "Автоматическое переподключение после запуска сервера.",
      dshCore: "DeepSeek Harness",
      plugins: "Плагины и расширения",
      currentVersion: "Текущая версия",
      latestVersion: "Последняя версия",
      published: "Дата публикации",
      branch: "Ветка репозитория",
      installedPlugins: "Установлено плагинов",
      updateDsh: "Обновить DSH и перезапустить",
      updatePlugins: "Обновить плагины",
      logsTitleSuccess: "Шаги обновления выполнены успешно:",
      logsTitleError: "Обновление завершилось с ошибками:",
    };

    const en = {
      nav: "Updates",
      badge: "Update Available",
      updateAvailable: "Update Available",
      upToDate: "Up to date",
      checkUpdates: "Check for Updates",
      checking: "Checking...",
      updateAll: "Update All & Restart",
      updating: "Updating...",
      restart: "Restart DSH",
      restarting: "Restarting DeepSeek Harness...",
      reconnectHint: "Reconnecting automatically once the server is back online.",
      dshCore: "DeepSeek Harness",
      plugins: "Plugins & Extensions",
      currentVersion: "Current version",
      latestVersion: "Latest version",
      published: "Published",
      branch: "Repository branch",
      installedPlugins: "Installed plugins",
      updateDsh: "Update DSH & Restart",
      updatePlugins: "Update Plugins",
      logsTitleSuccess: "Update steps completed successfully:",
      logsTitleError: "Update completed with errors:",
    };

    const zh = {
      nav: "系统更新",
      badge: "有新版本可用",
      updateAvailable: "有新版本可用",
      upToDate: "已是最新版本",
      checkUpdates: "检查更新",
      checking: "正在检查...",
      updateAll: "一键更新并重启",
      updating: "正在更新...",
      restart: "重启 DSH",
      restarting: "正在重启 DeepSeek Harness...",
      reconnectHint: "服务启动后将自动重新连接。",
      dshCore: "DeepSeek Harness",
      plugins: "插件与扩展",
      currentVersion: "当前版本",
      latestVersion: "最新版本",
      published: "发布日期",
      branch: "仓库分支",
      installedPlugins: "已安装插件",
      updateDsh: "更新 DSH 并重启",
      updatePlugins: "更新插件",
      logsTitleSuccess: "更新步骤执行成功：",
      logsTitleError: "更新过程中出现错误：",
    };

    // ── Clean SVG Icons (Matching DSH primitives style) ──────────────────────────
    const IconRefresh = ({ size = 16, className }) =>
      h("svg", {
        width: size,
        height: size,
        className,
        viewBox: "0 0 16 16",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: { flexShrink: 0 },
      },
        h("path", { d: "M1.5 2v4h4" }),
        h("path", { d: "M14.5 14v-4h-4" }),
        h("path", { d: "M2.8 10a6 6 0 0 0 9.7 2.2L14.5 10M13.2 6A6 6 0 0 0 3.5 3.8L1.5 6" })
      );

    const IconDownload = ({ size = 16, className }) =>
      h("svg", {
        width: size,
        height: size,
        className,
        viewBox: "0 0 16 16",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: { flexShrink: 0 },
      },
        h("path", { d: "M8 2v9M4.5 7.5L8 11l3.5-3.5" }),
        h("path", { d: "M2 13.5h12" })
      );

    const IconCore = ({ size = 16, className }) =>
      h("svg", {
        width: size,
        height: size,
        className,
        viewBox: "0 0 16 16",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: { flexShrink: 0 },
      },
        h("rect", { x: "3", y: "3", width: "10", height: "10", rx: "2" }),
        h("path", { d: "M6 1v2M10 1v2M6 13v2M10 13v2M1 6h2M1 10h2M13 6h2M13 10h2" })
      );

    const IconPackage = ({ size = 16, className }) =>
      h("svg", {
        width: size,
        height: size,
        className,
        viewBox: "0 0 16 16",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: { flexShrink: 0 },
      },
        h("path", { d: "M8 1.5l6 3.46v6.08L8 14.5 2 11.04V4.96L8 1.5z" }),
        h("path", { d: "M8 1.5v6.5m0 0l6-3.46M8 8l-6-3.46" })
      );

    const IconRestart = ({ size = 16, className }) =>
      h("svg", {
        width: size,
        height: size,
        className,
        viewBox: "0 0 16 16",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: { flexShrink: 0 },
      },
        h("path", { d: "M8 2.5a5.5 5.5 0 1 1-4.7 2.7" }),
        h("path", { d: "M3.3 2v3.5H6.8" })
      );

    const CSS = [
      ".up-root{display:flex;flex-direction:column;gap:20px;color:var(--dsw-alias-label-primary);font-family:inherit}",
      ".up-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;padding-bottom:16px;border-bottom:1px solid var(--dsw-alias-border-l1)}",
      ".up-title{font-size:16px;font-weight:600;line-height:24px;color:var(--dsw-alias-label-primary)}",
      ".up-sub{font-size:13px;color:var(--dsw-alias-label-secondary);line-height:20px;margin-top:2px}",
      ".up-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}",
      ".up-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;font-size:13px;font-weight:500;line-height:20px;height:32px;padding:0 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);cursor:pointer;transition:background 0.12s ease,border-color 0.12s ease;user-select:none}",
      ".up-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l1)}",
      ".up-btn:active:not(:disabled){background:var(--dsw-alias-interactive-bg-active)}",
      ".up-btn:disabled{opacity:0.5;cursor:not-allowed}",
      ".up-btn--primary{background:var(--dsw-alias-brand-primary);color:#fff;border-color:transparent}",
      ".up-btn--primary:hover:not(:disabled){filter:brightness(1.08)}",
      ".up-grid{display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:16px}",
      ".up-card{display:flex;flex-direction:column;gap:14px;padding:16px;border-radius:12px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}",
      ".up-card-header{display:flex;align-items:center;justify-content:space-between;gap:12px}",
      ".up-card-title{font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-primary)}",
      ".up-card-body{display:flex;flex-direction:column;gap:8px;font-size:13px;line-height:20px}",
      ".up-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:3px 0}",
      ".up-label{color:var(--dsw-alias-label-secondary);font-size:13px}",
      ".up-val{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;color:var(--dsw-alias-label-primary)}",
      ".up-badge{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:500;line-height:16px;padding:2px 8px;border-radius:999px;white-space:nowrap}",
      ".up-badge--ok{background:rgba(34,197,94,0.12);color:var(--dsw-alias-state-success-primary);border:1px solid rgba(34,197,94,0.25)}",
      ".up-badge--warn{background:rgba(245,158,11,0.12);color:var(--dsw-alias-state-warn-primary);border:1px solid rgba(245,158,11,0.25)}",
      ".up-badge--info{background:rgba(59,130,246,0.12);color:var(--dsw-alias-brand-primary);border:1px solid rgba(59,130,246,0.25)}",
      ".up-badge-dot{width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block}",
      ".up-badge-dot--pulse{animation:up-pulse 2s infinite ease-in-out}",
      "@keyframes up-pulse{0%{opacity:1;transform:scale(1)}50%{opacity:0.35;transform:scale(1.15)}100%{opacity:1;transform:scale(1)}}",
      ".up-list{display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto;margin-top:4px}",
      ".up-item{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);font-size:12px}",
      ".up-steps{display:flex;flex-direction:column;gap:8px;margin-top:10px;padding:12px;border-radius:10px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px}",
      ".up-step-item{display:flex;align-items:flex-start;gap:8px;line-height:18px}",
      ".up-step-status{font-weight:600;min-width:60px}",
      ".up-step-status--success{color:var(--dsw-alias-state-success-primary)}",
      ".up-step-status--failed{color:var(--dsw-alias-state-error-primary)}",
      ".up-step-status--running{color:var(--dsw-alias-brand-primary)}",
      ".up-step-status--skipped{color:var(--dsw-alias-label-tertiary)}",
      ".up-step-out{font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:pre-wrap;word-break:break-all;margin-top:2px}",
      ".up-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999;color:#fff}",
      ".up-overlay-box{display:flex;flex-direction:column;align-items:center;gap:16px;padding:32px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:16px;max-width:420px;text-align:center;box-shadow:0 16px 36px rgba(0,0,0,0.35);color:var(--dsw-alias-label-primary)}",
      ".up-spinner{width:32px;height:32px;border:3px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);border-radius:50%;animation:up-spin 0.8s linear infinite}",
      "@keyframes up-spin{to{transform:rotate(360deg)}}",
      ".up-sidebar-btn{display:flex;align-items:center;gap:8px;width:calc(100% + 4px);height:42px;margin:4px -2px;padding:0 10px 0 8px;box-sizing:border-box;border:none;border-radius:12px;background:transparent;cursor:pointer;overflow:hidden;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:14px;line-height:22px;transition:background 0.12s ease}",
      ".up-sidebar-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}",
      ".up-sidebar-btn.rail{width:36px;height:36px;margin:4px 0 6px;justify-content:center;gap:0;padding:0;border-radius:50%;position:relative}",
      ".up-sidebar-btn.rail .up-badge-dot{position:absolute;top:6px;right:6px;width:7px;height:7px;background:var(--dsw-alias-brand-primary)}",
      ".up-pill{font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;padding:1px 6px;border-radius:999px;background:rgba(59,130,246,0.14);color:var(--dsw-alias-brand-primary);margin-left:auto}",
      ".up-header-chip{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 8px;border-radius:6px;font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-fill-tsp-secondary);border:1px solid transparent;cursor:pointer;user-select:none;transition:all 0.12s ease}",
      ".up-header-chip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
    ].join("\n");

    function installStyles(ctx) {
      if (typeof document === "undefined") return;
      ctx.effect(() => {
        const tag = document.createElement("style");
        tag.dataset.plugin = PLUGIN_ID;
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => tag.remove();
      }, "dsh-updater: styles");
    }

    // Polling helper for server restart
    function startReconnectPolling(onSuccess) {
      let interval = setInterval(() => {
        fetch(window.location.href, { method: "HEAD", cache: "no-cache" })
          .then((res) => {
            if (res.status === 200 || res.status === 401 || res.status === 302) {
              clearInterval(interval);
              setTimeout(() => {
                window.location.reload();
              }, 400);
            }
          })
          .catch(() => {
            // Still waiting for server boot
          });
      }, 1000);

      return () => clearInterval(interval);
    }

    // ── Settings Page: UpdatesSection ──────────────────────────────────────────
    function UpdatesSection({ callRpc }) {
      const [loading, setLoading] = useState(true);
      const [checking, setChecking] = useState(false);
      const [executing, setExecuting] = useState(false);
      const [status, setStatus] = useState(null);
      const [error, setError] = useState(null);
      const [updateResult, setUpdateResult] = useState(null);
      const [restarting, setRestarting] = useState(false);

      const checkUpdates = (force = false) => {
        setChecking(true);
        setError(null);
        callRpc("check", { force: Boolean(force) })
          .then((res) => {
            setStatus(res);
            setLoading(false);
            setChecking(false);
          })
          .catch((err) => {
            setError(String((err && err.message) || err));
            setLoading(false);
            setChecking(false);
          });
      };

      useEffect(() => {
        checkUpdates(false);
      }, []);

      const runUpdate = (target, restart = true) => {
        setExecuting(true);
        setError(null);
        setUpdateResult(null);

        callRpc("update", { target, restart })
          .then((res) => {
            setUpdateResult(res);
            setExecuting(false);
            if (restart && res.ok) {
              setRestarting(true);
              startReconnectPolling(() => {
                window.location.reload();
              });
            }
          })
          .catch((err) => {
            setError(String((err && err.message) || err));
            setExecuting(false);
          });
      };

      const doRestart = () => {
        if (!confirm("Restart DeepSeek Harness now?")) return;
        setRestarting(true);
        callRpc("restart", {})
          .then(() => {
            startReconnectPolling(() => {
              window.location.reload();
            });
          })
          .catch((err) => {
            alert("Restart failed: " + err);
            setRestarting(false);
          });
      };

      const dshInfo = status && status.dsh;
      const pluginsInfo = status && status.plugins;
      const hasAnyUpdates = status && status.hasAnyUpdates;

      return h("section", { className: "up-root" },
        // Restarting Overlay
        restarting && h("div", { className: "up-overlay" },
          h("div", { className: "up-overlay-box" },
            h("div", { className: "up-spinner" }),
            h("div", { style: { fontSize: "15px", fontWeight: 600 } }, "Restarting DeepSeek Harness..."),
            h("div", { style: { fontSize: "12.5px", color: "var(--dsw-alias-label-secondary)" } },
              "Reconnecting automatically once the server is back online."))),

        // Header
        h("div", { className: "up-head" },
          h("div", null,
            h("div", { className: "up-title" }, "Updates"),
            h("div", { className: "up-sub" }, "Manage DeepSeek Harness core and community plugin updates.")),
          h("div", { className: "up-actions" },
            h("button", {
              className: "up-btn",
              onClick: () => checkUpdates(true),
              disabled: checking || executing || restarting,
            },
              h(IconRefresh, { size: 14 }),
              checking ? "Checking..." : "Check for Updates"),
            hasAnyUpdates && h("button", {
              className: "up-btn up-btn--primary",
              onClick: () => runUpdate("all", true),
              disabled: checking || executing || restarting,
            },
              h(IconDownload, { size: 14 }),
              "Update All & Restart"),
            h("button", {
              className: "up-btn",
              onClick: doRestart,
              disabled: checking || executing || restarting,
              title: "Restart DSH server process",
            },
              h(IconRestart, { size: 14 }),
              "Restart DSH"))),

        // Error banner
        error && h("div", {
          style: {
            padding: "10px 14px",
            borderRadius: "8px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "var(--dsw-alias-state-error-primary)",
            fontSize: "13px",
          },
        }, "Error: " + error),

        // Main Cards Grid
        h("div", { className: "up-grid" },
          // Card 1: DSH Core
          h("div", { className: "up-card" },
            h("div", { className: "up-card-header" },
              h("div", { className: "up-card-title" },
                h(IconCore, { size: 16 }),
                "DeepSeek Harness"),
              dshInfo && (dshInfo.updateAvailable
                ? h("span", { className: "up-badge up-badge--warn" },
                    h("span", { className: "up-badge-dot up-badge-dot--pulse" }), "Update Available")
                : h("span", { className: "up-badge up-badge--ok" },
                    h("span", { className: "up-badge-dot" }), "Up to date"))),
            h("div", { className: "up-card-body" },
              h("div", { className: "up-row" },
                h("span", { className: "up-label" }, "Current version"),
                h("span", { className: "up-val" }, dshInfo ? dshInfo.current : "...")),
              h("div", { className: "up-row" },
                h("span", { className: "up-label" }, "Latest version"),
                h("span", { className: "up-val" }, dshInfo ? dshInfo.latest : "...")),
              dshInfo && dshInfo.publishedAt && h("div", { className: "up-row" },
                h("span", { className: "up-label" }, "Published"),
                h("span", { className: "up-val", style: { fontSize: "11.5px" } },
                  new Date(dshInfo.publishedAt).toLocaleDateString())),
              h("div", { style: { marginTop: "8px", display: "flex", gap: "8px" } },
                h("button", {
                  className: "up-btn up-btn--primary",
                  style: { flex: 1 },
                  onClick: () => runUpdate("dsh", true),
                  disabled: !dshInfo || !dshInfo.updateAvailable || executing || restarting,
                },
                  h(IconDownload, { size: 14 }),
                  "Update DSH & Restart")))),

          // Card 2: Plugins Monorepo
          h("div", { className: "up-card" },
            h("div", { className: "up-card-header" },
              h("div", { className: "up-card-title" },
                h(IconPackage, { size: 16 }),
                "Plugins & Extensions"),
              pluginsInfo && (pluginsInfo.hasUpdates
                ? h("span", { className: "up-badge up-badge--warn" },
                    h("span", { className: "up-badge-dot up-badge-dot--pulse" }), `${pluginsInfo.repoBehind} behind`)
                : h("span", { className: "up-badge up-badge--ok" },
                    h("span", { className: "up-badge-dot" }), "Up to date"))),
            h("div", { className: "up-card-body" },
              h("div", { className: "up-row" },
                h("span", { className: "up-label" }, "Branch"),
                h("span", { className: "up-val" }, pluginsInfo ? pluginsInfo.repoBranch : "main")),
              h("div", { className: "up-row" },
                h("span", { className: "up-label" }, "Installed plugins"),
                h("span", { className: "up-val" }, pluginsInfo ? pluginsInfo.items.length : "0")),
              pluginsInfo && h("div", { className: "up-list" },
                pluginsInfo.items.map((item) => h("div", { key: item.name, className: "up-item" },
                  h("span", { style: { fontWeight: 500 } }, item.name),
                  h("span", { style: { color: "var(--dsw-alias-label-tertiary)", fontFamily: "ui-monospace, monospace" } },
                    "v" + item.currentVersion)))),
              h("div", { style: { marginTop: "8px", display: "flex", gap: "8px" } },
                h("button", {
                  className: "up-btn",
                  style: { flex: 1 },
                  onClick: () => runUpdate("plugins", true),
                  disabled: executing || restarting,
                },
                  h(IconRefresh, { size: 14 }),
                  "Build & Refresh Plugins"))))),

        // Execution Results & Logs
        updateResult && h("div", { className: "up-steps" },
          h("div", { style: { fontWeight: 600, marginBottom: "4px" } },
            updateResult.ok ? "Update Steps Succeeded:" : "Update Completed with Errors:"),
          updateResult.steps.map((st, i) => h("div", { key: i, className: "up-step-item" },
            h("span", { className: `up-step-status up-step-status--${st.status}` }, `[${st.status.toUpperCase()}]`),
            h("div", { style: { flex: 1 } },
              h("div", null, st.step + (st.durationMs ? ` (${st.durationMs}ms)` : "")),
              st.output && h("div", { className: "up-step-out" }, st.output),
              st.error && h("div", { className: "up-step-out", style: { color: "var(--dsw-alias-state-error-primary)" } }, st.error))))));
    }

    // ── Header Action Badge: UpdateBadgeAction ─────────────────────────────────
    function UpdateBadgeAction({ callRpc }) {
      const [status, setStatus] = useState(null);

      useEffect(() => {
        let alive = true;
        callRpc("check", { force: false })
          .then((res) => {
            if (alive) setStatus(res);
          })
          .catch(() => {});

        // Check periodically every 15 minutes
        const interval = setInterval(() => {
          callRpc("check", { force: false })
            .then((res) => {
              if (alive) setStatus(res);
            })
            .catch(() => {});
        }, 15 * 60 * 1000);

        return () => {
          alive = false;
          clearInterval(interval);
        };
      }, []);

      if (!status || !status.hasAnyUpdates) {
        return null;
      }

      const latestVer = status.dsh && status.dsh.updateAvailable ? status.dsh.latest : null;
      const label = latestVer ? `Update v${latestVer}` : "Update available";

      const openSettingsModal = () => {
        const trigger = document.querySelector('button[aria-haspopup="dialog"]');
        if (trigger) {
          trigger.click();
          setTimeout(() => {
            const navCells = Array.from(document.querySelectorAll('nav button'));
            const updateTab = navCells.find(b => b.textContent && (b.textContent.includes("Updates") || b.textContent.includes("Обновления") || b.textContent.includes("系统更新")));
            if (updateTab) updateTab.click();
          }, 60);
        }
      };

      return h("button", {
        type: "button",
        className: "up-header-chip",
        title: "Click to open Updates in Settings",
        onClick: openSettingsModal,
      },
        h(IconDownload, { size: 13 }),
        h("span", null, label));
    }

    // ── Sidebar Footer Action: UpdateSidebarAction ─────────────────────────────
    function UpdateSidebarAction({ wide, callRpc }) {
      const [status, setStatus] = useState(null);

      useEffect(() => {
        let alive = true;
        const doCheck = () => {
          callRpc("check", { force: false })
            .then((res) => {
              if (alive) setStatus(res);
            })
            .catch(() => {});
        };
        doCheck();
        const interval = setInterval(doCheck, 15 * 60 * 1000);
        return () => {
          alive = false;
          clearInterval(interval);
        };
      }, []);

      if (!status || !status.hasAnyUpdates) {
        return null;
      }

      const latestVer = status.dsh && status.dsh.updateAvailable ? status.dsh.latest : null;

      const openSettingsModal = () => {
        const trigger = document.querySelector('button[aria-haspopup="dialog"]');
        if (trigger) {
          trigger.click();
          setTimeout(() => {
            const navCells = Array.from(document.querySelectorAll('nav button'));
            const updateTab = navCells.find(b => b.textContent && (b.textContent.includes("Updates") || b.textContent.includes("Обновления") || b.textContent.includes("系统更新")));
            if (updateTab) updateTab.click();
          }, 60);
        }
      };

      if (!wide) {
        return h("button", {
          type: "button",
          className: "up-sidebar-btn rail",
          title: latestVer ? `Update available: v${latestVer}` : "Update available",
          onClick: openSettingsModal,
        },
          h(IconDownload, { size: 16 }),
          h("span", { className: "up-badge-dot up-badge-dot--pulse" })
        );
      }

      return h("button", {
        type: "button",
        className: "up-sidebar-btn",
        title: latestVer ? `Update available: v${latestVer}` : "Update available",
        onClick: openSettingsModal,
      },
        h(IconDownload, { size: 16 }),
        h("span", null, "Updates"),
        latestVer && h("span", { className: "up-pill" }, `v${latestVer}`)
      );
    }

    // ── Plugin Apply ───────────────────────────────────────────────────────────
    const inject = ["slots", "locale", "connection"];

    function apply(ctx) {
      installStyles(ctx);

      ctx.effect(() => ctx.locale.register(NS, { ru, en, zh }), "dsh-updater: locale");
      const t = ctx.locale.bind(NS);

      const callRpc = async (method, args) => {
        let payload = {};
        if (args && typeof args === "object" && !Array.isArray(args)) {
          payload = args;
        } else if (typeof args === "boolean") {
          payload = { force: args };
        }
        const r = await ctx.connection.rpc.call("/api", "dshUpdater/" + method, { args: payload });
        if (r && r.ok) return r.value;
        const e = r && r.error;
        throw new Error(e ? e.code + ": " + e.message : "rpc failed");
      };

      // Register Settings Section
      ctx.slots.inject("settings.section", () =>
        ctx.slots.register({
          name: "settings.section",
          id: "dsh-updater",
          order: 12,
          label: () => t("nav"),
          locale: NS,
          inject: () => ({ callRpc }),
        }, UpdatesSection));

      // Register Sidebar Footer Action
      ctx.slots.inject("sidebar.footer.action", () =>
        ctx.slots.register({
          name: "sidebar.footer.action",
          id: "dsh-updater-sidebar",
          order: 0,
          inject: () => ({ callRpc }),
        }, UpdateSidebarAction));

      // Register Header Action Badge in conversation header
      ctx.slots.inject("conversation.session.header.actions", () =>
        ctx.slots.register({
          name: "conversation.session.header.actions",
          id: "dsh-updater-badge",
          order: 8,
          inject: () => ({ callRpc }),
        }, UpdateBadgeAction));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
