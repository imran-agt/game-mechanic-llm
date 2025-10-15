import React, { useEffect, useState } from "react";
import Workspace from "@/models/workspace";
import LoadingChat from "./LoadingChat";
import ChatContainer from "./ChatContainer";
import paths from "@/utils/paths";
import ModalWrapper from "../ModalWrapper";
import { useParams } from "react-router-dom";
import { DnDFileUploaderProvider } from "./ChatContainer/DnDWrapper";
import { WarningCircle } from "@phosphor-icons/react";
import {
  TTSProvider,
  useWatchForAutoPlayAssistantTTSResponse,
} from "../contexts/TTSProvider";

export default function WorkspaceChat({ loading, workspace }) {
  useWatchForAutoPlayAssistantTTSResponse();
  const { threadSlug = null } = useParams();
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    async function getHistory() {
      if (loading) return;
      if (!workspace?.slug) {
        setLoadingHistory(false);
        return false;
      }

      const chatHistory = threadSlug
        ? await Workspace.threads.chatHistory(workspace.slug, threadSlug)
        : await Workspace.chatHistory(workspace.slug);

      setHistory(chatHistory);
      setLoadingHistory(false);
    }
    getHistory();
  }, [workspace, loading]);

  if (loadingHistory) return <LoadingChat />;
  if (!loading && !loadingHistory && !workspace) {
    return (
      <>
        {loading === false && !workspace && (
          <ModalWrapper isOpen={true}>
            <div className="w-full max-w-2xl bg-theme-bg-secondary rounded-lg shadow border-2 border-theme-modal-border overflow-hidden">
              <div className="relative p-6 border-b rounded-t border-theme-modal-border">
                <div className="w-full flex gap-x-2 items-center">
                  <WarningCircle
                    className="text-red-500 w-6 h-6"
                    weight="fill"
                  />
                  <h3 className="text-xl font-semibold text-red-500 overflow-hidden overflow-ellipsis whitespace-nowrap">
                    Workspace not found
                  </h3>
                </div>
              </div>
              <div className="py-7 px-9 space-y-2 flex-col">
                <p className="text-white text-sm">
                  The workspace you're looking for is not available. It may have
                  been deleted or you may not have access to it.
                </p>
              </div>
              <div className="flex w-full justify-end items-center p-6 space-x-2 border-t border-theme-modal-border rounded-b">
                <a
                  href={paths.home()}
                  className="transition-all duration-300 bg-white text-black hover:opacity-60 px-4 py-2 rounded-lg text-sm"
                >
                  Return to homepage
                </a>
              </div>
            </div>
          </ModalWrapper>
        )}
        <LoadingChat />
      </>
    );
  }

  setEventDelegatorForCodeSnippets();
  setEventDelegatorForOpenInEditor(); // *** NEW: Add event handler for "Open in Editor" ***
  return (
    <TTSProvider>
      <DnDFileUploaderProvider workspace={workspace} threadSlug={threadSlug}>
        <ChatContainer workspace={workspace} knownHistory={history} />
      </DnDFileUploaderProvider>
    </TTSProvider>
  );
}

// Enables us to safely markdown and sanitize all responses without risk of injection
// but still be able to attach a handler to copy code snippets on all elements
// that are code snippets.
function copyCodeSnippet(uuid) {
  const target = document.querySelector(
    `[data-code-snippet][data-code="${uuid}"]`
  );
  if (!target) return false;
  const markdown =
    target.parentElement?.parentElement?.parentElement?.querySelector(
      "pre:first-of-type"
    )?.innerText;
  if (!markdown) return false;

  // Use fallback method that works in embedded browsers (CEF)
  const success = copyToClipboardFallback(markdown);

  if (success) {
    target.classList.add("text-green-500");
    const originalText = target.innerHTML;
    target.innerHTML = `
      <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><polyline points="20 6 9 17 4 12"></polyline></svg>
      <p class="text-xs" style="margin: 0px;padding: 0px;">Copied!</p>
    `;
    target.setAttribute("disabled", true);

    setTimeout(() => {
      target.classList.remove("text-green-500");
      target.innerHTML = originalText;
      target.removeAttribute("disabled");
    }, 2500);
  } else {
    console.error("[CopyBlock] Failed to copy to clipboard");
  }
}

