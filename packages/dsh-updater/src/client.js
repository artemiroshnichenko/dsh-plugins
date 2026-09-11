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
    const { useState, useEffect, useRef, useMemo, useCallback } = React;

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
      reconnectHint: "Ожидание перезапуска сервера и автоматическое переподключение...",
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
      progressTitle: "Установка обновлений",
      stepPending: "В очереди",
      stepRunning: "Выполняется...",
      stepDone: "Готово",
      stepFailed: "Ошибка",
      stepSkipped: "Пропущено",
      viewLogs: "Терминальный лог",
      hideLogs: "Скрыть лог",
      copyLogs: "Скопировать лог",
      copied: "Скопировано!",
      stepsOverview: "Этапы установки",
      serverRestarting: "Сервер перезапускается...",
      waitingServer: "Ожидание готовности HTTP-шлюза (порт 3080)",
      attempt: "Попытка",
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
      reconnectHint: "Waiting for server restart and reconnecting automatically...",
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
      progressTitle: "Installing Updates",
      stepPending: "Pending",
      stepRunning: "Running...",
      stepDone: "Done",
      stepFailed: "Failed",
      stepSkipped: "Skipped",
      viewLogs: "Terminal logs",
      hideLogs: "Hide logs",
      copyLogs: "Copy logs",
      copied: "Copied!",
      stepsOverview: "Installation pipeline",
      serverRestarting: "Server is restarting...",
      waitingServer: "Waiting for HTTP gateway on port 3080",
      attempt: "Attempt",
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
      progressTitle: "安装更新中",
      stepPending: "等待中",
      stepRunning: "执行中...",
      stepDone: "已完成",
      stepFailed: "失败",
      stepSkipped: "跳过",
      viewLogs: "执行日志",
      hideLogs: "隐藏日志",
      copyLogs: "复制日志",
      copied: "已复制！",
      stepsOverview: "执行步骤",
      serverRestarting: "服务重启中...",
      waitingServer: "等待服务就绪 (3080 端口)",
      attempt: "尝试",
    };

    // ── Clean SVG Icons (Matching DSH primitives style, zero emojis) ────────────
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

    const IconCheck = ({ size = 14, className }) =>
      h("svg", {
        width: size,
        height: size,
        className,
        viewBox: "0 0 16 16",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: { flexShrink: 0 },
      },
        h("path", { d: "M3.5 8.5l3 3 6-7" })
      );

    const IconCross = ({ size = 14, className }) =>
      h("svg", {
        width: size,
        height: size,
        className,
        viewBox: "0 0 16 16",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: { flexShrink: 0 },
      },
        h("path", { d: "M4 4l8 8M12 4l-8 8" })
      );

    const IconTerminal = ({ size = 15, className }) =>
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
        h("path", { d: "M2.5 4.5l4 3.5-4 3.5" }),
        h("path", { d: "M8.5 12h5" })
      );

    const IconCopy = ({ size = 14, className }) =>
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
        h("rect", { x: "5", y: "5", width: "9", height: "9", rx: "1.5" }),
        h("path", { d: "M3.5 11H2.5A1.5 1.5 0 0 1 1 9.5v-7A1.5 1.5 0 0 1 2.5 1h7A1.5 1.5 0 0 1 11 2.5v1" })
      );

    const IconChevronDown = ({ size = 14, className }) =>
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
        h("path", { d: "M4 6l4 4 4-4" })
      );

    const IconChevronUp = ({ size = 14, className }) =>
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
        h("path", { d: "M4 10l4-4 4 4" })
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
      
      // Progress & Pipeline Styling
      ".up-progress-card{display:flex;flex-direction:column;gap:16px;padding:20px;border-radius:14px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);box-shadow:0 4px 16px rgba(0,0,0,0.04);margin-top:4px}",
      ".up-progress-header{display:flex;align-items:center;justify-content:space-between;gap:12px}",
      ".up-progress-title-wrap{display:flex;align-items:center;gap:10px}",
      ".up-progress-title{font-size:14.5px;font-weight:600;color:var(--dsw-alias-label-primary)}",
      ".up-progress-subtitle{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:2px}",
      ".up-progress-meta{display:flex;align-items:center;gap:10px}",
      ".up-progress-timer{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--dsw-alias-label-secondary);padding:2px 8px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2)}",
      ".up-progress-pct{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;font-weight:600;color:var(--dsw-alias-brand-primary)}",
      ".up-progress-bar-wrap{display:flex;flex-direction:column;gap:6px}",
      ".up-progress-track{width:100%;height:8px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;overflow:hidden;position:relative}",
      ".up-progress-fill{height:100%;background:var(--dsw-alias-brand-primary);border-radius:999px;transition:width 0.35s cubic-bezier(0.4, 0, 0.2, 1);position:relative}",
      ".up-progress-fill::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent);animation:up-shimmer 1.6s infinite}",
      "@keyframes up-shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}",
      
      // Pipeline Stages Checklist
      ".up-pipeline{display:flex;flex-direction:column;gap:8px;margin-top:6px}",
      ".up-pipe-item{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);font-size:13px;transition:all 0.15s ease}",
      ".up-pipe-item--running{border-color:var(--dsw-alias-brand-primary);background:rgba(59,130,246,0.06)}",
      ".up-pipe-item--failed{border-color:var(--dsw-alias-state-error-primary);background:rgba(239,68,68,0.06)}",
      ".up-pipe-left{display:flex;align-items:center;gap:10px}",
      ".up-pipe-icon{width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:50%;flex-shrink:0}",
      ".up-pipe-icon--pending{background:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary)}",
      ".up-pipe-icon--running{background:rgba(59,130,246,0.15);color:var(--dsw-alias-brand-primary)}",
      ".up-pipe-icon--success{background:rgba(34,197,94,0.15);color:var(--dsw-alias-state-success-primary)}",
      ".up-pipe-icon--failed{background:rgba(239,68,68,0.15);color:var(--dsw-alias-state-error-primary)}",
      ".up-pipe-title{font-weight:500;color:var(--dsw-alias-label-primary)}",
      ".up-pipe-right{display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--dsw-alias-label-tertiary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}",
      
      // Terminal Logs Block
      ".up-log-toggle{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);cursor:pointer;font-size:12.5px;color:var(--dsw-alias-label-secondary);user-select:none;transition:all 0.12s ease;margin-top:6px}",
      ".up-log-toggle:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
      ".up-log-terminal{display:flex;flex-direction:column;background:#0d1117;color:#c9d1d9;border-radius:8px;border:1px solid rgba(255,255,255,0.12);font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11.5px;line-height:18px;overflow:hidden;margin-top:8px}",
      ".up-log-terminal-head{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.08);font-size:11px;color:#8b949e}",
      ".up-log-terminal-body{padding:12px;overflow-y:auto;max-height:260px;white-space:pre-wrap;word-break:break-all;color:#e6edf3}",

      // Overlay
      ".up-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999;color:#fff}",
      ".up-overlay-box{display:flex;flex-direction:column;align-items:center;gap:16px;padding:32px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:16px;max-width:420px;text-align:center;box-shadow:0 16px 36px rgba(0,0,0,0.35);color:var(--dsw-alias-label-primary)}",
      ".up-spinner{width:28px;height:28px;border:3px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);border-radius:50%;animation:up-spin 0.8s linear infinite}",
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
    function startReconnectPolling(onSuccess, onAttempt) {
      let attempts = 0;
      let interval = setInterval(() => {
        attempts++;
        if (onAttempt) onAttempt(attempts);
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
      const [reconnectAttempt, setReconnectAttempt] = useState(0);

      // Progress & cosmetics states
      const [progress, setProgress] = useState(null);
      const [elapsedSec, setElapsedSec] = useState(0);
      const [showLogs, setShowLogs] = useState(false);
      const [copied, setCopied] = useState(false);
      const [activeTarget, setActiveTarget] = useState("all");

      // Active locale strings
      const currentLang = (typeof navigator !== "undefined" && navigator.language && navigator.language.startsWith("ru")) ? "ru" : "en";
      const t = currentLang === "ru" ? ru : en;

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

      // Polling backend progress during execution
      useEffect(() => {
        if (!executing) {
          return;
        }
        let alive = true;
        const progressTimer = setInterval(() => {
          callRpc("progress", {})
            .then((p) => {
              if (alive && p && p.active) {
                setProgress(p);
              }
            })
            .catch(() => {});
        }, 600);

        const elapsedTimer = setInterval(() => {
          setElapsedSec((prev) => prev + 1);
        }, 1000);

        return () => {
          alive = false;
          clearInterval(progressTimer);
          clearInterval(elapsedTimer);
        };
      }, [executing]);

      const runUpdate = (target, restart = true) => {
        setExecuting(true);
        setActiveTarget(target);
        setError(null);
        setUpdateResult(null);
        setElapsedSec(0);
        setProgress({
          active: true,
          target,
          phase: "Initializing",
          percent: 10,
          currentStepIndex: 1,
          totalSteps: target === "all" ? 4 : 2,
          currentStepName: target === "plugins" ? "Pulling latest git changes" : "Downloading latest npm packages",
          steps: [],
        });

        callRpc("update", { target, restart })
          .then((res) => {
            setUpdateResult(res);
            setExecuting(false);
            if (restart && res.ok) {
              setRestarting(true);
              startReconnectPolling(() => {
                window.location.reload();
              }, (att) => setReconnectAttempt(att));
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
            }, (att) => setReconnectAttempt(att));
          })
          .catch((err) => {
            alert("Restart failed: " + err);
            setRestarting(false);
          });
      };

      const copyAllLogs = () => {
        const rawSteps = (updateResult && updateResult.steps) || (progress && progress.steps) || [];
        const logLines = rawSteps.map(s => `[${s.status.toUpperCase()}] ${s.step}\n${s.output || ""}\n${s.error || ""}`.trim()).join("\n\n");
        if (navigator.clipboard) {
          navigator.clipboard.writeText(logLines);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      };

      const dshInfo = status && status.dsh;
      const pluginsInfo = status && status.plugins;
      const hasAnyUpdates = status && status.hasAnyUpdates;

      // Pipeline stages breakdown
      const pipelineSteps = useMemo(() => {
        const target = (progress && progress.target) || activeTarget;
        if (target === "plugins") {
          return [
            { id: "git", title: t.stepPullPlugins },
            { id: "build", title: t.stepBuildPlugins },
          ];
        }
        if (target === "dsh") {
          return [
            { id: "npm", title: t.stepDshInstall },
            { id: "symlinks", title: t.stepSyncSymlinks },
          ];
        }
        return [
          { id: "npm", title: t.stepDshInstall },
          { id: "symlinks", title: t.stepSyncSymlinks },
          { id: "git", title: t.stepPullPlugins },
          { id: "build", title: t.stepBuildPlugins },
        ];
      }, [activeTarget, progress, t]);

      const currentProgressPercent = (progress && progress.percent) || (executing ? Math.min(95, 10 + elapsedSec * 6) : (updateResult ? 100 : 0));

      return h("section", { className: "up-root" },
        // Restarting Overlay
        restarting && h("div", { className: "up-overlay" },
          h("div", { className: "up-overlay-box" },
            h("div", { className: "up-spinner" }),
            h("div", { style: { fontSize: "16px", fontWeight: 600 } }, t.serverRestarting),
            h("div", { style: { fontSize: "13px", color: "var(--dsw-alias-label-secondary)" } },
              `${t.waitingServer}${reconnectAttempt > 0 ? ` (${t.attempt} ${reconnectAttempt})` : ""}`),
            h("div", { style: { fontSize: "12px", color: "var(--dsw-alias-label-tertiary)" } }, t.reconnectHint))),

        // Header
        h("div", { className: "up-head" },
          h("div", null,
            h("div", { className: "up-title" }, t.nav),
            h("div", { className: "up-sub" }, "DeepSeek Harness & Plugins Update Center")),
          h("div", { className: "up-actions" },
            h("button", {
              className: "up-btn",
              onClick: () => checkUpdates(true),
              disabled: checking || executing || restarting,
            },
              h(IconRefresh, { size: 14 }),
              checking ? t.checking : t.checkUpdates),
            hasAnyUpdates && h("button", {
              className: "up-btn up-btn--primary",
              onClick: () => runUpdate("all", true),
              disabled: checking || executing || restarting,
            },
              h(IconDownload, { size: 14 }),
              executing ? t.updating : t.updateAll),
            h("button", {
              className: "up-btn",
              onClick: doRestart,
              disabled: checking || executing || restarting,
              title: "Restart DSH server process",
            },
              h(IconRestart, { size: 14 }),
              t.restart))),

        // Error banner
        error && h("div", {
          style: {
            padding: "12px 16px",
            borderRadius: "10px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "var(--dsw-alias-state-error-primary)",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          },
        },
          h(IconCross, { size: 16 }),
          h("span", null, error)),

        // ── LIVE PROGRESS & STEP TRACKER CARD ──
        (executing || (progress && progress.active) || updateResult) && h("div", { className: "up-progress-card" },
          h("div", { className: "up-progress-header" },
            h("div", { className: "up-progress-title-wrap" },
              executing ? h("div", { className: "up-spinner", style: { width: "18px", height: "18px", borderWidth: "2.5px" } })
                        : (updateResult && updateResult.ok ? h("div", { className: "up-pipe-icon up-pipe-icon--success" }, h(IconCheck, { size: 13 }))
                                                           : h("div", { className: "up-pipe-icon up-pipe-icon--failed" }, h(IconCross, { size: 13 }))),
              h("div", null,
                h("div", { className: "up-progress-title" },
                  executing ? (t.progressTitle + ": " + ((progress && progress.phase) || t.stepRunning))
                            : (updateResult && updateResult.ok ? t.logsTitleSuccess : t.logsTitleError)),
                h("div", { className: "up-progress-subtitle" },
                  (progress && progress.currentStepName) || (executing ? "Processing workspace update..." : "Finished")))),
            h("div", { className: "up-progress-meta" },
              executing && h("span", { className: "up-progress-timer" }, `${elapsedSec}s`),
              h("span", { className: "up-progress-pct" }, `${Math.round(currentProgressPercent)}%`))),

          // Smooth Progress Bar
          h("div", { className: "up-progress-bar-wrap" },
            h("div", { className: "up-progress-track" },
              h("div", {
                className: "up-progress-fill",
                style: {
                  width: `${Math.min(100, Math.max(4, currentProgressPercent))}%`,
                  background: updateResult && !updateResult.ok ? "var(--dsw-alias-state-error-primary)" : "var(--dsw-alias-brand-primary)"
                }
              }))),

          // Pipeline Checklist
          h("div", { className: "up-pipeline" },
            pipelineSteps.map((stepDef, idx) => {
              const recordedSteps = (updateResult && updateResult.steps) || (progress && progress.steps) || [];
              const recorded = recordedSteps[idx];
              const isDone = recorded && recorded.status === "success";
              const isFailed = recorded && recorded.status === "failed";
              const isRunning = executing && !isDone && !isFailed && (progress ? progress.currentStepIndex === idx + 1 : idx === 0);

              let itemClass = "up-pipe-item";
              let iconClass = "up-pipe-icon up-pipe-icon--pending";
              let iconNode = h("span", { style: { width: "6px", height: "6px", borderRadius: "50%", background: "currentColor" } });
              let statusLabel = t.stepPending;

              if (isDone) {
                itemClass += " up-pipe-item--success";
                iconClass = "up-pipe-icon up-pipe-icon--success";
                iconNode = h(IconCheck, { size: 12 });
                statusLabel = recorded.durationMs ? `${(recorded.durationMs / 1000).toFixed(1)}s` : t.stepDone;
              } else if (isFailed) {
                itemClass += " up-pipe-item--failed";
                iconClass = "up-pipe-icon up-pipe-icon--failed";
                iconNode = h(IconCross, { size: 12 });
                statusLabel = t.stepFailed;
              } else if (isRunning) {
                itemClass += " up-pipe-item--running";
                iconClass = "up-pipe-icon up-pipe-icon--running";
                iconNode = h("div", { className: "up-spinner", style: { width: "12px", height: "12px", borderWidth: "1.8px" } });
                statusLabel = t.stepRunning;
              }

              return h("div", { key: stepDef.id, className: itemClass },
                h("div", { className: "up-pipe-left" },
                  h("div", { className: iconClass }, iconNode),
                  h("span", { className: "up-pipe-title" }, stepDef.title)),
                h("div", { className: "up-pipe-right" }, statusLabel));
            })),

          // Terminal Logs Toggle & View
          ((updateResult && updateResult.steps && updateResult.steps.some(s => s.output || s.error)) || (progress && progress.steps && progress.steps.length > 0)) && h("div", null,
            h("div", {
              className: "up-log-toggle",
              onClick: () => setShowLogs(!showLogs)
            },
              h("div", { style: { display: "flex", alignItems: "center", gap: "8px" } },
                h(IconTerminal, { size: 14 }),
                h("span", { style: { fontWeight: 500 } }, showLogs ? t.hideLogs : t.viewLogs)),
              h(showLogs ? IconChevronUp : IconChevronDown, { size: 14 })),

            showLogs && h("div", { className: "up-log-terminal" },
              h("div", { className: "up-log-terminal-head" },
                h("span", null, "STDOUT / STDERR"),
                h("button", {
                  type: "button",
                  className: "up-btn",
                  style: { height: "24px", fontSize: "11px", padding: "0 8px", background: "rgba(255,255,255,0.08)", border: "none", color: "#c9d1d9" },
                  onClick: copyAllLogs
                },
                  copied ? h(IconCheck, { size: 12 }) : h(IconCopy, { size: 12 }),
                  copied ? t.copied : t.copyLogs)),
              h("div", { className: "up-log-terminal-body" },
                ((updateResult && updateResult.steps) || (progress && progress.steps) || []).map((s, i) =>
                  h("div", { key: i, style: { marginBottom: "10px" } },
                    h("div", { style: { color: s.status === "failed" ? "var(--dsw-alias-state-error-primary)" : "var(--dsw-alias-brand-primary)", fontWeight: 600 } },
                      `> [${s.status.toUpperCase()}] ${s.step}`),
                    s.output && h("div", { style: { opacity: 0.85, marginTop: "2px" } }, s.output),
                    s.error && h("div", { style: { color: "var(--dsw-alias-state-error-primary)", marginTop: "2px" } }, s.error))))))),

        // Status Cards Grid
        h("div", { className: "up-grid" },
          // Card 1: DSH Core
          h("div", { className: "up-card" },
            h("div", { className: "up-card-header" },
              h("div", { className: "up-card-title" },
                h(IconCore, { size: 18 }),
                t.dshCore),
              dshInfo && (dshInfo.updateAvailable
                ? h("span", { className: "up-badge up-badge--warn" },
                    h("span", { className: "up-badge-dot up-badge-dot--pulse" }),
                    t.updateAvailable)
                : h("span", { className: "up-badge up-badge--ok" },
                    h(IconCheck, { size: 12 }),
                    t.upToDate))),
            h("div", { className: "up-card-body" },
              h("div", { className: "up-row" },
                h("span", { className: "up-label" }, t.currentVersion),
                h("span", { className: "up-val" }, dshInfo ? dshInfo.current : "...")),
              h("div", { className: "up-row" },
                h("span", { className: "up-label" }, t.latestVersion),
                h("span", { className: "up-val", style: { color: dshInfo && dshInfo.updateAvailable ? "var(--dsw-alias-brand-primary)" : "inherit", fontWeight: dshInfo && dshInfo.updateAvailable ? 600 : 400 } },
                  dshInfo ? dshInfo.latest : "...")),
              dshInfo && dshInfo.publishedAt && h("div", { className: "up-row" },
                h("span", { className: "up-label" }, t.published),
                h("span", { className: "up-val" }, new Date(dshInfo.publishedAt).toLocaleDateString())),
              h("div", { style: { marginTop: "8px", display: "flex", gap: "8px" } },
                h("button", {
                  className: "up-btn up-btn--primary",
                  style: { flex: 1 },
                  onClick: () => runUpdate("dsh", true),
                  disabled: executing || restarting || (dshInfo && !dshInfo.updateAvailable),
                },
                  h(IconDownload, { size: 14 }),
                  t.updateDsh)))),

          // Card 2: Plugins
          h("div", { className: "up-card" },
            h("div", { className: "up-card-header" },
              h("div", { className: "up-card-title" },
                h(IconPackage, { size: 18 }),
                t.plugins),
              pluginsInfo && (pluginsInfo.hasUpdates
                ? h("span", { className: "up-badge up-badge--warn" },
                    h("span", { className: "up-badge-dot up-badge-dot--pulse" }),
                    t.updateAvailable)
                : h("span", { className: "up-badge up-badge--ok" },
                    h(IconCheck, { size: 12 }),
                    t.upToDate))),
            h("div", { className: "up-card-body" },
              h("div", { className: "up-row" },
                h("span", { className: "up-label" }, t.branch),
                h("span", { className: "up-val" }, pluginsInfo ? pluginsInfo.repoBranch : "main")),
              h("div", { className: "up-row" },
                h("span", { className: "up-label" }, t.installedPlugins),
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
                  t.updatePlugins))))));
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

      const hasUpdate = status && status.hasAnyUpdates;
      if (!hasUpdate) {
        return null;
      }

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
          title: "Update Available",
          onClick: openSettingsModal,
        },
          h(IconDownload, { size: 18 }),
          h("span", { className: "up-badge-dot up-badge-dot--pulse" }));
      }

      return h("button", {
        type: "button",
        className: "up-sidebar-btn",
        onClick: openSettingsModal,
      },
        h(IconDownload, { size: 16, style: { color: "var(--dsw-alias-brand-primary)" } }),
        h("span", { style: { fontWeight: 500 } }, "Update Available"),
        h("span", { className: "up-pill" }, status.dsh && status.dsh.updateAvailable ? `v${status.dsh.latest}` : "New"));
    }

    // ── Client Plugin Entrypoint ───────────────────────────────────────────────
    function apply(ctx) {
      installStyles(ctx);

      const tRu = ctx.get("@deepseek-ai/dsh-client-locale");
      if (tRu && typeof tRu.define === "function") {
        try {
          tRu.define("ru", { [NS]: ru });
          tRu.define("en", { [NS]: en });
          tRu.define("zh", { [NS]: zh });
        } catch {}
      }

      // Safe wrapper for callRpc ensuring plain object args matching Typert Gateway
      const callRpc = (method, args = {}) => {
        if (!ctx.connection || !ctx.connection.rpc || typeof ctx.connection.rpc.call !== "function") {
          return Promise.reject(new Error("RPC connection not ready"));
        }
        let safeArgs = {};
        if (args && typeof args === "object" && !Array.isArray(args)) {
          safeArgs = args;
        } else if (typeof args === "boolean") {
          safeArgs = { force: args };
        }
        // Шлюз отвечает конвертом {ok, value} либо {ok:false, error}. Компоненты
        // читают поля ответа напрямую, поэтому конверт распаковывается здесь —
        // иначе status.dsh оказывается undefined и версии остаются многоточиями.
        return ctx.connection.rpc.call("/api", `dshUpdater/${method}`, { args: safeArgs })
          .then((r) => {
            if (r && r.ok) return r.value;
            const e = r && r.error;
            throw new Error(e ? `${e.code}: ${e.message}` : "rpc failed");
          });
      };

      // Каждая поверхность занимает штатное гнездо. Имя гнезда идёт полем `name`
      // в описании, а сам компонент — вторым доводом; строка первым доводом даёт
      // «slot "undefined" is not declared». Регистрация ждёт объявления гнезда
      // через slots.inject, иначе она может опередить владельца.

      // Страница «Обновления» в настройках.
      ctx.slots.inject("settings.section", () =>
        ctx.slots.register({
          name: "settings.section",
          id: "dsh-updater",
          order: 950,
          label: () => "Updates",
          inject: () => ({ callRpc }),
        }, UpdatesSection)
      );

      // Отметка в подвале боковой панели, когда есть что обновить.
      ctx.slots.inject("sidebar.footer.action", () =>
        ctx.slots.register({
          name: "sidebar.footer.action",
          id: "dsh-updater-sidebar-badge",
          order: 85,
          inject: () => ({ callRpc }),
        }, UpdateSidebarAction)
      );

      // Плашка в заголовке открытой сессии.
      ctx.slots.inject("conversation.session.header.actions", () =>
        ctx.slots.register({
          name: "conversation.session.header.actions",
          id: "dsh-updater-header-badge",
          order: 10,
          inject: () => ({ callRpc }),
        }, UpdateBadgeAction)
      );
    }

    // Загрузчик берёт значение, которое ВЕРНУЛА фабрика, и ищет в нём `apply`.
    // Без этих двух строк модуль остаётся undefined — ровно то, на что ругается
    // «invalid plugin, expect function or object with an "apply" method».
    // Cordis пускает к службе только по объявленному inject: без списка обращение
    // к ctx.slots падает с «cannot get property "slots" without inject».
    // ctx.get(...) и ctx.effect в списке не нуждаются.
    // Загрузчик разворачивает `default` в голую функцию, и объявленный рядом
    // список инъекций при этом теряется — отсюда «cannot get property "slots"
    // without inject». Поэтому default не экспортируем вовсе, как и в остальных
    // плагинах: наружу идут только apply и inject. Список продублирован на самой
    // функции на случай, если развернут всё-таки её.
    const inject = ["slots", "connection"];
    apply.inject = inject;
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
