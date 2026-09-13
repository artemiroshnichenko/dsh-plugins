// dsh-chat-ux — browser client plugin for DeepSeek Harness Web GUI.
// Features:
// 1. Claude Code-style Revert (откат) and Fork (ветвление) on user and assistant messages.
// 2. Full unclipped prompt extraction from DOM with turnOutline fallback.
// 3. Automatic Lexical composer prefilling after revert or fork.
// 4. ArrowUp/ArrowDown prompt history navigation in composer.
// 5. System prompt deduplication and history paging enhancement.
window.__ModuleLoader__.load({
  id: "dsh-chat-ux",
  factory: (require) => {
    "use strict";
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const STYLE_ID = "dsh-chat-ux-styles";

    const CSS = `
      /* Hide repeat collapsed system prompts in chat history */
      [data-chat-flow-kind="system-prompt"] ~ [data-chat-flow-kind="system-prompt"] {
        display: none !important;
      }

      /* Action buttons matching DSH icon style */
      .dsh-chat-ux-action-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 6px;
        border: none;
        border-radius: 28px;
        color: var(--dsw-alias-label-tertiary);
        background: transparent;
        cursor: pointer;
        margin: 0;
        box-sizing: border-box;
        transition: color 80ms ease, background 80ms ease, transform 80ms ease;
        user-select: none;
        vertical-align: middle;
      }
      .dsh-chat-ux-action-btn:hover {
        background: var(--dsw-alias-fill-quaternary);
        color: var(--dsw-alias-label-primary);
      }
      .dsh-chat-ux-action-btn:active {
        transform: scale(0.92);
      }
      .dsh-chat-ux-action-btn svg {
        width: 16px;
        height: 16px;
        display: block;
      }

      /* Toast notification */
      .dsh-chat-ux-toast {
        position: fixed;
        bottom: 84px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--dsw-alias-surface-overlay, #222);
        color: var(--dsw-alias-label-primary, #fff);
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 13px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        z-index: 99999;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease, transform 0.2s ease;
      }
      .dsh-chat-ux-toast.visible {
        opacity: 1;
        transform: translateX(-50%) translateY(-4px);
      }
    `;

    const REVERT_SVG = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6.5H9.5C11.433 6.5 13 8.067 13 10C13 11.933 11.433 13.5 9.5 13.5H4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 4L4 6.5L6.5 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    const FORK_SVG = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M13.0762 1.37207C14.0846 1.37228 14.9021 2.19077 14.9023 3.19922C14.9022 4.20772 14.0847 5.02518 13.0762 5.02539C12.2967 5.02539 11.6325 4.53691 11.3701 3.84961H4.35547C4.79397 4.26458 5.15861 4.7644 5.41699 5.33496L7.10645 9.06738C7.88526 10.7875 9.55104 11.9228 11.4189 12.0371C11.7085 11.4109 12.3411 10.9756 13.0762 10.9756C14.0843 10.9759 14.9023 11.7936 14.9023 12.8018C14.9023 13.81 14.0843 14.6277 13.0762 14.6279C12.2534 14.6279 11.5574 14.0832 11.3291 13.335C8.9868 13.1879 6.89981 11.7612 5.92285 9.60352L4.23242 5.87109C3.67503 4.64033 2.44878 3.84961 1.09766 3.84961V2.54883C1.10665 2.54883 1.11601 2.54975 1.125 2.5498L11.3701 2.54883C11.6326 1.86151 12.2969 1.37207 13.0762 1.37207ZM13.0762 12.2764C12.7858 12.2764 12.5508 12.5114 12.5508 12.8018C12.5508 13.0921 12.7858 13.3281 13.0762 13.3281C13.3664 13.3279 13.6025 13.092 13.6025 12.8018C13.6025 12.5115 13.3664 12.2766 13.0762 12.2764ZM13.0762 2.67285C12.7855 2.67285 12.55 2.90861 12.5498 3.19922C12.5499 3.48987 12.7855 3.72559 13.0762 3.72559C13.3667 3.72538 13.6024 3.48975 13.6025 3.19922C13.6023 2.90874 13.3666 2.67306 13.0762 2.67285Z" fill="currentColor"/></svg>`;

    function installStyles() {
      if (typeof document === "undefined") return;
      if (document.getElementById(STYLE_ID)) return;
      const el = document.createElement("style");
      el.id = STYLE_ID;
      el.textContent = CSS;
      document.head.appendChild(el);
    }

    function showToast(message) {
      if (typeof document === "undefined") return;
      let toast = document.getElementById("dsh-chat-ux-toast");
      if (!toast) {
        toast = document.createElement("div");
        toast.id = "dsh-chat-ux-toast";
        toast.className = "dsh-chat-ux-toast";
        document.body.appendChild(toast);
      }
      toast.textContent = message;
      toast.classList.add("visible");
      setTimeout(() => {
        toast.classList.remove("visible");
      }, 2500);
    }

    /**
     * Put text into the Lexical composer and focus it.
     */
    function setComposerText(text) {
      if (!text || typeof document === "undefined") return;
      const composer =
        document.querySelector("[data-composer-input]") ||
        document.querySelector("div[role='textbox'][contenteditable='true']") ||
        document.querySelector("textarea");

      if (!composer) return;
      composer.focus();

      if (composer.tagName.toLowerCase() === "textarea") {
        const proto = Object.getPrototypeOf(composer);
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        if (setter) setter.call(composer, text);
        else composer.value = text;
        composer.dispatchEvent(new Event("input", { bubbles: true }));
        composer.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }

      // Lexical contenteditable
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(composer);
        selection.removeAllRanges();
        selection.addRange(range);

        const success = document.execCommand("insertText", false, text);
        if (!success) {
          composer.textContent = text;
          composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
        }
      } catch {
        composer.textContent = text;
        composer.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }

    /**
     * Extract prompt text from a rendered user message row or session projections.
     */
    function extractPromptForTurn(ctx, row, turn) {
      if (row) {
        const contentEl =
          row.querySelector("[class*='content'], [class*='bubble'], [class*='messageText']") ||
          row.querySelector("p, span");
        if (contentEl) {
          const t = contentEl.innerText?.trim();
          if (t) return t;
        }
      }
      const sessionId =
        ctx.get?.("sessions")?.list?.getSnapshot()?.current ||
        window.location.pathname.split("/").pop() ||
        "";
      if (sessionId) {
        const b = ctx.get?.("sessions")?.binding?.(sessionId);
        const to = b?.session?.projections?.valuesCache?.turnOutline;
        const entry = to?.find((item) => item.turn === turn);
        if (entry?.prompt) return entry.prompt;
      }
      return "";
    }

    /**
     * Check if a prompt was stashed before reload during in-place revert.
     */
    function checkPendingRevertPrompt() {
      if (typeof window === "undefined" || !window.sessionStorage) return;
      const pending = sessionStorage.getItem("dsh_revert_prompt");
      if (pending) {
        sessionStorage.removeItem("dsh_revert_prompt");
        let attempts = 0;
        const timer = setInterval(() => {
          attempts++;
          const composer = document.querySelector("[data-composer-input], div[role='textbox'][contenteditable='true'], textarea");
          if (composer) {
            setComposerText(pending);
            showToast("Диалог откачен, запрос возвращён в поле ввода");
            clearInterval(timer);
          } else if (attempts > 30) {
            clearInterval(timer);
          }
        }, 100);
      }
    }

    /**
     * Injects Revert and Fork actions into user and assistant message rows.
     */
    function setupRollbackAndFork(ctx) {
      if (typeof document === "undefined") return;

      const getSessionId = () => {
        return (
          ctx.get?.("sessions")?.list?.getSnapshot()?.current ||
          window.location.pathname.split("/").pop() ||
          ""
        );
      };

      const getTurnOutline = (sessionId) => {
        const b = ctx.get?.("sessions")?.binding?.(sessionId);
        return b?.session?.projections?.valuesCache?.turnOutline || [];
      };

      function updateRows() {
        const sessionId = getSessionId();
        if (!sessionId) return;

        // 1. User messages: inject Revert (↺) and Fork (⑂)
        const userRows = document.querySelectorAll('[data-chat-flow-kind="user"]');
        userRows.forEach((row) => {
          const turnAttr = row.getAttribute("data-chat-turn");
          const turn = turnAttr ? parseInt(turnAttr, 10) : null;
          if (turn === null || isNaN(turn)) return;

          const actionsContainer = row.querySelector("[class*='actions']");
          if (!actionsContainer) return;

          if (actionsContainer.getAttribute("data-dsh-chat-ux-turn") === String(turn)) return;

          actionsContainer.querySelectorAll(".dsh-chat-ux-injected").forEach((el) => el.remove());

          // Revert button (↺)
          const revertBtn = document.createElement("button");
          revertBtn.type = "button";
          revertBtn.className = "dsh-chat-ux-action-btn dsh-chat-ux-injected";
          revertBtn.title = "Откатить диалог к этому сообщению (Revert)";
          revertBtn.setAttribute("aria-label", "Revert");
          revertBtn.innerHTML = REVERT_SVG;

          revertBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            revertBtn.disabled = true;
            revertBtn.style.opacity = "0.5";
            const prompt = extractPromptForTurn(ctx, row, turn);
            try {
              let handled = false;
              // Try backend in-place revert first
              try {
                const res = await ctx.get?.("connection")?.rpc?.call("/api", "dshChatUx/revertTurn", {
                  sessionId: getSessionId(),
                  turn,
                });
                if (res && res.ok) {
                  handled = true;
                  const promptText = res.promptText || prompt;
                  if (res.inPlace) {
                    sessionStorage.setItem("dsh_revert_prompt", promptText);
                    window.location.reload();
                    return;
                  } else if (res.childSessionId) {
                    await ctx.get?.("sessions")?.open?.(res.childSessionId);
                    setTimeout(() => {
                      setComposerText(promptText);
                      showToast("Диалог откачен к ходу " + turn);
                    }, 300);
                    return;
                  }
                }
              } catch {
                // RPC not mounted or in-place disabled: fall through to client-side fork
              }

              if (!handled) {
                // Client-side branch before turn N
                const to = getTurnOutline(getSessionId());
                if (turn > 1) {
                  const prevTurn = to.find((t) => t.turn === turn - 1);
                  const atSeq = prevTurn ? prevTurn.seq : undefined;
                  const childId = await ctx.get?.("sessions")?.fork?.({
                    sessionId: getSessionId(),
                    ...atSeq !== undefined ? { atSeq } : {},
                    increaseTitle: true,
                  });
                  if (childId) {
                    await ctx.get?.("sessions")?.open?.(childId);
                    setTimeout(() => {
                      setComposerText(prompt);
                      showToast("Диалог откачен к ходу " + turn);
                    }, 300);
                  }
                } else {
                  // Turn 1: create new session
                  const childId = await ctx.get?.("sessions")?.create?.();
                  if (childId) {
                    await ctx.get?.("sessions")?.open?.(childId);
                    setTimeout(() => {
                      setComposerText(prompt);
                      showToast("Диалог откачен к первому ходу");
                    }, 300);
                  }
                }
              }
            } catch (err) {
              console.error("[dsh-chat-ux] revert error:", err);
              showToast("Ошибка при откате диалога");
            } finally {
              revertBtn.disabled = false;
              revertBtn.style.opacity = "1";
            }
          });

          // Fork button (⑂)
          const forkBtn = document.createElement("button");
          forkBtn.type = "button";
          forkBtn.className = "dsh-chat-ux-action-btn dsh-chat-ux-injected";
          forkBtn.title = "Ветвить диалог от этого сообщения (Fork)";
          forkBtn.setAttribute("aria-label", "Fork");
          forkBtn.innerHTML = FORK_SVG;

          forkBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            forkBtn.disabled = true;
            forkBtn.style.opacity = "0.5";
            const prompt = extractPromptForTurn(ctx, row, turn);
            try {
              const to = getTurnOutline(getSessionId());
              if (turn > 1) {
                const prevTurn = to.find((t) => t.turn === turn - 1);
                const atSeq = prevTurn ? prevTurn.seq : undefined;
                const childId = await ctx.get?.("sessions")?.fork?.({
                  sessionId: getSessionId(),
                  ...atSeq !== undefined ? { atSeq } : {},
                  increaseTitle: true,
                });
                if (childId) {
                  await ctx.get?.("sessions")?.open?.(childId);
                  setTimeout(() => {
                    setComposerText(prompt);
                    showToast("Создана новая ветка до хода " + turn);
                  }, 300);
                }
              } else {
                const childId = await ctx.get?.("sessions")?.create?.();
                if (childId) {
                  await ctx.get?.("sessions")?.open?.(childId);
                  setTimeout(() => {
                    setComposerText(prompt);
                    showToast("Создана новая ветка от начала");
                  }, 300);
                }
              }
            } catch (err) {
              console.error("[dsh-chat-ux] fork error:", err);
              showToast("Ошибка при ветвлении диалога");
            } finally {
              forkBtn.disabled = false;
              forkBtn.style.opacity = "1";
            }
          });

          actionsContainer.appendChild(revertBtn);
          actionsContainer.appendChild(forkBtn);
          actionsContainer.setAttribute("data-dsh-chat-ux-turn", String(turn));
        });

        // 2. Assistant messages: unlock and enhance Fork (⑂) in turn-tail
        const tailRows = document.querySelectorAll('[data-chat-flow-kind="turn-tail"], [data-chat-flow-kind="assistant"]');
        tailRows.forEach((row) => {
          const turnAttr = row.getAttribute("data-chat-turn");
          const turn = turnAttr ? parseInt(turnAttr, 10) : null;
          if (turn === null || isNaN(turn)) return;

          const actionsContainer = row.querySelector("[class*='actions']");
          if (!actionsContainer) return;

          if (actionsContainer.getAttribute("data-dsh-chat-ux-asst-turn") === String(turn)) return;

          const nativeBranch = actionsContainer.querySelector("button[aria-label*='Branch' i], button[aria-label*='branch' i]");
          if (nativeBranch) {
            nativeBranch.removeAttribute("data-unavailable");
            nativeBranch.removeAttribute("aria-disabled");
            nativeBranch.removeAttribute("disabled");
            nativeBranch.style.pointerEvents = "auto";
            nativeBranch.style.opacity = "1";
            nativeBranch.title = "Ветвить диалог от этого ответа (Fork)";

            // Clone button to replace existing event listeners cleanly
            const activeBranch = nativeBranch.cloneNode(true);
            activeBranch.addEventListener("click", async (e) => {
              e.preventDefault();
              e.stopPropagation();
              activeBranch.style.opacity = "0.5";
              try {
                const to = getTurnOutline(getSessionId());
                const isLatest = to.length > 0 && to[to.length - 1].turn === turn;
                const turnEntry = to.find((t) => t.turn === turn);
                const atSeq = isLatest || !turnEntry ? undefined : turnEntry.seq;

                const childId = await ctx.get?.("sessions")?.fork?.({
                  sessionId: getSessionId(),
                  ...atSeq !== undefined ? { atSeq } : {},
                  increaseTitle: true,
                });
                if (childId) {
                  await ctx.get?.("sessions")?.open?.(childId);
                  showToast("Создана новая ветка от ответа хода " + turn);
                }
              } catch (err) {
                console.error("[dsh-chat-ux] assistant fork error:", err);
                showToast("Ошибка при ветвлении диалога");
              } finally {
                activeBranch.style.opacity = "1";
              }
            });
            nativeBranch.parentNode.replaceChild(activeBranch, nativeBranch);
          } else {
            actionsContainer.querySelectorAll(".dsh-chat-ux-asst-fork").forEach((el) => el.remove());

            const forkBtn = document.createElement("button");
            forkBtn.type = "button";
            forkBtn.className = "dsh-chat-ux-action-btn dsh-chat-ux-asst-fork";
            forkBtn.title = "Ветвить диалог от этого ответа (Fork)";
            forkBtn.setAttribute("aria-label", "Fork");
            forkBtn.innerHTML = FORK_SVG;

            forkBtn.addEventListener("click", async (e) => {
              e.preventDefault();
              e.stopPropagation();
              forkBtn.disabled = true;
              forkBtn.style.opacity = "0.5";
              try {
                const to = getTurnOutline(getSessionId());
                const isLatest = to.length > 0 && to[to.length - 1].turn === turn;
                const turnEntry = to.find((t) => t.turn === turn);
                const atSeq = isLatest || !turnEntry ? undefined : turnEntry.seq;

                const childId = await ctx.get?.("sessions")?.fork?.({
                  sessionId: getSessionId(),
                  ...atSeq !== undefined ? { atSeq } : {},
                  increaseTitle: true,
                });
                if (childId) {
                  await ctx.get?.("sessions")?.open?.(childId);
                  showToast("Создана новая ветка от ответа хода " + turn);
                }
              } catch (err) {
                console.error("[dsh-chat-ux] assistant fork error:", err);
                showToast("Ошибка при ветвлении диалога");
              } finally {
                forkBtn.disabled = false;
                forkBtn.style.opacity = "1";
              }
            });

            const copyBtn = actionsContainer.querySelector("button[aria-label*='copy' i]");
            if (copyBtn && copyBtn.nextSibling) {
              actionsContainer.insertBefore(forkBtn, copyBtn.nextSibling);
            } else {
              actionsContainer.appendChild(forkBtn);
            }
          }

          actionsContainer.setAttribute("data-dsh-chat-ux-asst-turn", String(turn));
        });
      }

      const observer = new MutationObserver(() => updateRows());
      observer.observe(document.body, { childList: true, subtree: true });

      updateRows();
      setInterval(updateRows, 1000);
    }

    /**
     * Keyboard navigation for composer history (ArrowUp / ArrowDown).
     */
    function setupComposerHistory() {
      if (typeof window === "undefined" || !window.localStorage) return;

      const STORAGE_KEY = "dsh_composer_prompt_history";
      const MAX_HISTORY = 60;

      function getHistory() {
        try {
          return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        } catch {
          return [];
        }
      }

      function pushHistory(text) {
        if (!text || !text.trim()) return;
        const trimmed = text.trim();
        let history = getHistory();
        if (history.length > 0 && history[history.length - 1] === trimmed) return;
        history.push(trimmed);
        if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        } catch {}
      }

      let historyIndex = -1;
      let draftText = "";

      document.addEventListener("keydown", (e) => {
        const composer = e.target?.closest?.("[data-composer-input], div[role='textbox'][contenteditable='true'], textarea");
        if (!composer) return;

        const currentText = (composer.textContent || composer.value || "").trim();

        // On Enter without Shift (sending message), record in history
        if (e.key === "Enter" && !e.shiftKey) {
          if (currentText) pushHistory(currentText);
          historyIndex = -1;
          draftText = "";
          return;
        }

        // ArrowUp at top of composer or when empty
        if (e.key === "ArrowUp") {
          const history = getHistory();
          if (history.length === 0) return;

          if (!currentText || historyIndex !== -1) {
            e.preventDefault();
            if (historyIndex === -1) {
              draftText = currentText;
              historyIndex = history.length - 1;
            } else if (historyIndex > 0) {
              historyIndex--;
            }
            setComposerText(history[historyIndex]);
          }
          return;
        }

        // ArrowDown when navigating history
        if (e.key === "ArrowDown" && historyIndex !== -1) {
          const history = getHistory();
          e.preventDefault();
          if (historyIndex < history.length - 1) {
            historyIndex++;
            setComposerText(history[historyIndex]);
          } else {
            historyIndex = -1;
            setComposerText(draftText);
          }
        }
      });
    }

    /**
     * Intercepts "Load earlier" clicks to pull earlier dialogue turns.
     */
    function setupHistoryPagingInterceptor(ctx) {
      if (typeof document === "undefined") return;

      let isPaging = false;

      document.addEventListener("click", async (e) => {
        const btn = e.target && e.target.closest ? e.target.closest("[data-chat-paging-boundary]") : null;
        if (!btn || isPaging) return;

        const currentSessionId = ctx.get?.("sessions")?.list?.getSnapshot()?.current;
        if (!currentSessionId) return;

        isPaging = true;
        try {
          const chatContainer = btn.closest("[data-chat-flow-container], [class*='chatFlow'], [class*='flowContainer']") || document.body;
          const getVisibleUserMessagesCount = () =>
            chatContainer.querySelectorAll('[data-chat-flow-kind="user"]').length;

          const initialCount = getVisibleUserMessagesCount();
          let attempts = 0;
          const maxAttempts = 5;

          while (attempts < maxAttempts) {
            attempts++;
            await new Promise((r) => setTimeout(r, 220));

            const currentCount = getVisibleUserMessagesCount();
            const pagingBtn = document.querySelector("[data-chat-paging-boundary]");
            if (!pagingBtn || pagingBtn.hasAttribute("disabled")) break;
            if (currentCount > initialCount) break;

            pagingBtn.click();
          }
        } catch (err) {
          console.warn("[dsh-chat-ux] history paging error:", err);
        } finally {
          isPaging = false;
        }
      }, true);
    }

    const inject = ["slots", "sessions", "connection"];

    function apply(ctx) {
      window.__dsh_chat_ux_ctx = ctx;
      installStyles();
      checkPendingRevertPrompt();
      setupRollbackAndFork(ctx);
      setupComposerHistory();
      setupHistoryPagingInterceptor(ctx);
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
