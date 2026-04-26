import type { ComposeOption } from "@/features/messages/types"
import { normalizeHandle } from "@/features/messages/utils"

export const dedupeComposeOptionsByHandle = (options: ComposeOption[]) => {
  const seenHandles = new Set<string>()

  return options.filter((option) => {
    const handleKey = normalizeHandle(option.handle) || option.key

    if (seenHandles.has(handleKey)) {
      return false
    }

    seenHandles.add(handleKey)
    return true
  })
}
