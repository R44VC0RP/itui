import { Badge } from "@/components/ui/badge"
import type { ThreadService } from "@/features/messages/types"
import { threadServiceLabel } from "@/features/messages/utils"
import { cn } from "@/lib/utils"

const transportDotClass = (service: ThreadService) =>
  service === "sms"
    ? "bg-[var(--message-sms)]"
    : service === "rcs"
      ? "bg-[var(--message-rcs)]"
      : service === "auto"
        ? "bg-muted-foreground"
        : "bg-[var(--message-imessage)]"

export function ConversationServiceBadge({
  className,
  service,
}: {
  className?: string
  service: ThreadService
}) {
  return (
    <Badge
      className={cn(
        "gap-1.5 rounded-full border-border/70 bg-background/84 px-2.5 py-0.5 text-[11px] font-medium text-foreground/88 shadow-sm backdrop-blur-sm",
        className
      )}
      variant="outline"
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", transportDotClass(service))} />
      <span>{threadServiceLabel(service)}</span>
    </Badge>
  )
}
