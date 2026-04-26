import { useEffect } from "react"

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  const closestEditable = target.closest(
    'input, textarea, select, [contenteditable="true"]'
  )

  return closestEditable != null
}

export function useMessageShortcuts({
  blocked,
  onAddAttachment,
  onFocusComposer,
  onFocusConversationSearch,
  onNavigateConversation,
  onOpenCompose,
}: {
  blocked: boolean
  onAddAttachment: () => void
  onFocusComposer: () => void
  onFocusConversationSearch: () => void
  onNavigateConversation: (direction: "next" | "previous") => void
  onOpenCompose: () => void
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        blocked ||
        event.defaultPrevented ||
        event.isComposing ||
        event.keyCode === 229 ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableTarget(event.target)
      ) {
        return
      }

      switch (event.key.toLowerCase()) {
        case "/":
          event.preventDefault()
          onFocusConversationSearch()
          return
        case "c":
          event.preventDefault()
          onOpenCompose()
          return
        case "r":
          event.preventDefault()
          onFocusComposer()
          return
        case "u":
          event.preventDefault()
          onAddAttachment()
          return
        case "j":
          event.preventDefault()
          onNavigateConversation("next")
          return
        case "k":
          event.preventDefault()
          onNavigateConversation("previous")
          return
        default:
          return
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [
    blocked,
    onAddAttachment,
    onFocusComposer,
    onFocusConversationSearch,
    onNavigateConversation,
    onOpenCompose,
  ])
}