// Fallback clipboard copy that works in embedded browsers without focus requirements
function copyToClipboardFallback(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "2em";
  textarea.style.height = "2em";
  textarea.style.padding = "0";
  textarea.style.border = "none";
  textarea.style.outline = "none";
  textarea.style.boxShadow = "none";
  textarea.style.background = "transparent";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let success = false;
  try {
    success = document.execCommand("copy");
    console.log(
      "[Clipboard] Copy using execCommand:",
      success ? "success" : "failed"
    );
  } catch (err) {
    console.error("[Clipboard] execCommand failed:", err);
  }

  document.body.removeChild(textarea);
  return success;
}

// *** NEW FUNCTION: Sends code snippet to Unity editor via UWB JavaScript interop ***
function openCodeInEditor(uuid, lang) {
  // Find the pre element containing the code
  const preElement = document.querySelector(`pre[data-code="${uuid}"]`);
  if (!preElement) {
    console.error(
      `[OpenInEditor] Could not find code block with UUID: ${uuid}`
    );
    return false;
  }

  // Get the text content of the code block
  const codeContent = preElement.innerText;
  if (!codeContent) {
    console.error(`[OpenInEditor] Code block is empty`);
    return false;
  }

  // Find the button that was clicked
  const button = document.querySelector(
    `[data-open-in-editor][data-code="${uuid}"]`
  );

  // Check if we're running inside Unity Web Browser
  if (
    typeof window.uwb !== "undefined" &&
    typeof window.uwb.ExecuteJsMethod === "function"
  ) {
    try {
      // Send code to Unity using the registered JS method
      const result = window.uwb.ExecuteJsMethod("OpenInEditor", {
        Content: codeContent,
        Language: lang || "text",
      });

      if (result) {
        // Show success feedback
        if (button) {
          button.classList.add("text-green-500");
          const originalText = button.innerHTML;
          button.innerHTML = `
            <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <p class="text-xs" style="margin: 0px;padding: 0px;">Sent!</p>
          `;
          button.setAttribute("disabled", true);

          setTimeout(() => {
            button.classList.remove("text-green-500");
            button.innerHTML = originalText;
            button.removeAttribute("disabled");
          }, 2500);
        }
        console.log(
          `[OpenInEditor] Successfully sent ${codeContent.length} characters to Unity`
        );
      } else {
        console.error("[OpenInEditor] Unity method returned false");
      }
    } catch (error) {
      console.error("[OpenInEditor] Error calling Unity method:", error);
    }
  } else {
    // Fallback: copy to clipboard if not running in Unity
    console.warn(
      "[OpenInEditor] Not running in Unity Web Browser, copying to clipboard instead"
    );

    const success = copyToClipboardFallback(codeContent);

    if (button) {
      button.classList.add("text-yellow-500");
      const originalText = button.innerHTML;
      button.innerHTML = `
        <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
        <p class="text-xs" style="margin: 0px;padding: 0px;">${success ? "Copied!" : "Failed"}</p>
      `;

      setTimeout(() => {
        button.classList.remove("text-yellow-500");
        button.innerHTML = originalText;
      }, 2500);
    }
  }

  return true;
}

// Listens and hunts for all data-code-snippet clicks.
export function setEventDelegatorForCodeSnippets() {
  document?.addEventListener("click", function (e) {
    const target = e.target.closest("[data-code-snippet]");
    const uuidCode = target?.dataset?.code;
    if (!uuidCode) return false;
    copyCodeSnippet(uuidCode);
  });
}

// *** NEW FUNCTION: Listens and hunts for all data-open-in-editor clicks ***
export function setEventDelegatorForOpenInEditor() {
  document?.addEventListener("click", function (e) {
    const target = e.target.closest("[data-open-in-editor]");
    if (!target) return false;

    const uuidCode = target.dataset?.code;
    const lang = target.dataset?.lang || "";

    if (!uuidCode) return false;

    openCodeInEditor(uuidCode, lang);
  });
}
