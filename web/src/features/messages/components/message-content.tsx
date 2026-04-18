import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import {
  CopyIcon,
  DownloadIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  FileIcon,
  FilmIcon,
  ImageIcon,
  PaperclipIcon,
  RefreshCcwIcon,
  UserRoundIcon,
  Volume2Icon,
} from "lucide-react"

import type {
  Attachment as ImsgAttachment,
  Reaction as ImsgReaction,
} from "@/lib/imsg"
import type {
  ComposerAttachment,
  ConversationMessage,
  ThreadService,
} from "@/features/messages/types"
import { copyPlainText } from "@/lib/clipboard"
import {
  attachmentDetail,
  attachmentCanRenderInlineVideo,
  attachmentDisplayHref,
  attachmentDownloadHref,
  attachmentKind,
  attachmentPreviewHref,
  attachmentTitle,
  firstMessageURL,
  groupedReactions,
  isURLBalloonMessage,
  messageAttachmentFromComposerAttachment,
  messageSummary,
  outgoingBubbleClass,
} from "@/features/messages/utils"
import { cn } from "@/lib/utils"

const textUrlPattern = /(https?:\/\/[^\s<>()]+)/gi

function AttachmentIcon({ attachment }: { attachment: ImsgAttachment }) {
  const kind = attachmentKind(attachment)

  if (kind === "image") {
    return <ImageIcon data-icon="inline-start" />
  }

  if (kind === "video") {
    return <FilmIcon data-icon="inline-start" />
  }

  if (kind === "audio") {
    return <Volume2Icon data-icon="inline-start" />
  }

  if (attachment.is_sticker) {
    return <PaperclipIcon data-icon="inline-start" />
  }

  return <FileIcon data-icon="inline-start" />
}

function AttachmentStatusBadge({
  message,
}: {
  message: ConversationMessage
}) {
  if (!message.clientId || !message.deliveryState) {
    return null
  }

  return (
    <Badge
      className="gap-1.5 bg-background/92 shadow-sm backdrop-blur-sm"
      variant={message.deliveryState === "failed" ? "destructive" : "secondary"}
    >
      {message.deliveryState === "sending" ? (
        <Spinner className="size-3" />
      ) : null}
      <span>{message.deliveryState === "failed" ? "Failed" : "Sending"}</span>
    </Badge>
  )
}

