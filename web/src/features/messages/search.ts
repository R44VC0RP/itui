import type { ComposeOption, ThreadSummary } from "@/features/messages/types"
import { handlesMatch, normalizeHandle } from "@/features/messages/utils"

const normalizeQuery = (value: string) => value.trim().toLowerCase()

const includesNormalized = (value: string, query: string) =>
  value.toLowerCase().includes(query)

const startsWithWord = (value: string, query: string) =>
  value
    .toLowerCase()
    .split(/[\s,.:;()[\]{}<>/_-]+/)
    .some((segment) => segment.startsWith(query))

const tokenizedQuery = (query: string) =>
  normalizeQuery(query)
    .split(/\s+/)
    .filter(Boolean)

const rankText = (value: string, query: string) => {
  const normalized = value.trim().toLowerCase()

  if (!normalized) {
    return 0
  }

  if (normalized === query) {
    return 140
  }

  if (normalized.startsWith(query)) {
    return 96
  }

  if (startsWithWord(normalized, query)) {
    return 72
  }

  if (normalized.includes(query)) {
    return 40
  }

  return 0
}

const baseThreadSearchScore = (thread: ThreadSummary, query: string) => {
  let score = 0
  const normalizedHandle = normalizeHandle(query)

  if (normalizedHandle) {
    if (handlesMatch(thread.primaryHandle, query)) {
      score += 220
    }

    if (thread.participantHandles.some((candidate) => handlesMatch(candidate, query))) {
      score += 180
    }

    if (handlesMatch(thread.identifier, query)) {
      score += 140
    }
  }

  score += rankText(thread.title, query) * 2
  score += rankText(thread.subtitle, query)
  score += rankText(thread.preview, query) * 0.75

  if (includesNormalized(thread.searchText, query)) {
    score += 18
  }

  score += Math.min(thread.unreadCount, 3) * 2

  return score
}

export const rankThreads = (threads: ThreadSummary[], rawQuery: string) => {
  const query = normalizeQuery(rawQuery)

  if (!query) {
    return threads
  }

  const tokens = tokenizedQuery(query)

  return threads
    .map((thread) => {
      if (!tokens.every((token) => includesNormalized(thread.searchText, token))) {
        return null
      }

      const score = tokens.reduce(
        (current, token) => current + baseThreadSearchScore(thread, token),
        0
      )

      return {
        score,
        thread,
      }
    })
    .filter((entry): entry is { score: number; thread: ThreadSummary } => entry != null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return (
        new Date(right.thread.lastActivity).getTime() -
        new Date(left.thread.lastActivity).getTime()
      )
    })
    .map((entry) => entry.thread)
}

const composeOptionSearchText = (option: ComposeOption) =>
  [
    option.title,
    option.subtitle,
    option.handle,
    option.contact?.name ?? "",
    ...option.participantContacts.flatMap((contact) => [contact.name ?? "", contact.handle]),
  ]
    .join(" ")
    .toLowerCase()

const composeOptionScore = (option: ComposeOption, query: string) => {
  let score = 0

  if (handlesMatch(option.handle, query)) {
    score += 200
  }

  score += rankText(option.title, query) * 2
  score += rankText(option.subtitle, query)
  score += rankText(option.handle, query) * 1.25

  if (option.isExistingThread) {
    score += 8
  }

  return score
}

export const rankComposeOptions = (
  options: ComposeOption[],
  rawQuery: string
) => {
  const query = normalizeQuery(rawQuery)

  if (!query) {
    return options
  }

  const tokens = tokenizedQuery(query)

  return options
    .map((option) => {
      const searchText = composeOptionSearchText(option)

      if (!tokens.every((token) => includesNormalized(searchText, token))) {
        return null
      }

      return {
        option,
        score: tokens.reduce(
          (current, token) => current + composeOptionScore(option, token),
          0
        ),
      }
    })
    .filter((entry): entry is { option: ComposeOption; score: number } => entry != null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return left.option.title.localeCompare(right.option.title)
    })
    .map((entry) => entry.option)
}

export const conversationSecondaryText = (
  thread: ThreadSummary,
  rawQuery: string
) => {
  const query = normalizeQuery(rawQuery)

  if (!query) {
    return thread.preview
  }

  const matchedSubtitle =
    rankText(thread.subtitle, query) > 0 ||
    thread.participantHandles.some((handle) => handlesMatch(handle, query))

  if (matchedSubtitle) {
    return thread.subtitle
  }

  return thread.preview
}
