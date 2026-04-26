import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  CircleEllipsisIcon,
  MenuIcon,
  MessageCircleIcon,
  Settings2Icon,
  SquarePenIcon,
} from "lucide-react"

import { ComposePickerDialog } from "@/features/messages/components/compose-picker-dialog"
import { ConversationDetailsSheet } from "@/features/messages/components/conversation-details-sheet"
import { ConversationList } from "@/features/messages/components/conversation-list"
import { ConversationServiceBadge } from "@/features/messages/components/conversation-service-badge"
import { SettingsSheet } from "@/features/messages/components/settings-sheet"
import { ConversationThread } from "@/features/messages/components/conversation-thread"
import { MessageComposer } from "@/features/messages/components/message-composer"
import { ThreadAvatar } from "@/features/messages/components/thread-avatar"
import { useMessagesController } from "@/features/messages/hooks/use-messages-controller"
import { useMessageShortcuts } from "@/features/messages/hooks/use-message-shortcuts"

const isVisibleElement = (element: HTMLElement | null) =>
  element != null &&
  element.getClientRects().length > 0 &&
  window.getComputedStyle(element).visibility !== "hidden"

const focusTextControl = (element: HTMLInputElement | HTMLTextAreaElement | null) => {
  if (element == null || !isVisibleElement(element)) {
    return false
  }

  element.focus()
  const position = element.value.length

  if (typeof element.setSelectionRange === "function") {
    element.setSelectionRange(position, position)
  }

  if (element instanceof HTMLInputElement) {
    element.select()
  }

  return true
}

