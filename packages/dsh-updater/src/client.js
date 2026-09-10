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

    const zh = {
      nav: "系统更新",
      badge: "有新版本可用",
      updateAll: "一键更新并重启",
      updating: "正在更新...",
      restarting: "正在重启 DeepSeek Harness...",
    };

    const en = {
      nav: "Updates",
      badge: "Update Available",
      updateAll: "Update All & Restart",
      updating: "Updating...",
      restarting: "Restarting DeepSeek Harness...",
    };

    const CSS = [
      ".up-root{display:flex;flex-direction:column;gap:20px;color:var(--dsw-alias-label-primary)}",
      ".up-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-bottom:14px;border-bottom:1px solid var(--dsw-alias-border-l1)}",
      ".up-title{font-size:18px;font-weight:600;line-height:26px}",
      ".up-sub{font-size:12.5px;color:var(--dsw-alias-label-tertiary);line-height:18px;margin-top:2px}",
      ".up-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}",
      ".up-btn{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:12.5px;font-weight:500;line-height:20px;padding:6px 14px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-button-floating-fill);color:var(--dsw-alias-label-primary);cursor:pointer;transition:all 0.15s ease}",
      ".up-btn:hover:not(:disabled){background:var(--dsw-alias-button-floating-hover);border-color:var(--dsw-alias-border-l1)}",
      ".up-btn:disabled{opacity:0.6;cursor:not-allowed}",
      ".up-btn--primary{background:var(--dsw-alias-brand-primary);color:#fff;border-color:transparent}",
      ".up-btn--primary:hover:not(:disabled){filter:brightness(1.08)}",
      ".up-btn--warn{background:var(--dsw-alias-state-warn-primary);color:#fff;border-color:transparent}",
      ".up-grid{display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:16px}",
      ".up-card{display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:12px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}",
      ".up-card-header{display:flex;align-items:center;justify-content:space-between;gap:8px}",
      ".up-card-title{font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px}",
      ".up-card-body{display:flex;flex-direction:column;gap:8px;font-size:13px;line-height:20px}",
      ".up-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 0}",
      ".up-label{color:var(--dsw-alias-label-secondary);font-size:12.5px}",
      ".up-val{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;font-weight:500}",
      ".up-badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;line-height:16px;padding:2px 8px;border-radius:999px;white-space:nowrap}",
      ".up-badge--ok{background:rgba(34,197,94,0.15);color:var(--dsw-alias-state-success-primary);border:1px solid rgba(34,197,94,0.3)}",
      ".up-badge--warn{background:rgba(245,158,11,0.15);color:var(--dsw-alias-state-warn-primary);border:1px solid rgba(245,158,11,0.3)}",
      ".up-badge--info{background:rgba(59,130,246,0.15);color:var(--dsw-alias-brand-primary);border:1px solid rgba(59,130,246,0.3)}",
      ".up-badge-dot{width:6px;height:6px;border-radius:50%;background:currentColor}",
      ".up-badge-dot--pulse{animation:up-pulse 1.8s infinite}",
      "@keyframes up-pulse{0%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(1.2)}100%{opacity:1;transform:scale(1)}}",
      ".up-list{display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto;margin-top:4px;padding-right:4px}",
      ".up-item{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-radius:8px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);font-size:12px}",
      ".up-steps{display:flex;flex-direction:column;gap:8px;margin-top:10px;padding:12px;border-radius:10px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}",
      ".up-step-item{display:flex;align-items:flex-start;gap:8px;line-height:18px}",
      ".up-step-status{font-weight:600;min-width:60px}",
      ".up-step-status--success{color:var(--dsw-alias-state-success-primary)}",
      ".up-step-status--failed{color:var(--dsw-alias-state-error-primary)}",
      ".up-step-status--running{color:var(--dsw-alias-brand-primary)}",
      ".up-step-status--skipped{color:var(--dsw-alias-label-tertiary)}",
      ".up-step-out{font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:pre-wrap;word-break:break-all;margin-top:2px}",
      ".up-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999;color:#fff}",
      ".up-overlay-box{display:flex;flex-direction:column;align-items:center;gap:16px;padding:32px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:16px;max-width:440px;text-align:center;box-shadow:0 20px 40px rgba(0,0,0,0.5)}",
      ".up-spinner{width:36px;height:36px;border:3px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);border-radius:50%;animation:up-spin 0.8s linear infinite}",
      "@keyframes up-spin{to{transform:rotate(360deg)}}",
      ".up-header-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:500;background:rgba(245,158,11,0.16);color:var(--dsw-alias-state-warn-primary);border:1px solid rgba(245,158,11,0.35);cursor:pointer;user-select:none;transition:all 0.15s ease}",
      ".up-header-chip:hover{background:rgba(245,158,11,0.25);border-color:rgba(245,158,11,0.5);transform:translateY(-1px)}",
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
        callRpc("check", force)
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
            h("div", { style: { fontSize: "16px", fontWeight: 600 } }, "Restarting DeepSeek Harness..."),
            h("div", { style: { fontSize: "12.5px", opacity: 0.8 } }, "Reconnecting automatically once the server is back online."))),

        // Header
        h("div", { className: "up-head" },
          h("div", null,
            h("div", { className: "up-title" }, "Updates & Releases"),
            h("div", { className: "up-sub" }, "Keep DeepSeek Harness and community plugins updated to the latest versions.")),
          h("div", { className: "up-actions" },
            h("button", {
              className: "up-btn",
              onClick: () => checkUpdates(true),
              disabled: checking || executing || restarting,
            }, checking ? "Checking..." : "🔄 Check for Updates"),
            hasAnyUpdates && h("button", {
              className: "up-btn up-btn--primary",
              onClick: () => runUpdate("all", true),
              disabled: checking || executing || restarting,
            }, "⚡ Update All & Restart"),
            h("button", {
              className: "up-btn",
              onClick: doRestart,
              disabled: checking || executing || restarting,
              title: "Restart DSH server process",
            }, "🔁 Restart DSH"))),

        // Error banner
        error && h("div", {
          style: {
            padding: "10px 14px",
            borderRadius: "8px",
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "var(--dsw-alias-state-error-primary)",
            fontSize: "13px",
          },
        }, "Error: " + error),

        // Main Cards Grid
        h("div", { className: "up-grid" },
          // Card 1: DSH Core
          h("div", { className: "up-card" },
            h("div", { className: "up-card-header" },
              h("div", { className: "up-card-title" }, "🤖 DeepSeek Harness"),
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
                }, "Update DSH & Restart")))),

          // Card 2: Plugins Monorepo
          h("div", { className: "up-card" },
            h("div", { className: "up-card-header" },
              h("div", { className: "up-card-title" }, "🧩 Community Plugins"),
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
                  h("span", { style: { color: "var(--dsw-alias-label-tertiary)" } }, "v" + item.currentVersion)))),
              h("div", { style: { marginTop: "8px", display: "flex", gap: "8px" } },
                h("button", {
                  className: "up-btn",
                  style: { flex: 1 },
                  onClick: () => runUpdate("plugins", true),
                  disabled: executing || restarting,
                }, "Build & Refresh Plugins"))))),

        // Execution Results & Logs
        updateResult && h("div", { className: "up-steps" },
          h("div", { style: { fontWeight: 600, marginBottom: "4px" } },
            updateResult.ok ? "✅ Update Steps Succeeded:" : "❌ Update Completed with Errors:"),
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
        callRpc("check", false)
          .then((res) => {
            if (alive) setStatus(res);
          })
          .catch(() => {});

        // Check periodically every 15 minutes
        const interval = setInterval(() => {
          callRpc("check", false)
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
      const label = latestVer ? `⚡ Update available (v${latestVer})` : "⚡ Updates available";

      return h("div", {
        className: "up-header-chip",
        title: "Click to open Updates in Settings and upgrade DeepSeek Harness",
        onClick: () => {
          // Open Settings modal by triggering the settings trigger if available
          const settingsBtn = document.querySelector('[data-slot="sidebar.settings"], button[aria-label*="Settings"], button[aria-label*="设置"]');
          if (settingsBtn) {
            settingsBtn.click();
          } else {
            alert("Update available! Please open Settings → Updates to upgrade.");
          }
        },
      },
        h("span", { className: "up-badge-dot up-badge-dot--pulse" }),
        label);
    }

    // ── Plugin Apply ───────────────────────────────────────────────────────────
    const inject = ["slots", "locale", "connection"];

    function apply(ctx) {
      installStyles(ctx);

      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-updater: locale");
      const t = ctx.locale.bind(NS);

      const callRpc = async (method, args) => {
        const r = await ctx.connection.rpc.call("/api", "dshUpdater/" + method, { args: args || {} });
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
