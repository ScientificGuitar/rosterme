import { useEffect, useRef } from "react"

export const UNSAVED_CHANGES_MESSAGE =
  "You have unsaved changes. Are you sure you want to leave?"

type NavigationGuard = () => string | false

const guards = new Set<NavigationGuard>()

function registerNavigationGuard(guard: NavigationGuard): () => void {
  guards.add(guard)
  return () => {
    guards.delete(guard)
  }
}

/**
 * Synchronously asks every registered guard whether navigation may proceed.
 * Shows the browser-native confirm dialog for the first dirty guard.
 * Programmatic `navigate()` calls and non-link buttons should consult this
 * before navigating; link clicks and back/forward are intercepted by the
 * hook below. Returns true when navigation may proceed.
 */
export function confirmNavigation(): boolean {
  for (const guard of guards) {
    const message = guard()
    if (message) {
      if (!window.confirm(message)) return false
    }
  }
  return true
}

const GUARD_STATE_KEY = "__unsavedGuard"

function isInternalNavigationTarget(anchor: HTMLAnchorElement): boolean {
  const href = anchor.getAttribute("href")
  if (!href || href.startsWith("#")) return false
  if (anchor.hasAttribute("download")) return false
  if (anchor.target === "_blank") return false
  if (anchor.rel.includes("external")) return false
  let url: URL
  try {
    url = new URL(href, window.location.href)
  } catch {
    return false
  }
  // Cross-origin leaves are left to the beforeunload handler.
  if (url.origin !== window.location.origin) return false
  // Same-document hash jumps don't discard form state.
  if (
    url.pathname === window.location.pathname &&
    url.search === window.location.search &&
    url.hash
  )
    return false
  return true
}

/**
 * Shows the browser's default "are you sure you want to leave" prompt when
 * the user tries to leave (reload, close tab, sidebar/dashboard links, back
 * and forward buttons) with unsaved changes. Pass `false` once saved.
 *
 * Note: the app uses `BrowserRouter`, where React Router's `useBlocker` is
 * unavailable, so in-app navigation is guarded directly: anchor clicks are
 * intercepted in the capture phase, and a same-URL history entry is pushed
 * so back/forward presses land back on the form and can ask first.
 */
export function useUnsavedChangesPrompt(
  when: boolean,
  message: string = UNSAVED_CHANGES_MESSAGE
) {
  const whenRef = useRef(when)
  const messageRef = useRef(message)
  useEffect(() => {
    whenRef.current = when
    messageRef.current = message
  }, [when, message])
  // Set once the user confirms leaving via the back/forward guard so the
  // follow-up real history step isn't confirmed a second time.
  const leavingRef = useRef(false)
  // Whether our same-URL guard entry is currently on top of the stack.
  const armedRef = useRef(false)

  // Reload / tab close / cross-origin navigation: native browser dialog.
  useEffect(() => {
    if (!when) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Chrome requires returnValue to be set to trigger the dialog.
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [when])

  // Register with the module-level guard consulted by confirmNavigation().
  // Refs are used so the guard always sees the latest dirty state.
  useEffect(
    () =>
      registerNavigationGuard(() =>
        whenRef.current ? messageRef.current : false
      ),
    []
  )

  // Keep a same-URL guard entry on top of the history stack while dirty, so
  // a back press pops the guard (page visually unchanged) instead of
  // navigating away before we can ask.
  useEffect(() => {
    if (when && !armedRef.current) {
      window.history.pushState(
        { [GUARD_STATE_KEY]: true },
        "",
        window.location.href
      )
      armedRef.current = true
    }
  }, [when])

  // Intercept in-app link clicks (sidebar, brand, etc.) and back/forward.
  useEffect(() => {
    const onClickCapture = (e: MouseEvent) => {
      if (!whenRef.current || leavingRef.current) return
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null
      if (!anchor || !isInternalNavigationTarget(anchor)) return
      if (!confirmNavigation()) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const onPopState = () => {
      if (leavingRef.current) return
      if (!whenRef.current) {
        // The guard entry was consumed while clean; re-arm on next edit.
        armedRef.current = false
        return
      }
      // A back/forward press popped the guard entry; the page is unchanged.
      if (window.confirm(messageRef.current)) {
        leavingRef.current = true
        armedRef.current = false
        // Continue the original traversal (back to the previous page).
        window.history.back()
      } else {
        // Stay: put the guard entry back on top.
        window.history.pushState(
          { [GUARD_STATE_KEY]: true },
          "",
          window.location.href
        )
      }
    }

    document.addEventListener("click", onClickCapture, true)
    window.addEventListener("popstate", onPopState)
    return () => {
      document.removeEventListener("click", onClickCapture, true)
      window.removeEventListener("popstate", onPopState)
    }
  }, [])
}