export function MessagesScreen() {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [pendingSearchFocus, setPendingSearchFocus] = useState(false)
  const mobileSidebarSettingsRef = useRef<HTMLButtonElement>(null)
  const controller = useMessagesController()
  const {
    activeConversation,
    composePicker,
    composer,
    conversation,
    onOpenCompose,
    onSetSidebarOpen,
    sidebar,
  } = controller

  const focusConversationSearch = useCallback(() => {
    const desktopSearch = document.getElementById(
      "conversation-search-desktop"
    ) as HTMLInputElement | null
    const mobileSearch = document.getElementById(
      "conversation-search-mobile"
    ) as HTMLInputElement | null

    if (focusTextControl(desktopSearch) || focusTextControl(mobileSearch)) {
      setPendingSearchFocus(false)
      return
    }

    setPendingSearchFocus(true)
    onSetSidebarOpen(true)
  }, [onSetSidebarOpen])

  const focusComposer = useCallback(() => {
    if (!activeConversation) {
      return
    }

    const draftField = document.getElementById(
      "message-draft"
    ) as HTMLTextAreaElement | null
    focusTextControl(draftField)
  }, [activeConversation])

  const handleAddAttachmentShortcut = useCallback(() => {
    if (!activeConversation) {
      return
    }

    composer.onAddAttachment()
  }, [activeConversation, composer])

  const navigateConversation = useCallback(
    (direction: "next" | "previous") => {
      if (sidebar.visibleThreads.length === 0) {
        return
      }

      const currentIndex = sidebar.visibleThreads.findIndex(
        (thread) => thread.id === sidebar.selectedThreadId
      )
      const fallbackIndex = direction === "next" ? 0 : sidebar.visibleThreads.length - 1
      const nextIndex =
        currentIndex === -1
          ? fallbackIndex
          : Math.min(
              sidebar.visibleThreads.length - 1,
              Math.max(0, currentIndex + (direction === "next" ? 1 : -1))
            )
      const nextThread = sidebar.visibleThreads[nextIndex]

      if (!nextThread || nextThread.id === sidebar.selectedThreadId) {
        return
      }

      sidebar.onSelectThread(nextThread.id)
    },
    [sidebar]
  )

  useEffect(() => {
    if (!pendingSearchFocus || !sidebar.isOpen) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      focusConversationSearch()
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [focusConversationSearch, pendingSearchFocus, sidebar.isOpen])

  useMessageShortcuts({
    blocked: composePicker.open || isDetailsOpen || isSettingsOpen,
    onAddAttachment: handleAddAttachmentShortcut,
    onFocusComposer: focusComposer,
    onFocusConversationSearch: focusConversationSearch,
    onNavigateConversation: navigateConversation,
    onOpenCompose,
  })

  return (
    <>
      <ComposePickerDialog {...composePicker} />
      <ConversationDetailsSheet
        activeConversation={activeConversation}
        headerStatus={conversation.headerStatus}
        messageCount={conversation.selectedMessages.length}
        onOpenChange={setIsDetailsOpen}
        open={isDetailsOpen}
      />
      <SettingsSheet onOpenChange={setIsSettingsOpen} open={isSettingsOpen} />

      <Sheet open={sidebar.isOpen} onOpenChange={onSetSidebarOpen}>
        <div className="h-dvh overflow-hidden bg-background text-foreground">
          <div className="mx-auto flex h-full max-w-[1560px] flex-col">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background lg:flex-row lg:bg-background/96">
              <aside className="hidden max-h-[42svh] min-h-[18rem] w-full flex-col bg-muted/45 lg:flex lg:max-h-none lg:min-h-0 lg:shrink-0 lg:basis-[22rem] lg:max-w-[22rem] xl:basis-[23.5rem] xl:max-w-[23.5rem]">
                <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
                  <h1 className="text-app-screen-title truncate font-semibold tracking-tight">
                    Messages
                  </h1>

                  <div className="flex items-center gap-1">
                    <Button
                      aria-label="Open settings"
                      onClick={() => setIsSettingsOpen(true)}
                      size="icon-sm"
                      variant="ghost"
                    >
                      <Settings2Icon />
                    </Button>

                    <Button
                      aria-label="New message"
                      onClick={onOpenCompose}
                      size="icon-sm"
                      variant="ghost"
                    >
                      <SquarePenIcon />
                    </Button>
                  </div>
                </header>

                <ConversationList
                  errorMessage={conversation.loadError}
                  isLoading={sidebar.isLoading}
                  onSearchChange={sidebar.onSearchChange}
                  onSelectThread={sidebar.onSelectThread}
                  search={sidebar.search}
                  searchInputId="conversation-search-desktop"
                  selectedThreadId={sidebar.selectedThreadId}
                  visibleThreads={sidebar.visibleThreads}
                />
              </aside>

              <Separator className="hidden lg:block" orientation="vertical" />

              <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background lg:bg-background/90">
                <header className="sticky top-0 z-20 shrink-0 bg-background/96 px-3 py-3 backdrop-blur-sm sm:px-5 lg:static lg:bg-transparent lg:px-5 lg:py-3 lg:backdrop-blur-0">
                  <div className="flex items-center justify-between gap-2 sm:gap-3">
                    <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                      <SheetTrigger asChild>
                        <Button
                          aria-label="Open conversations"
                          className="lg:hidden"
                          size="icon-sm"
                          variant="ghost"
                        >
                          <MenuIcon />
                        </Button>
                      </SheetTrigger>

                      {activeConversation ? (
                        <button
                          aria-label="Open conversation details"
                          className="flex min-w-0 items-center gap-2.5 rounded-xl px-1 py-1 text-left transition-colors hover:bg-muted/55 sm:gap-3"
                          onClick={() => setIsDetailsOpen(true)}
                          type="button"
                        >
                          <ThreadAvatar
                            active
                            contacts={activeConversation.avatarContacts}
                            overflowCount={activeConversation.avatarOverflowCount}
                            size="lg"
                            title={activeConversation.title}
                          />

                          <div className="min-w-0">
                            <h2 className="text-app-header-title truncate font-semibold tracking-tight">
                              {activeConversation.title}
                            </h2>

                            <div className="flex min-w-0 flex-wrap items-center gap-1.5 pt-0.5">
                              {activeConversation.kind === "thread" ? (
                                <ConversationServiceBadge
                                  className="shrink-0"
                                  service={activeConversation.service}
                                />
                              ) : null}

                              <p className="text-app-header-meta min-w-0 truncate text-muted-foreground">
                                {activeConversation.subtitle &&
                                conversation.headerStatus !== "No conversation selected"
                                  ? `${activeConversation.subtitle} · ${conversation.headerStatus}`
                                  : conversation.headerStatus}
                              </p>
                            </div>
                          </div>
                        </button>
                      ) : (
                        <>
                          <div className="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                            <MessageCircleIcon />
                          </div>
                          <div className="min-w-0">
                            <h2 className="text-app-header-title truncate font-semibold tracking-tight">
                              Messages
                            </h2>

                            <p className="text-app-header-meta truncate pt-0.5 text-muted-foreground">
                              {conversation.headerStatus}
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {activeConversation ? (
                        <Button
                          aria-label="Conversation details"
                          onClick={() => setIsDetailsOpen(true)}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <CircleEllipsisIcon />
                        </Button>
                      ) : null}

                      <Button
                        aria-label="New message"
                        className="lg:hidden"
                        onClick={onOpenCompose}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <SquarePenIcon />
                      </Button>
                    </div>
                  </div>
                </header>

                <Separator />

                <ConversationThread
                  activeConversation={activeConversation}
                  isLoadingChats={conversation.isLoadingChats}
                  isLoadingSelectedMessages={
                    conversation.isLoadingSelectedMessages
                  }
                  loadError={conversation.loadError}
                  onRetryMessage={conversation.onRetryMessage}
                  scrollRef={conversation.scrollRef}
                  selectedMessages={conversation.selectedMessages}
                />

                <Separator />

                <MessageComposer
                  activeConversation={activeConversation}
                  composerAttachments={composer.attachments}
                  draft={composer.draft}
                  fileInputRef={composer.fileInputRef}
                  isDragActive={composer.isDragActive}
                  isSending={composer.isSending}
                  onAddAttachment={composer.onAddAttachment}
                  onDragEnter={composer.onDragEnter}
                  onDragLeave={composer.onDragLeave}
                  onDragOver={composer.onDragOver}
                  onDraftChange={composer.onDraftChange}
                  onFileChange={composer.onFileChange}
                  onPaste={composer.onPaste}
                  onDrop={composer.onDrop}
                  onRemoveAttachment={composer.onRemoveAttachment}
                  onSend={composer.onSend}
                  sendError={composer.sendError}
                />
              </section>
            </div>

              <SheetContent
                side="left"
                className="w-[88vw] max-w-[360px] bg-background p-0 sm:bg-muted/55"
                onOpenAutoFocus={(event) => {
                  event.preventDefault()
                  window.requestAnimationFrame(() => {
                    mobileSidebarSettingsRef.current?.focus()
                  })
                }}
              >
                <SheetHeader className="border-b px-4 pt-4 pb-3">
                  <div className="flex items-center justify-between gap-3 pr-12">
                    <div className="min-w-0">
                      <SheetTitle className="text-[18px] font-semibold tracking-tight">
                        Messages
                      </SheetTitle>
                      <SheetDescription className="sr-only">
                        Browse and search conversations.
                      </SheetDescription>
                    </div>

                    <Button
                      aria-label="Open settings"
                      onClick={() => {
                        onSetSidebarOpen(false)
                        setIsSettingsOpen(true)
                      }}
                      ref={mobileSidebarSettingsRef}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Settings2Icon />
                    </Button>
                  </div>
                </SheetHeader>

              <ConversationList
                errorMessage={conversation.loadError}
                isLoading={sidebar.isLoading}
                onSearchChange={sidebar.onSearchChange}
                onSelectThread={sidebar.onSelectThread}
                search={sidebar.search}
                searchInputId="conversation-search-mobile"
                selectedThreadId={sidebar.selectedThreadId}
                visibleThreads={sidebar.visibleThreads}
              />
            </SheetContent>
          </div>
        </div>
      </Sheet>
    </>
  )
}
