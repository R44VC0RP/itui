import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { ArrowUpIcon, PlusIcon } from "lucide-react"
import type {
  ChangeEvent,
  ClipboardEvent,
  DragEvent,
  KeyboardEvent,
  RefObject,
} from "react"

import { ComposerAttachmentTray } from "@/features/messages/components/composer-attachment-tray"
import type {
  ActiveConversation,
  ComposerAttachment,
} from "@/features/messages/types"
import { composerPlaceholder } from "@/features/messages/utils"
import { cn } from "@/lib/utils"

export function MessageComposer({
  activeConversation,
  composerAttachments,
  draft,
  fileInputRef,
  isDragActive,
  isSending,
  onAddAttachment,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDraftChange,
  onFileChange,
  onPaste,
  onDrop,
  onRemoveAttachment,
  onSend,
  sendError,
  sendStatusMessage,
}: {
  activeConversation: ActiveConversation | null
  composerAttachments: ComposerAttachment[]
  draft: string
  fileInputRef: RefObject<HTMLInputElement | null>
  isDragActive: boolean
  isSending: boolean
  onAddAttachment: () => void
  onDragEnter: (event: DragEvent<HTMLFormElement>) => void
  onDragLeave: (event: DragEvent<HTMLFormElement>) => void
  onDragOver: (event: DragEvent<HTMLFormElement>) => void
  onDraftChange: (value: string) => void
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void
  onDrop: (event: DragEvent<HTMLFormElement>) => void
  onRemoveAttachment: (attachmentId: string) => void
  onSend: () => void | Promise<void>
  sendError?: string | null
  sendStatusMessage?: string | null
}) {
  const focusDraftField = (form: HTMLFormElement | null) => {
    requestAnimationFrame(() => {
      const draftField = form?.querySelector<HTMLTextAreaElement>(
        'textarea[name="message-draft"]'
      )

      if (!draftField) {
        return
      }

      draftField.focus()
      const position = draftField.value.length
      draftField.setSelectionRange(position, position)
    })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void onSend()
      focusDraftField(event.currentTarget.form)
    }
  }

  return (
    <form
      className="bg-background/95 px-4 py-4 sm:px-5"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onSubmit={(event) => {
        event.preventDefault()
        void onSend()
        focusDraftField(event.currentTarget)
      }}
    >
      <div className="flex flex-col gap-2">
        {sendError ? (
          <p className="px-1 text-sm text-destructive">{sendError}</p>
        ) : sendStatusMessage ? (
          <p className="px-1 text-sm text-muted-foreground">
            {sendStatusMessage}
          </p>
        ) : null}

        <input
          className="sr-only"
          multiple
          onChange={onFileChange}
          ref={fileInputRef}
          tabIndex={-1}
          type="file"
        />

        <ComposerAttachmentTray
          attachments={composerAttachments}
          disabled={isSending}
          onRemove={onRemoveAttachment}
        />

        <InputGroup
          className={cn(
            "h-auto rounded-[1.8rem] bg-muted/72 px-1.5 transition-colors",
            isDragActive &&
              "border border-dashed border-primary/45 bg-primary/6 shadow-[0_0_0_1px_hsl(var(--primary)/0.08)]"
          )}
        >
          <InputGroupAddon align="inline-start" className="pb-2.5">
            <InputGroupButton
              aria-label="Add attachments"
              disabled={!activeConversation || isSending}
              onClick={onAddAttachment}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <PlusIcon />
            </InputGroupButton>
          </InputGroupAddon>

          <InputGroupTextarea
            className="max-h-36 min-h-12 px-1 leading-6"
            disabled={!activeConversation}
            id="message-draft"
            name="message-draft"
            onChange={(event) => onDraftChange(event.currentTarget.value)}
            onKeyDown={handleKeyDown}
            onPaste={onPaste}
            placeholder={
              activeConversation
                ? composerPlaceholder(activeConversation.service)
                : "Message"
            }
            value={draft}
          />

          <InputGroupAddon align="inline-end" className="pb-2.5">
            <InputGroupButton
              aria-label="Send"
              disabled={
                (!draft.trim() && composerAttachments.length === 0) ||
                isSending ||
                !activeConversation
              }
              size="icon-sm"
              type="submit"
              variant={
                draft.trim() || composerAttachments.length > 0
                  ? "default"
                  : "ghost"
              }
            >
              {isSending ? <Spinner /> : <ArrowUpIcon />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </form>
  )
}
