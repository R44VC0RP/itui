import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { XIcon } from "lucide-react"

import type { ComposerAttachment } from "@/features/messages/types"
import { formatAttachmentBytes } from "@/features/messages/utils"
import {
  ComposerAttachmentIcon,
} from "@/features/messages/components/message-content"
import { cn } from "@/lib/utils"

function AttachmentStatusBadge({
  attachment,
}: {
  attachment: ComposerAttachment
}) {
  if (attachment.status === "queued") {
    return null
  }

  const variant =
    attachment.status === "failed"
      ? "destructive"
      : attachment.status === "sending"
        ? "default"
        : "secondary"
  const label =
    attachment.status === "uploading"
      ? "Uploading"
      : attachment.status === "sending"
        ? "Sending"
        : "Failed"

  return (
    <Badge
      className="gap-1.5"
      title={attachment.errorMessage}
      variant={variant}
    >
      {attachment.status === "uploading" || attachment.status === "sending" ? (
        <Spinner className="size-3" />
      ) : null}
      <span>{label}</span>
    </Badge>
  )
}

export function ComposerAttachmentTray({
  attachments,
  disabled = false,
  onRemove,
}: {
  attachments: ComposerAttachment[]
  disabled?: boolean
  onRemove: (id: string) => void
}) {
  if (attachments.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2 px-1">
      {attachments.map((attachment) => {
        const detail = formatAttachmentBytes(attachment.size)

        if (attachment.kind === "image" && attachment.previewUrl) {
          return (
            <div
              className={cn(
                "relative size-16 overflow-hidden rounded-[1rem] border border-border/70 bg-muted",
                attachment.status === "failed" &&
                  "border-destructive/45 ring-1 ring-destructive/20"
              )}
              key={attachment.id}
            >
              <img
                alt={attachment.name}
                className="size-full object-cover"
                src={attachment.previewUrl}
              />
              <div className="pointer-events-none absolute inset-x-1 top-1 flex justify-start">
                <AttachmentStatusBadge attachment={attachment} />
              </div>
              <Button
                aria-label={`Remove ${attachment.name}`}
                className="absolute top-1 right-1 size-6 rounded-full bg-background/92 shadow-sm hover:bg-background"
                disabled={disabled}
                onClick={() => onRemove(attachment.id)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <XIcon />
              </Button>
            </div>
          )
        }

        return (
          <div
            className={cn(
              "flex min-w-0 max-w-full items-center gap-2 rounded-full border border-border/70 bg-muted px-3 py-2",
              attachment.status === "failed" &&
                "border-destructive/45 bg-destructive/5"
            )}
            key={attachment.id}
          >
            <div className="flex size-8 items-center justify-center rounded-full bg-background text-muted-foreground">
              <ComposerAttachmentIcon attachment={attachment} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{attachment.name}</p>
              <div className="flex items-center gap-2">
                {detail ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {detail}
                  </p>
                ) : null}
                <AttachmentStatusBadge attachment={attachment} />
              </div>
            </div>
            <Button
              aria-label={`Remove ${attachment.name}`}
              className="shrink-0"
              disabled={disabled}
              onClick={() => onRemove(attachment.id)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <XIcon />
            </Button>
          </div>
        )
      })}
    </div>
  )
}
