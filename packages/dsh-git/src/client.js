/**
 * dsh-git web client plugin
 *
 * Implements Claude Code-style Git status, branch switching, Worktree isolation,
 * and GitHub Pull Request status integration for DeepSeek Harness (DSH).
 *
 * Placements:
 * 1. heroWorkspaceRow (alongside Folder chip) on Hero screen
 * 2. conversation.input.dock (directly above prompt input) in active session (Claude Code layout)
 */
window.__ModuleLoader__ = window.__ModuleLoader__ || {
  load: function (m) {
    (this.modules = this.modules || {})[m.id] = m;
  },
};

window.__ModuleLoader__.load({
  id: "dsh-git",
  factory: (require) => {
    "use strict";
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const ReactDOM = require("react-dom");
    const h = React.createElement;
    const { useState, useEffect, useCallback, useRef, useMemo } = React;

    const NS = "dsh.git";
    const zh = {
      branch: "分支",
      worktree: "工作区树",
      worktreeActiveTitle: "当前会话运行在隔离的 Git Worktree 中",
      worktreeInactiveTitle: "点击为当前仓库创建隔离的 Worktree",
      branchesTitle: "{repo} 分支列表",
      newWorktree: "+ 新建 Worktree",
      promptNewWorktree: "新建 Worktree 分支名称：",
      switching: "正在切换…",
      ciFailing: "CI 失败",
      ciPassed: "CI 通过",
      ciRunning: "CI 运行中",
      pullRequests: "合并请求",
      showAll: "全部",
      showLess: "收起",
      dismiss: "关闭",
      errorPrefix: "错误：",
    };
    const en = {
      branch: "branch",
      worktree: "worktree",
      worktreeActiveTitle: "Current session runs in an isolated Git Worktree",
      worktreeInactiveTitle: "Click to create an isolated worktree for this repository",
      branchesTitle: "{repo} branches",
      newWorktree: "+ New Worktree",
      promptNewWorktree: "New worktree branch name:",
      switching: "switching...",
      ciFailing: "CI failing",
      ciPassed: "CI passed",
      ciRunning: "CI running",
      pullRequests: "Pull Requests",
      showAll: "All",
      showLess: "Less",
      dismiss: "Dismiss",
      errorPrefix: "Error: ",
    };

    const CSS = `
      /* Claude Code Dock Bar above Prompt Input */
      .dgit-dock-seat {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        padding: 0 var(--dsh-composer-side-clearance, 32px);
        box-sizing: border-box;
      }
      .dgit-claude-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 38px;
        padding: 0 12px;
        margin-bottom: 0px;
        background: var(--dsw-specific-input-major, #ffffff);
        border: 1px solid var(--dsw-alias-border-l2-darkmode-thin, rgba(0, 0, 0, 0.08));
        border-radius: 12px;
        box-shadow: var(--dsw-shadow-lv2, 0 2px 8px rgba(0, 0, 0, 0.08));
        font-family: inherit;
        font-size: 12px;
        color: var(--dsw-alias-label-primary, #1f1e1b);
        box-sizing: border-box;
        width: 100%;
        max-width: var(--dsh-composer-card-max-width, 776px);
        user-select: none;
        position: relative;
      }
      .dgit-bar-left {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex: 1;
      }
      .dgit-bar-right {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }

      /* Status Icons (Fail, Pass, Wait) */
      .dgit-ci-circle-fail {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #ef4444;
        color: #ffffff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        flex-shrink: 0;
      }
      .dgit-ci-circle-pass {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #22c55e;
        color: #ffffff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        flex-shrink: 0;
      }
      .dgit-ci-circle-wait {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #eab308;
        color: #ffffff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        flex-shrink: 0;
      }

      .dgit-bar-pr-num {
        font-weight: 600;
        color: var(--dsw-alias-label-primary);
        text-decoration: none;
        cursor: pointer;
      }
      .dgit-bar-pr-num:hover {
        text-decoration: underline;
        color: var(--dsw-alias-accent, #38bdf8);
      }
      .dgit-bar-repo {
        color: var(--dsw-alias-label-secondary);
        font-weight: 400;
        white-space: nowrap;
      }
      .dgit-bar-branch-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: transparent;
        border: none;
        color: var(--dsw-alias-label-primary);
        font: inherit;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        padding: 3px 6px;
        border-radius: 4px;
        transition: background 0.15s ease;
        max-width: 220px;
      }
      .dgit-bar-branch-btn:hover {
        background: var(--dsw-alias-fill-quaternary, rgba(125, 125, 125, 0.08));
      }
      .dgit-bar-branch-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* Worktree toggle inside dock */
      .dgit-bar-wt-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: transparent;
        border: none;
        color: var(--dsw-alias-label-secondary);
        font: inherit;
        font-size: 11px;
        cursor: pointer;
        padding: 3px 6px;
        border-radius: 4px;
        transition: background 0.15s ease, color 0.15s ease;
      }
      .dgit-bar-wt-btn:hover {
        background: var(--dsw-alias-fill-quaternary, rgba(125, 125, 125, 0.08));
        color: var(--dsw-alias-label-primary);
      }
      .dgit-bar-wt-btn[data-active="true"] {
        color: var(--dsw-alias-accent, #38bdf8);
      }

      /* Right-hand items in Claude dock */
      .dgit-bar-diff-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--dsw-alias-fill-quaternary, rgba(125, 125, 125, 0.08));
        padding: 2px 7px;
        border-radius: 4px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 11px;
        font-weight: 600;
      }
      .dgit-bar-add {
        color: #22c55e;
      }
      .dgit-bar-del {
        color: #ef4444;
      }
      .dgit-bar-comments-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--dsw-alias-fill-quaternary, rgba(125, 125, 125, 0.08));
        padding: 2px 7px;
        border-radius: 4px;
        font-size: 11px;
        color: var(--dsw-alias-label-secondary);
      }
      .dgit-bar-ci-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: var(--dsw-alias-fill-quaternary, rgba(125, 125, 125, 0.08));
        border: 1px solid var(--dsw-alias-border-l2-darkmode-thin, rgba(125, 125, 125, 0.1));
        padding: 2px 7px;
        border-radius: 4px;
        font: inherit;
        font-size: 11px;
        font-weight: 500;
        color: var(--dsw-alias-label-secondary);
        cursor: pointer;
        transition: background 0.15s ease;
      }
      .dgit-bar-ci-pill:hover {
        background: var(--dsw-alias-interactive-bg-hover, rgba(125, 125, 125, 0.15));
        color: var(--dsw-alias-label-primary);
      }
      .dgit-bar-dismiss {
        background: transparent;
        border: none;
        color: var(--dsw-alias-label-tertiary);
        font-size: 13px;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        line-height: 1;
        transition: background 0.15s ease, color 0.15s ease;
      }
      .dgit-bar-dismiss:hover {
        background: var(--dsw-alias-fill-quaternary, rgba(125, 125, 125, 0.08));
        color: var(--dsw-alias-label-primary);
      }

      /* Hero Workspace Row Chip */
      .dgit-chip-container {
        display: inline-flex;
        align-items: center;
        margin-left: 6px;
        position: relative;
        font-family: inherit;
      }
      .dgit-chip {
        display: inline-flex;
        align-items: center;
        height: 28px;
        border-radius: 14px;
        background: var(--dsw-alias-interactive-bg-subtle, rgba(255, 255, 255, 0.05));
        border: 1px solid var(--dsw-alias-border-subtle, rgba(255, 255, 255, 0.12));
        color: var(--dsw-alias-label-primary, #e2e8f0);
        font-size: 13px;
        font-weight: 500;
        line-height: 20px;
        user-select: none;
        box-sizing: border-box;
        transition: border-color 0.15s ease, background 0.15s ease;
      }
      .dgit-chip:hover {
        border-color: var(--dsw-alias-border-hover, rgba(255, 255, 255, 0.25));
      }
      .dgit-branch-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0 10px 0 10px;
        background: transparent;
        border: none;
        color: inherit;
        font: inherit;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        border-radius: 14px 0 0 14px;
        height: 100%;
        transition: background 0.15s ease;
      }
      .dgit-branch-btn:hover {
        background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.1));
      }
      .dgit-divider {
        width: 1px;
        height: 14px;
        background: var(--dsw-alias-border-subtle, rgba(255, 255, 255, 0.15));
        flex-shrink: 0;
      }
      .dgit-wt-toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0 10px 0 8px;
        background: transparent;
        border: none;
        color: var(--dsw-alias-label-secondary, #94a3b8);
        font: inherit;
        font-size: 12px;
        cursor: pointer;
        border-radius: 0 14px 14px 0;
        height: 100%;
        transition: background 0.15s ease, color 0.15s ease;
      }
      .dgit-wt-toggle:hover {
        background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.1));
        color: var(--dsw-alias-label-primary, #f8fafc);
      }
      .dgit-wt-toggle[data-active="true"] {
        color: var(--dsw-alias-accent, #38bdf8);
        background: rgba(56, 189, 248, 0.12);
      }
      .dgit-wt-checkbox {
        width: 13px;
        height: 13px;
        border-radius: 3px;
        border: 1.5px solid currentColor;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
      }
      .dgit-wt-checkbox-inner {
        width: 7px;
        height: 7px;
        background: currentColor;
        border-radius: 1.5px;
      }

      /* Dropdown Popover */
      .dgit-popover {
        position: absolute;
        bottom: calc(100% + 8px);
        left: 0;
        min-width: 320px;
        max-width: 440px;
        max-height: 460px;
        background: var(--dsw-specific-input-major, #ffffff);
        border: 1px solid var(--dsw-alias-border-l2-darkmode-thin, rgba(0, 0, 0, 0.12));
        border-radius: 12px;
        box-shadow: var(--dsw-shadow-lv3, 0 12px 32px rgba(0, 0, 0, 0.2));
        z-index: 9999;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .dgit-popover-down {
        bottom: auto;
        top: calc(100% + 8px);
        box-shadow: var(--dsw-shadow-lv3, 0 12px 32px rgba(0, 0, 0, 0.2));
      }
      .dgit-popover-header {
        padding: 10px 12px;
        font-size: 12px;
        font-weight: 600;
        color: var(--dsw-alias-label-secondary);
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--dsw-alias-border-l2-darkmode-thin, rgba(0, 0, 0, 0.08));
      }
      .dgit-new-wt-btn {
        background: var(--dsw-alias-accent, #2563eb);
        border: none;
        color: #ffffff;
        font: inherit;
        font-size: 11px;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 6px;
        cursor: pointer;
        transition: opacity 0.15s ease;
      }
      .dgit-new-wt-btn:hover {
        opacity: 0.9;
      }
      .dgit-popover-subhead {
        padding: 8px 12px 4px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--dsw-alias-label-tertiary);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .dgit-toggle-btn {
        background: transparent;
        border: none;
        color: var(--dsw-alias-accent, #3b82f6);
        font: inherit;
        font-size: 11px;
        cursor: pointer;
        padding: 0 4px;
      }
      .dgit-toggle-btn:hover {
        text-decoration: underline;
      }
      .dgit-popover-list {
        overflow-y: auto;
        padding: 4px 6px 8px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .dgit-popover-prs {
        padding: 2px 6px 6px;
        display: flex;
        flex-direction: column;
        gap: 3px;
        border-bottom: 1px solid var(--dsw-alias-border-l2-darkmode-thin, rgba(0, 0, 0, 0.08));
      }
      .dgit-pr-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 8px;
        border-radius: 6px;
        text-decoration: none;
        color: var(--dsw-alias-label-primary);
        font-size: 12px;
        transition: background 0.15s ease;
        box-sizing: border-box;
      }
      .dgit-pr-row:hover {
        background: var(--dsw-alias-fill-quaternary, rgba(0, 0, 0, 0.05));
      }
      .dgit-pr-row[data-current="true"] {
        background: var(--dsw-alias-interactive-bg-subtle, rgba(56, 189, 248, 0.1));
        border: 1px solid var(--dsw-alias-accent, rgba(56, 189, 248, 0.3));
      }
      .dgit-pr-row-num {
        font-weight: 600;
        color: var(--dsw-alias-accent, #3b82f6);
        flex-shrink: 0;
      }
      .dgit-pr-row-title {
        flex: 1;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--dsw-alias-label-secondary);
      }
      .dgit-pr-row-diff {
        display: inline-flex;
        gap: 3px;
        font-family: monospace;
        font-size: 11px;
        font-weight: 600;
        flex-shrink: 0;
      }
      .dgit-popover-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 6px;
        background: transparent;
        border: none;
        color: var(--dsw-alias-label-primary);
        font: inherit;
        font-size: 12px;
        text-align: left;
        cursor: pointer;
        width: 100%;
        box-sizing: border-box;
      }
      .dgit-popover-item:hover {
        background: var(--dsw-alias-fill-quaternary, rgba(0, 0, 0, 0.05));
      }
      .dgit-popover-item[data-current="true"] {
        background: var(--dsw-alias-interactive-bg-subtle, rgba(56, 189, 248, 0.12));
        color: var(--dsw-alias-accent, #3b82f6);
        font-weight: 500;
      }
      .dgit-bullet-current {
        color: var(--dsw-alias-accent, #38bdf8);
        font-size: 16px;
        line-height: 1;
        width: 14px;
        text-align: center;
      }
      .dgit-branch-name {
        flex: 1;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dgit-badge-wt {
        font-size: 10px;
        padding: 1px 5px;
        border-radius: 4px;
        background: rgba(56, 189, 248, 0.2);
        color: #38bdf8;
        font-weight: 600;
        margin-left: 4px;
      }
      .dgit-portal-host {
        display: inline-flex;
        align-items: center;
      }
    `;

    function installStyles(ctx) {
      ctx.effect(() => {
        const tag = document.createElement("style");
        tag.dataset.dshGit = "1";
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => tag.remove();
      }, "dsh-git: styles");
    }

    // SVG Icons
    const BRANCH_SVG = (color = "currentColor") =>
      h("svg", { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", stroke: color, strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" },
        h("circle", { cx: 4, cy: 4, r: 1.75 }),
        h("circle", { cx: 4, cy: 12, r: 1.75 }),
        h("circle", { cx: 12, cy: 6, r: 1.75 }),
        h("path", { d: "M4 5.75V10.25" }),
        h("path", { d: "M4 8C4 8 7 6 10.25 6" })
      );

    const CHEVRON_DOWN_SVG = h("svg", { width: 10, height: 10, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
      h("path", { d: "M4 6L8 10L12 6" })
    );

    const COMMENT_SVG = h("svg", { width: 12, height: 12, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" },
      h("path", { d: "M2.5 3.5h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5.5L2.5 15.5V4.5a1 1 0 0 1 1-1z" })
    );

    /**
     * Claude Code-style Dock Bar mounted in conversation.input.dock
     * Sits directly above the prompt input:
     * [ ⓧ #1482  composer-pipelines  DATASUB-784         +4,944 -0   💬 2  • CI ∨   ✕ ]
     */
    function ClaudeGitDock(props) {
      const { callRpc, onAdoptWorkspace, t, sessionId, useSessions, useSession, useWorkspaces } = props;
      const [gitStatus, setGitStatus] = useState(null);
      const [branches, setBranches] = useState([]);
      const [prs, setPrs] = useState([]);
      const [dropdownOpen, setDropdownOpen] = useState(false);
      const [ciOpen, setCiOpen] = useState(false);
      const [showAllPrs, setShowAllPrs] = useState(false);
      const [dismissed, setDismissed] = useState(false);
      const [loading, setLoading] = useState(false);
      const barRef = useRef(null);

      // Resolve root safely for active session
      const sessionCwd = useSession ? useSession((s) => s?.cwd) : undefined;
      const sessionsSummaryCwd = useSessions ? useSessions((s) => (sessionId ? s?.byId?.[sessionId]?.cwd : undefined)) : undefined;
      const workspaces = useWorkspaces ? useWorkspaces((s) => s?.items || []) : [];
      const owningWs = workspaces.find((w) => sessionId && Array.isArray(w.sessionIds) && w.sessionIds.includes(sessionId));
      const activeRoot = sessionCwd || sessionsSummaryCwd || owningWs?.path;

      const fetchStatus = useCallback(async () => {
        if (!activeRoot && !sessionId) return;
        try {
          const res = await callRpc("status", { sessionId, root: activeRoot });
          setGitStatus(res);
        } catch {
          setGitStatus(null);
        }
      }, [callRpc, sessionId, activeRoot]);

      const fetchBranches = useCallback(async () => {
        if (!activeRoot && !sessionId) return;
        try {
          const res = await callRpc("branches", { sessionId, root: activeRoot });
          setBranches(res?.items || []);
        } catch {
          setBranches([]);
        }
      }, [callRpc, sessionId, activeRoot]);

      const fetchPrs = useCallback(async () => {
        if (!activeRoot && !sessionId) return;
        try {
          const list = await callRpc("pullRequests", { sessionId, root: activeRoot });
          setPrs(list || []);
        } catch {
          setPrs([]);
        }
      }, [callRpc, sessionId, activeRoot]);

      useEffect(() => {
        fetchStatus();
        fetchPrs();
      }, [fetchStatus, fetchPrs]);

      useEffect(() => {
        if (dropdownOpen) {
          fetchBranches();
          fetchPrs();
        }
      }, [dropdownOpen, fetchBranches, fetchPrs]);

      // Close dropdown on outside click
      useEffect(() => {
        if (!dropdownOpen && !ciOpen) return;
        const handleDocClick = (e) => {
          if (barRef.current && !barRef.current.contains(e.target)) {
            setDropdownOpen(false);
            setCiOpen(false);
          }
        };
        document.addEventListener("mousedown", handleDocClick);
        return () => document.removeEventListener("mousedown", handleDocClick);
      }, [dropdownOpen, ciOpen]);

      const handleSelectBranch = useCallback(async (item) => {
        setDropdownOpen(false);
        if (item.current) return;
        setLoading(true);
        try {
          if (item.isWorktree && item.worktreePath && onAdoptWorkspace) {
            await onAdoptWorkspace(item.worktreePath);
          } else {
            await callRpc("switchBranch", { sessionId, root: activeRoot, branch: item.name });
            await fetchStatus();
          }
        } catch (err) {
          console.error("Failed to switch branch:", err);
        } finally {
          setLoading(false);
        }
      }, [callRpc, sessionId, activeRoot, fetchStatus, onAdoptWorkspace]);

      const handleCreateWorktree = useCallback(async () => {
        const raw = window.prompt(t("promptNewWorktree") || "New worktree branch name:");
        if (!raw) return;
        const name = raw.trim();
        if (!name) return;

        setLoading(true);
        try {
          const res = await callRpc("createWorktree", { sessionId, root: activeRoot, newBranch: name });
          if (res && res.ok && res.worktreePath) {
            if (onAdoptWorkspace) {
              await onAdoptWorkspace(res.worktreePath);
            }
            await fetchStatus();
            setDropdownOpen(false);
          } else {
            alert((t("errorPrefix") || "Error: ") + (res?.error || "Failed to create worktree"));
          }
        } catch (err) {
          alert((t("errorPrefix") || "Error: ") + (err?.message || String(err)));
        } finally {
          setLoading(false);
        }
      }, [callRpc, sessionId, activeRoot, onAdoptWorkspace, fetchStatus, t]);

      if (dismissed || !gitStatus || !gitStatus.isGit) return null;

      const branchName = gitStatus.branch || "—";
      const isWorktree = Boolean(gitStatus.isWorktree);

      // Find if current branch has an active PR
      const currentPr = prs.find(
        (p) => p.branch === gitStatus.branch || p.headRefName === gitStatus.branch
      );

      return h("div", { className: "dgit-dock-seat" },
        h("div", { className: "dgit-claude-bar", ref: barRef },
        // Left section: Status icon, PR#, Repo, Branch, Worktree
        h("div", { className: "dgit-bar-left" },
          currentPr ? (
            currentPr.ciStatus === "failure"
              ? h("span", { className: "dgit-ci-circle-fail", title: currentPr.ciSummary || "CI failing" }, "✕")
              : currentPr.ciStatus === "pending"
              ? h("span", { className: "dgit-ci-circle-wait", title: currentPr.ciSummary || "CI running" }, "◌")
              : h("span", { className: "dgit-ci-circle-pass", title: currentPr.ciSummary || "CI passed" }, "✓")
          ) : (
            BRANCH_SVG("#9ca3af")
          ),
          currentPr ? h("a", {
            className: "dgit-bar-pr-num",
            href: currentPr.url,
            target: "_blank",
            rel: "noopener noreferrer",
            title: currentPr.title,
          }, `#${currentPr.number}`) : null,
          h("span", { className: "dgit-bar-repo" }, gitStatus.repoName),
          // Branch Switcher button
          h("button", {
            className: "dgit-bar-branch-btn",
            onClick: () => setDropdownOpen(!dropdownOpen),
            title: `Switch branch (${branchName})`,
          },
            h("span", { className: "dgit-bar-branch-text" }, branchName),
            isWorktree ? h("span", { className: "dgit-badge-wt" }, "wt") : null,
            CHEVRON_DOWN_SVG
          ),
          // Worktree checkbox toggle
          h("button", {
            className: "dgit-bar-wt-btn",
            "data-active": isWorktree ? "true" : "false",
            onClick: isWorktree ? () => setDropdownOpen(!dropdownOpen) : handleCreateWorktree,
            title: isWorktree
              ? (t("worktreeActiveTitle") || "Current session runs in an isolated Git Worktree")
              : (t("worktreeInactiveTitle") || "Click to create an isolated worktree for this repository"),
          },
            h("span", { className: "dgit-wt-checkbox" },
              isWorktree ? h("span", { className: "dgit-wt-checkbox-inner" }) : null
            ),
            h("span", null, t("worktree") || "worktree")
          )
        ),
        // Right section: Diff pill, comments, CI dropdown, dismiss
        h("div", { className: "dgit-bar-right" },
          currentPr && (currentPr.additions || currentPr.deletions) ? h("span", { className: "dgit-bar-diff-pill" },
            currentPr.additions ? h("span", { className: "dgit-bar-add" }, `+${currentPr.additions.toLocaleString()}`) : null,
            currentPr.deletions ? h("span", { className: "dgit-bar-del" }, `-${currentPr.deletions.toLocaleString()}`) : null
          ) : null,
          currentPr && currentPr.commentsCount ? h("span", { className: "dgit-bar-comments-pill", title: `${currentPr.commentsCount} comments` },
            COMMENT_SVG,
            h("span", null, currentPr.commentsCount)
          ) : null,
          currentPr ? h("button", {
            className: "dgit-bar-ci-pill",
            onClick: () => setCiOpen(!ciOpen),
            title: currentPr.ciSummary || "CI status",
          },
            h("span", {
              style: {
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: currentPr.ciStatus === "failure" ? "#ef4444" : currentPr.ciStatus === "pending" ? "#eab308" : "#22c55e",
              }
            }),
            h("span", null, "CI"),
            CHEVRON_DOWN_SVG
          ) : (
            h("button", {
              className: "dgit-new-wt-btn",
              onClick: handleCreateWorktree,
            }, t("newWorktree") || "+ New Worktree")
          ),
          h("button", {
            className: "dgit-bar-dismiss",
            onClick: () => setDismissed(true),
            title: t("dismiss") || "Dismiss",
          }, "✕")
        ),
        // CI Details popover
        ciOpen && currentPr ? h("div", { className: "dgit-popover", style: { right: 0, left: "auto", minWidth: 240 } },
          h("div", { className: "dgit-popover-header" },
            h("span", null, currentPr.ciSummary || "CI Status"),
            h("a", {
              href: currentPr.url + "/checks",
              target: "_blank",
              rel: "noopener noreferrer",
              style: { color: "#38bdf8", textDecoration: "none", fontSize: 11 }
            }, "Open Checks ↗")
          )
        ) : null,
        // Branch & PRs dropdown popover
        dropdownOpen ? h("div", { className: "dgit-popover" },
          h("div", { className: "dgit-popover-header" },
            h("span", null, `${gitStatus.repoName} (${branchName})`),
            h("button", {
              className: "dgit-new-wt-btn",
              onClick: handleCreateWorktree,
            }, t("newWorktree") || "+ New Worktree")
          ),
          // Pull Requests Section (if any open PRs)
          prs.length > 0 ? h("div", null,
            h("div", { className: "dgit-popover-subhead" },
              h("span", null, (t("pullRequests") || "Pull Requests") + ` (${prs.length})`),
              prs.length > 3 ? h("button", {
                className: "dgit-toggle-btn",
                onClick: (e) => { e.stopPropagation(); setShowAllPrs(!showAllPrs); },
              }, showAllPrs ? (t("showLess") || "Less") : (t("showAll") || "All")) : null
            ),
            h("div", { className: "dgit-popover-prs" },
              (showAllPrs ? prs : prs.slice(0, 3)).map((pr) => {
                const isCur = currentPr && currentPr.number === pr.number;
                return h("a", {
                  key: pr.number,
                  className: "dgit-pr-row",
                  href: pr.url,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  "data-current": isCur ? "true" : "false",
                },
                  pr.ciStatus === "failure"
                    ? h("span", { className: "dgit-ci-circle-fail", style: { width: 14, height: 14, fontSize: 10 } }, "✕")
                    : pr.ciStatus === "pending"
                    ? h("span", { className: "dgit-ci-circle-wait", style: { width: 14, height: 14, fontSize: 10 } }, "◌")
                    : h("span", { className: "dgit-ci-circle-pass", style: { width: 14, height: 14, fontSize: 10 } }, "✓"),
                  h("span", { className: "dgit-pr-row-num" }, `#${pr.number}`),
                  h("span", { className: "dgit-pr-row-title", title: pr.title }, pr.title),
                  pr.additions || pr.deletions ? h("span", { className: "dgit-pr-row-diff" },
                    pr.additions ? h("span", { className: "dgit-bar-add" }, `+${pr.additions}`) : null,
                    pr.deletions ? h("span", { className: "dgit-bar-del" }, `-${pr.deletions}`) : null
                  ) : null
                );
              })
            )
          ) : null,
          // Branches Section
          h("div", { className: "dgit-popover-subhead" }, t("branch") || "Branches"),
          h("div", { className: "dgit-popover-list" },
            branches.map((b) => {
              const isCur = b.current || b.name === gitStatus.branch;
              return h("button", {
                key: b.name,
                className: "dgit-popover-item",
                "data-current": isCur ? "true" : "false",
                onClick: () => handleSelectBranch(b),
                disabled: loading,
              },
                isCur ? h("span", { className: "dgit-bullet-current" }, "•") : BRANCH_SVG(),
                h("span", { className: "dgit-branch-name" }, b.name),
                b.isWorktree ? h("span", { className: "dgit-badge-wt" }, "wt") : null
              );
            })
          )
        ) : null
        )
      );
    }

    /**
     * Hero Chip for mounting into heroWorkspaceRow beside Folder chip
     */
    function HeroGitChip({ callRpc, sessionId, root, onAdoptWorkspace, t }) {
      const [gitStatus, setGitStatus] = useState(null);
      const [branches, setBranches] = useState([]);
      const [dropdownOpen, setDropdownOpen] = useState(false);
      const [loading, setLoading] = useState(false);
      const chipRef = useRef(null);

      const fetchStatus = useCallback(async () => {
        if (!root && !sessionId) return;
        try {
          const res = await callRpc("status", { sessionId, root });
          setGitStatus(res);
        } catch {
          setGitStatus(null);
        }
      }, [callRpc, sessionId, root]);

      const fetchBranches = useCallback(async () => {
        if (!root && !sessionId) return;
        try {
          const res = await callRpc("branches", { sessionId, root });
          setBranches(res?.items || []);
        } catch {
          setBranches([]);
        }
      }, [callRpc, sessionId, root]);

      useEffect(() => {
        fetchStatus();
      }, [fetchStatus]);

      useEffect(() => {
        if (dropdownOpen) fetchBranches();
      }, [dropdownOpen, fetchBranches]);

      useEffect(() => {
        if (!dropdownOpen) return;
        const handleDocClick = (e) => {
          if (chipRef.current && !chipRef.current.contains(e.target)) {
            setDropdownOpen(false);
          }
        };
        document.addEventListener("mousedown", handleDocClick);
        return () => document.removeEventListener("mousedown", handleDocClick);
      }, [dropdownOpen]);

      const handleSelectBranch = useCallback(async (item) => {
        setDropdownOpen(false);
        if (item.current) return;
        setLoading(true);
        try {
          if (item.isWorktree && item.worktreePath && onAdoptWorkspace) {
            await onAdoptWorkspace(item.worktreePath);
          } else {
            await callRpc("switchBranch", { sessionId, root, branch: item.name });
            await fetchStatus();
          }
        } catch (err) {
          console.error("Failed to switch branch:", err);
        } finally {
          setLoading(false);
        }
      }, [callRpc, sessionId, root, fetchStatus, onAdoptWorkspace]);

      const handleCreateWorktree = useCallback(async () => {
        const raw = window.prompt(t("promptNewWorktree") || "New worktree branch name:");
        if (!raw) return;
        const name = raw.trim();
        if (!name) return;

        setLoading(true);
        try {
          const res = await callRpc("createWorktree", { sessionId, root, newBranch: name });
          if (res && res.ok && res.worktreePath) {
            if (onAdoptWorkspace) {
              await onAdoptWorkspace(res.worktreePath);
            }
            await fetchStatus();
            setDropdownOpen(false);
          } else {
            alert((t("errorPrefix") || "Error: ") + (res?.error || "Failed to create worktree"));
          }
        } catch (err) {
          alert((t("errorPrefix") || "Error: ") + (err?.message || String(err)));
        } finally {
          setLoading(false);
        }
      }, [callRpc, sessionId, root, onAdoptWorkspace, fetchStatus, t]);

      if (!gitStatus || !gitStatus.isGit) return null;

      const branchName = gitStatus.branch || "—";
      const isWorktree = Boolean(gitStatus.isWorktree);

      return h("div", { className: "dgit-chip-container", ref: chipRef },
        h("div", { className: "dgit-chip" },
          h("button", {
            className: "dgit-branch-btn",
            onClick: () => setDropdownOpen(!dropdownOpen),
            title: `Git: ${gitStatus.repoName} (${branchName})`,
          },
            BRANCH_SVG(),
            h("span", null, branchName),
            CHEVRON_DOWN_SVG
          ),
          h("div", { className: "dgit-divider" }),
          h("button", {
            className: "dgit-wt-toggle",
            "data-active": isWorktree ? "true" : "false",
            onClick: isWorktree ? () => setDropdownOpen(!dropdownOpen) : handleCreateWorktree,
            title: isWorktree
              ? (t("worktreeActiveTitle") || "Current session runs in an isolated Git Worktree")
              : (t("worktreeInactiveTitle") || "Click to create an isolated worktree for this repository"),
          },
            h("span", { className: "dgit-wt-checkbox" },
              isWorktree ? h("span", { className: "dgit-wt-checkbox-inner" }) : null
            ),
            h("span", null, t("worktree") || "worktree")
          )
        ),
        dropdownOpen ? h("div", { className: "dgit-popover dgit-popover-down" },
          h("div", { className: "dgit-popover-header" },
            h("span", null, `${gitStatus.repoName} (${branchName})`),
            h("button", {
              className: "dgit-new-wt-btn",
              onClick: handleCreateWorktree,
            }, t("newWorktree") || "+ New Worktree")
          ),
          h("div", { className: "dgit-popover-subhead" }, t("branch") || "Branches"),
          h("div", { className: "dgit-popover-list" },
            branches.map((b) => {
              const isCur = b.current || b.name === gitStatus.branch;
              return h("button", {
                key: b.name,
                className: "dgit-popover-item",
                "data-current": isCur ? "true" : "false",
                onClick: () => handleSelectBranch(b),
                disabled: loading,
              },
                isCur ? h("span", { className: "dgit-bullet-current" }, "•") : BRANCH_SVG(),
                h("span", { className: "dgit-branch-name" }, b.name),
                b.isWorktree ? h("span", { className: "dgit-badge-wt" }, "wt") : null
              );
            })
          )
        ) : null
      );
    }

    /** Portal manager for mounting the Git chip ONLY into heroWorkspaceRow on Hero screen */
    function HeroChipPortal(props) {
      const { callRpc, onAdoptWorkspace, t, useSessions, useWorkspaces } = props;
      const [host, setHost] = useState(null);
      const [domAnchorTitle, setDomAnchorTitle] = useState("");

      const currentSessionId = useSessions ? useSessions((s) => s?.current) : undefined;
      const currentSession = useSessions ? useSessions((s) => (currentSessionId ? s?.byId?.[currentSessionId] : undefined)) : undefined;
      const workspaces = useWorkspaces ? useWorkspaces((s) => s?.items || []) : [];

      const sessionWs = workspaces.find((w) => currentSessionId && Array.isArray(w.sessionIds) && w.sessionIds.includes(currentSessionId));
      const domWs = workspaces.find((w) => {
        if (!domAnchorTitle) return false;
        return w.title === domAnchorTitle || (w.path && w.path.endsWith("/" + domAnchorTitle));
      });

      const activeRoot = domWs?.path || sessionWs?.path || currentSession?.cwd;

      useEffect(() => {
        let node = null;
        let timer = null;

        const place = () => {
          // Strictly look for heroWorkspaceRow container. NEVER fall back to other buttons!
          const row = document.querySelector('[class*="heroWorkspaceRow"]');
          if (!row) {
            if (node) {
              node.remove();
              node = null;
              setHost(null);
            }
            return;
          }

          const anchor = row.querySelector("button");
          if (!anchor) {
            if (node) {
              node.remove();
              node = null;
              setHost(null);
            }
            return;
          }

          const title = anchor.textContent ? anchor.textContent.trim() : "";
          if (title && title !== domAnchorTitle) {
            setDomAnchorTitle(title);
          }

          if (node && node.parentElement === row) return;

          node = document.createElement("span");
          node.dataset.dshGit = "hero-chip";
          node.className = "dgit-portal-host";
          if (anchor.nextSibling) {
            row.insertBefore(node, anchor.nextSibling);
          } else {
            row.appendChild(node);
          }
          setHost(node);
        };

        place();
        const schedulePlace = () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(place, 80);
        };

        const mo = new MutationObserver(schedulePlace);
        mo.observe(document.body, { childList: true, subtree: true });
        return () => {
          if (timer) clearTimeout(timer);
          mo.disconnect();
          node?.remove();
        };
      }, [domAnchorTitle]);

      if (!host || !activeRoot) return null;
      return ReactDOM.createPortal(
        h(HeroGitChip, {
          callRpc,
          sessionId: currentSessionId,
          root: activeRoot,
          onAdoptWorkspace,
          t,
        }),
        host
      );
    }

    const inject = ["slots", "locale", "connection"];

    function apply(ctx) {
      installStyles(ctx);

      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-git: dictionaries");
      const t = ctx.locale.bind(NS);

      const rpc = async (method, args) => {
        const r = await ctx.connection.rpc.call("/api", method, { args: args || {} });
        if (r && r.ok) return r.value;
        const e = r && r.error;
        throw new Error(e ? e.code + ": " + e.message : "rpc failed");
      };
      const callRpc = (method, args) => rpc("dshGit/" + method, args);

      // Register Hero chip portal via shell.overlay (for blank start screen)
      ctx.slots.inject("shell.overlay", () =>
        ctx.slots.register({
          name: "shell.overlay",
          id: "dsh-git-hero-chip",
          order: 20,
          inject: () => ({
            callRpc,
            t,
          }),
        }, HeroChipPortal)
      );

      // Register Claude Code dock bar directly above prompt input in active conversation
      ctx.slots.inject("conversation.input.dock", () =>
        ctx.slots.register({
          name: "conversation.input.dock",
          id: "dsh-git-claude-dock",
          order: 10,
          inject: () => ({
            callRpc,
            t,
          }),
        }, ClaudeGitDock)
      );
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