function MessageAttachments({
  message,
}: {
  message: ConversationMessage
}) {
  const [activeImage, setActiveImage] = useState<ImsgAttachment | null>(null)

  if (isURLBalloonMessage(message)) {
    return null
  }
  const imageAttachments = message.attachments.filter(
    (attachment) => attachmentKind(attachment) === "image" && !attachment.missing
  )
  const inlineVideoAttachments = message.attachments.filter(
    (attachment) =>
      attachmentKind(attachment) === "video" &&
      attachmentCanRenderInlineVideo(attachment) &&
      !attachment.missing
  )
  const audioAttachments = message.attachments.filter(
    (attachment) => attachmentKind(attachment) === "audio" && !attachment.missing
  )
  const fileAttachments = message.attachments.filter((attachment) => {
    const kind = attachmentKind(attachment)
    return (
      attachment.missing ||
      (kind === "video"
        ? !attachmentCanRenderInlineVideo(attachment)
        : kind !== "image" && kind !== "audio")
    )
  })

  if (message.attachments.length === 0) {
    return null
  }

  return (
    <>
      <div className="flex w-full max-w-[min(23rem,calc(100vw-5.75rem))] flex-col gap-2 sm:max-w-[23rem]">
        {imageAttachments.length > 0 ? (
          <div
            className={cn(
              "grid gap-2",
              imageAttachments.length === 1 ? "grid-cols-1" : "grid-cols-2"
            )}
          >
            {imageAttachments.map((attachment) => {
              const href = attachmentDisplayHref(attachment)

              if (!href) {
                return null
              }

              return (
                <button
                  className="group relative overflow-hidden rounded-[1.55rem] border border-border/70 bg-secondary text-left transition-transform active:scale-[0.99]"
                  key={attachment.id}
                  onClick={() => setActiveImage(attachment)}
                  type="button"
                >
                  <img
                    alt={attachmentTitle(attachment)}
                    className="block max-h-[22rem] w-full object-cover transition-transform duration-300 group-hover:scale-[1.015]"
                    loading="lazy"
                    src={href}
                  />

                  {message.clientId ? (
                    <div className="pointer-events-none absolute inset-x-2 top-2 flex justify-start">
                      <AttachmentStatusBadge message={message} />
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
        ) : null}

        {inlineVideoAttachments.map((attachment) => {
          const href = attachmentDownloadHref(attachment)

          if (!href) {
            return null
          }

          return (
            <div
              className="relative overflow-hidden rounded-[1.55rem] border border-border/70 bg-secondary"
              key={attachment.id}
            >
              <video
                className="block max-h-[22rem] w-full bg-black object-contain"
                controls
                preload="metadata"
              >
                <source src={href} type={attachment.mime_type} />
              </video>

              {message.clientId ? (
                <div className="pointer-events-none absolute inset-x-2 top-2 flex justify-start">
                  <AttachmentStatusBadge message={message} />
                </div>
              ) : null}
            </div>
          )
        })}

        {audioAttachments.map((attachment) => {
          const href = attachmentDownloadHref(attachment)

          if (!href) {
            return null
          }

          return (
            <div
              className="rounded-[1.45rem] border border-border/70 bg-secondary px-3 py-3"
              key={attachment.id}
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-background text-muted-foreground">
                  <Volume2Icon />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-app-supporting truncate font-medium">
                    {attachmentTitle(attachment)}
                  </p>
                  <p className="text-app-meta truncate text-muted-foreground">
                    {attachmentDetail(attachment) || "Audio attachment"}
                  </p>
                </div>
                {message.clientId ? <AttachmentStatusBadge message={message} /> : null}
              </div>

              <audio className="mt-3 w-full" controls preload="metadata">
                <source src={href} type={attachment.mime_type} />
              </audio>
            </div>
          )
        })}

        {fileAttachments.length > 0 ? (
          <div className="flex flex-col gap-2">
            {fileAttachments.map((attachment) => {
              const href = attachmentDownloadHref(attachment)
              const previewHref = attachmentPreviewHref(attachment)
              const isPosterVideo =
                attachment.mime_type.startsWith("video/") &&
                !attachmentCanRenderInlineVideo(attachment)

              if (!href || attachment.missing) {
                return (
                  <div
                    className="flex items-center gap-3 rounded-[1.4rem] border border-border bg-muted px-3 py-2.5"
                    key={attachment.id}
                  >
                    <div className="flex size-8 items-center justify-center rounded-full bg-background text-muted-foreground">
                      <AttachmentIcon attachment={attachment} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-app-supporting truncate font-medium">
                        {attachmentTitle(attachment)}
                      </p>
                      <p className="text-app-meta truncate text-muted-foreground">
                        {attachmentDetail(attachment) || "Unavailable"}
                      </p>
                    </div>
                    {message.clientId ? <AttachmentStatusBadge message={message} /> : null}
                  </div>
                )
              }

              if (isPosterVideo) {
                return (
                  <div
                    className="overflow-hidden rounded-[1.4rem] border border-border/70 bg-secondary"
                    key={attachment.id}
                  >
                    {previewHref ? (
                      <img
                        alt={attachmentTitle(attachment)}
                        className="block max-h-[16rem] w-full object-cover"
                        loading="lazy"
                        src={previewHref}
                      />
                    ) : (
                      <div className="flex min-h-32 items-center justify-center bg-muted text-muted-foreground">
                        <FilmIcon />
                      </div>
                    )}

                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="flex size-9 items-center justify-center rounded-full bg-background text-muted-foreground">
                        <FilmIcon />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-app-supporting truncate font-medium">
                          {attachmentTitle(attachment)}
                        </p>
                        <p className="text-app-meta truncate text-muted-foreground">
                          {attachmentDetail(attachment) || "Video attachment"}
                        </p>
                      </div>

                      {message.clientId ? (
                        <AttachmentStatusBadge message={message} />
                      ) : (
                        <div className="flex items-center gap-1">
                          <Button
                            onClick={() => openAttachment(href)}
                            size="sm"
                            type="button"
                            variant="secondary"
                          >
                            <ExternalLinkIcon />
                            Open
                          </Button>
                          <Button
                            aria-label={`Download ${attachmentTitle(attachment)}`}
                            onClick={() =>
                              downloadAttachment(href, attachmentTitle(attachment))
                            }
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                          >
                            <DownloadIcon />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              }

              return (
                <Button
                  asChild
                  className="h-auto w-full justify-start rounded-[1.4rem] border-border/70 px-3 py-2.5"
                  key={attachment.id}
                  size="sm"
                  variant="outline"
                >
                  <a download href={href} rel="noreferrer" target="_blank">
                    <AttachmentIcon attachment={attachment} />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="text-app-supporting block truncate font-medium">
                        {attachmentTitle(attachment)}
                      </span>
                      <span className="text-app-meta block truncate text-muted-foreground">
                        {attachmentDetail(attachment)}
                      </span>
                    </span>
                    {message.clientId ? (
                      <AttachmentStatusBadge message={message} />
                    ) : (
                      <DownloadIcon data-icon="inline-end" />
                    )}
                  </a>
                </Button>
              )
            })}
          </div>
        ) : null}
      </div>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setActiveImage(null)
          }
        }}
        open={activeImage != null}
      >
        <DialogContent className="max-w-5xl border-border/80 bg-background/98 p-3 sm:p-5">
          <DialogHeader className="sr-only">
            <DialogTitle>
              {activeImage ? attachmentTitle(activeImage) : "Image attachment"}
            </DialogTitle>
          </DialogHeader>

          {activeImage ? (
            <img
              alt={attachmentTitle(activeImage)}
              className="mx-auto max-h-[82vh] w-auto rounded-[1.35rem] object-contain"
              src={attachmentDisplayHref(activeImage)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

function MessageReactionRail({
  reactions,
}: {
  reactions: ImsgReaction[]
}) {
  const groups = groupedReactions(reactions)

  if (groups.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-1 px-1">
      {groups.map((group) => (
        <Badge
          className="h-6 gap-1.5 px-2.5"
          key={`${group.emoji}-${group.label}`}
          title={group.label}
          variant={group.isFromMe ? "secondary" : "outline"}
        >
          <span>{group.emoji}</span>
          {group.count > 1 ? <span>{group.count}</span> : null}
        </Badge>
      ))}
    </div>
  )
}

function openAttachment(href: string) {
  window.open(href, "_blank", "noopener,noreferrer")
}

function LinkifiedMessageText({
  className,
  text,
}: {
  className?: string
  text: string
}) {
  const parts = text.split(textUrlPattern)

  return (
    <span className={cn("break-words [overflow-wrap:anywhere]", className)}>
      {parts.map((part, index) => {
        if (!part) {
          return null
        }

        if (!/^https?:\/\//i.test(part)) {
          return <span key={`${part}-${index}`}>{part}</span>
        }

        return (
          <a
            className="break-all font-medium underline decoration-white/45 underline-offset-3 transition-colors [overflow-wrap:anywhere] hover:decoration-current"
            href={part}
            key={`${part}-${index}`}
            rel="noreferrer"
            target="_blank"
          >
            {part}
          </a>
        )
      })}
    </span>
  )
}

function downloadAttachment(href: string, filename?: string) {
  const anchor = document.createElement("a")
  anchor.href = href
  anchor.target = "_blank"
  anchor.rel = "noreferrer"

  if (filename) {
    anchor.download = filename
  }

  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
}

function MessageActionsMenu({
  message,
  onRetryMessage,
}: {
  message: ConversationMessage
  onRetryMessage: (message: ConversationMessage) => void | Promise<void>
}) {
  const actionableAttachment =
    !isURLBalloonMessage(message) && message.attachments.length === 1
      ? message.attachments[0]
      : null
  const actionableHref = actionableAttachment
    ? attachmentDownloadHref(actionableAttachment)
    : undefined
  const actionableURL = firstMessageURL(message)
  const hasFailedSend = message.clientId && message.deliveryState === "failed"
  const hasText = message.text.trim().length > 0

  if (!hasText && !actionableHref && !actionableURL && !hasFailedSend && message.is_from_me) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Message actions"
          className="shrink-0 self-start opacity-70 transition-opacity sm:opacity-0 sm:group-hover/message:opacity-100 sm:focus-within:opacity-100"
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <EllipsisIcon />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={message.is_from_me ? "end" : "start"}
        className="w-56"
      >
        {hasText ? (
          <DropdownMenuItem
            onSelect={() => {
              void copyPlainText(message.text)
            }}
          >
            <CopyIcon />
            Copy text
          </DropdownMenuItem>
        ) : null}

        {!message.is_from_me ? (
          <DropdownMenuItem
            onSelect={() => {
              void copyPlainText(message.sender)
            }}
          >
            <UserRoundIcon />
            Copy sender
          </DropdownMenuItem>
        ) : null}

        {actionableHref || actionableURL ? (
          <>
            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={() => {
                openAttachment(actionableHref ?? actionableURL!)
              }}
            >
              <ExternalLinkIcon />
              {actionableHref ? "Open attachment" : "Open link"}
            </DropdownMenuItem>

            {actionableHref ? (
              <DropdownMenuItem
                onSelect={() => {
                  downloadAttachment(
                    actionableHref,
                    attachmentTitle(actionableAttachment!)
                  )
                }}
              >
                <DownloadIcon />
                Download attachment
              </DropdownMenuItem>
            ) : null}
          </>
        ) : null}

        {hasFailedSend ? (
          <>
            <DropdownMenuSeparator />

            <DropdownMenuItem onSelect={() => void onRetryMessage(message)}>
              <RefreshCcwIcon />
              Retry send
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MessageDeliveryState({
  message,
  onRetryMessage,
}: {
  message: ConversationMessage
  onRetryMessage: (message: ConversationMessage) => void | Promise<void>
}) {
  if (!message.is_from_me || !message.clientId || !message.deliveryState) {
    return null
  }

  if (message.deliveryState === "sending") {
    return null
  }

  return (
    <div className="text-app-meta flex flex-wrap items-center gap-2 px-1 text-destructive">
      <span>{message.deliveryError || "Not delivered"}</span>
      <Button
        className="text-app-meta h-auto px-0 font-medium text-current"
        onClick={() => void onRetryMessage(message)}
        size="sm"
        type="button"
        variant="link"
      >
        <RefreshCcwIcon className="mr-1 size-3.5" />
        Retry
      </Button>
    </div>
  )
}

export function MessageContent({
  message,
  onRetryMessage,
  service,
}: {
  message: ConversationMessage
  onRetryMessage: (message: ConversationMessage) => void | Promise<void>
  service: ThreadService
}) {
  const text = message.text.trim()
  const showBubble =
    text.length > 0 || message.attachments.length === 0 || isURLBalloonMessage(message)

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5",
        message.is_from_me ? "items-end" : "items-start"
      )}
    >
      <div
        className={cn(
          "group/message flex max-w-full items-start gap-0.5 sm:gap-1",
          message.is_from_me ? "flex-row-reverse" : "flex-row"
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-1.5",
            message.is_from_me ? "items-end" : "items-start"
          )}
        >
          <MessageAttachments message={message} />

          {showBubble ? (
            <div
              className={cn(
                "text-app-message w-fit max-w-full rounded-[1.35rem] px-4 py-2.5 whitespace-pre-wrap [overflow-wrap:anywhere] shadow-[0_1px_0_hsl(var(--foreground)/0.02)]",
                message.is_from_me
                  ? outgoingBubbleClass(service)
                  : "bg-secondary text-foreground"
              )}
            >
              {text ? (
                <LinkifiedMessageText text={text} />
              ) : (
                messageSummary(message)
              )}
            </div>
          ) : null}
        </div>

        <MessageActionsMenu
          message={message}
          onRetryMessage={onRetryMessage}
        />
      </div>

      <MessageReactionRail reactions={message.reactions} />
      <MessageDeliveryState message={message} onRetryMessage={onRetryMessage} />
    </div>
  )
}

export function ComposerAttachmentIcon({
  attachment,
}: {
  attachment: ComposerAttachment
}) {
  const meta = messageAttachmentFromComposerAttachment(attachment)
  return <AttachmentIcon attachment={meta} />
}
