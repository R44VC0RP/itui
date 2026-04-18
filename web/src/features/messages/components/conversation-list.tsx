import { Badge } from "@/components/ui/badge"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { MessageCircleIcon, SearchIcon } from "lucide-react"

import { ThreadAvatar } from "@/features/messages/components/thread-avatar"
import { conversationSecondaryText } from "@/features/messages/search"
import type { ThreadSummary } from "@/features/messages/types"
import { formatThreadTime } from "@/features/messages/utils"
import { cn } from "@/lib/utils"

export function ConversationList({
  errorMessage,
  isLoading,
  onSearchChange,
  onSelectThread,
  search,
  searchInputId,
  selectedThreadId,
  visibleThreads,
}: {
  errorMessage?: string | null
  isLoading: boolean
  onSearchChange: (value: string) => void
  onSelectThread: (threadId: number) => void
  search: string
  searchInputId: string
  selectedThreadId: number | null
  visibleThreads: ThreadSummary[]
}) {
  const hasSearch = search.trim().length > 0

  return (
    <>
      <div className="px-4 pb-3">
        <InputGroup className="bg-background/92">
          <InputGroupAddon align="inline-start">
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search conversations"
            id={searchInputId}
            name={searchInputId}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            placeholder="Search"
            value={search}
          />
        </InputGroup>
      </div>

      <Separator />

      <ScrollArea className="min-h-0 flex-1">
        {isLoading ? (
          <div className="flex min-h-[16rem] flex-col items-center justify-center gap-3 px-6 text-center">
            <Spinner className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Loading conversations
            </p>
          </div>
        ) : errorMessage && visibleThreads.length === 0 ? (
          <div className="flex min-h-[16rem] flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <MessageCircleIcon />
            </div>
            <div className="flex max-w-xs flex-col gap-1">
              <p className="text-sm font-medium">Can’t load conversations</p>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
            </div>
          </div>
        ) : visibleThreads.length === 0 ? (
          <div className="flex min-h-[16rem] flex-col items-center justify-center gap-2 px-6 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <MessageCircleIcon />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">
                {hasSearch ? "No conversations found" : "No conversations yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {hasSearch
                  ? "Try a different name or phrase."
                  : "Messages will appear here once the server has chat data."}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1 px-2 py-2">
            {visibleThreads.map((thread) => {
              const isSelected = thread.id === selectedThreadId
              const secondaryText = conversationSecondaryText(thread, search)

              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => onSelectThread(thread.id)}
                  className={cn(
                    "grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-3 overflow-hidden rounded-lg px-3 py-3 text-left transition-[background-color,box-shadow,color]",
                    isSelected
                      ? "bg-background/95 shadow-sm ring-1 ring-border/70"
                      : "hover:bg-background/85"
                  )}
                >
                  <ThreadAvatar
                    active={isSelected}
                    contacts={thread.avatarContacts}
                    overflowCount={thread.avatarOverflowCount}
                    title={thread.title}
                  />

                  <div className="grid min-w-0 gap-0.75 overflow-hidden pr-1">
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 overflow-hidden">
                      <p className="min-w-0 truncate text-[15px] font-medium tracking-tight text-foreground">
                        {thread.title}
                      </p>

                      <span className="shrink-0 text-[11px] text-muted-foreground max-[1180px]:hidden">
                        {formatThreadTime(thread.lastActivity)}
                      </span>
                    </div>

                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 overflow-hidden">
                      <p
                        className={cn(
                          "[display:-webkit-box] min-w-0 overflow-hidden text-[13px] leading-5 break-words [-webkit-box-orient:vertical] [-webkit-line-clamp:2]",
                          isSelected
                            ? "text-foreground/80"
                            : "text-muted-foreground"
                        )}
                      >
                        {secondaryText}
                      </p>

                      {thread.unreadCount > 0 ? (
                        <Badge className="min-w-5 justify-center px-1.5 text-[10px]">
                          {thread.unreadCount > 99 ? "99+" : thread.unreadCount}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </>
  )
}
