import { useState } from "react"

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
  SquarePenIcon,
} from "lucide-react"

import { ComposePickerDialog } from "@/features/messages/components/compose-picker-dialog"
import { ConversationDetailsSheet } from "@/features/messages/components/conversation-details-sheet"
import { ConversationList } from "@/features/messages/components/conversation-list"
import { ConversationThread } from "@/features/messages/components/conversation-thread"
import { MessageComposer } from "@/features/messages/components/message-composer"
import { ThreadAvatar } from "@/features/messages/components/thread-avatar"
import { useMessagesController } from "@/features/messages/hooks/use-messages-controller"

export function MessagesScreen() {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
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

      <Sheet open={sidebar.isOpen} onOpenChange={onSetSidebarOpen}>
        <div className="min-h-dvh bg-background text-foreground">
          <div className="mx-auto flex min-h-dvh max-w-[1560px] flex-col lg:h-dvh">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background lg:flex-row lg:bg-background/96">
              <aside className="hidden max-h-[42svh] min-h-[18rem] w-full flex-col bg-muted/45 lg:flex lg:max-h-none lg:min-h-0 lg:shrink-0 lg:basis-[22rem] lg:max-w-[22rem] xl:basis-[23.5rem] xl:max-w-[23.5rem]">
                <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
                  <h1 className="truncate text-[18px] font-semibold tracking-tight">
                    Messages
                  </h1>

                  <Button
                    aria-label="New message"
                    onClick={onOpenCompose}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <SquarePenIcon />
                  </Button>
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

              <section className="flex min-w-0 flex-1 flex-col bg-background lg:bg-background/90">
                <header className="px-3 py-3 sm:px-5">
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
                            <h2 className="truncate text-[17px] font-semibold tracking-tight">
                              {activeConversation.title}
                            </h2>

                            <p className="truncate pt-0.5 text-xs text-muted-foreground">
                              {activeConversation.subtitle &&
                              conversation.headerStatus !== "No conversation selected"
                                ? `${activeConversation.subtitle} · ${conversation.headerStatus}`
                                : conversation.headerStatus}
                            </p>
                          </div>
                        </button>
                      ) : (
                        <>
                          <div className="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                            <MessageCircleIcon />
                          </div>
                          <div className="min-w-0">
                            <h2 className="truncate text-[17px] font-semibold tracking-tight">
                              Messages
                            </h2>

                            <p className="truncate pt-0.5 text-xs text-muted-foreground">
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
                  sendStatusMessage={composer.sendStatusMessage}
                />
              </section>
            </div>

            <SheetContent
              side="left"
              className="w-[88vw] max-w-[360px] bg-background p-0 sm:bg-muted/55"
            >
              <SheetHeader className="border-b px-4 pt-4 pb-3">
                <SheetTitle className="text-[18px] font-semibold tracking-tight">
                  Messages
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Browse and search conversations.
                </SheetDescription>
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
