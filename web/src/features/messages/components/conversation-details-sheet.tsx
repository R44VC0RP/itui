import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { CopyIcon, MessageSquareTextIcon, UsersIcon } from "lucide-react"

import { ConversationServiceBadge } from "@/features/messages/components/conversation-service-badge"
import { ThreadAvatar } from "@/features/messages/components/thread-avatar"
import { displayNameForContact } from "@/features/messages/thread-identity"
import type { ActiveConversation } from "@/features/messages/types"
import { copyPlainText } from "@/lib/clipboard"
import { Badge } from "@/components/ui/badge"

const detailTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
})

type DetailParticipant = {
  handle: string
  subtitle: string
  title: string
  avatarContacts: ActiveConversation["avatarContacts"]
}

export function ConversationDetailsSheet({
  activeConversation,
  headerStatus,
  messageCount,
  onOpenChange,
  open,
}: {
  activeConversation: ActiveConversation | null
  headerStatus: string
  messageCount: number
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const participants = useMemo<DetailParticipant[]>(() => {
    if (!activeConversation) {
      return []
    }

    if (activeConversation.kind === "draft") {
      const title = activeConversation.contact
        ? displayNameForContact(activeConversation.contact)
        : activeConversation.title

      return [
        {
          avatarContacts: activeConversation.contact ? [activeConversation.contact] : [],
          handle: activeConversation.handle,
          subtitle: activeConversation.handle,
          title,
        },
      ]
    }

    if (activeConversation.participantContacts.length > 0) {
      return activeConversation.participantContacts.map((contact) => ({
        avatarContacts: [contact],
        handle: contact.handle,
        subtitle: contact.handle,
        title: displayNameForContact(contact),
      }))
    }

    return activeConversation.participantHandles.map((handle) => ({
      avatarContacts: [],
      handle,
      subtitle: handle,
      title: handle,
    }))
  }, [activeConversation])

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full border-border/70 bg-background/98 p-0 sm:max-w-md">
        {activeConversation ? (
          <>
            <SheetHeader className="gap-3 px-6 pt-6 pb-5">
              <div className="flex items-start gap-4 pr-10">
                <ThreadAvatar
                  contacts={activeConversation.avatarContacts}
                  overflowCount={activeConversation.avatarOverflowCount}
                  size="lg"
                  title={activeConversation.title}
                />

                <div className="min-w-0">
                  <SheetTitle className="truncate text-[18px] font-semibold tracking-tight">
                    {activeConversation.title}
                  </SheetTitle>
                  <SheetDescription className="pt-1 text-sm">
                    {activeConversation.subtitle}
                  </SheetDescription>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeConversation.kind === "thread" ? (
                      <ConversationServiceBadge service={activeConversation.service} />
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                    <Badge variant="outline">{headerStatus}</Badge>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <Separator />

            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-6 px-6 py-5">
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MessageSquareTextIcon className="size-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium">Conversation</h3>
                  </div>

                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <dt className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
                        Messages
                      </dt>
                      <dd className="text-sm font-medium">
                        {messageCount === 1 ? "1 message" : `${messageCount} messages`}
                      </dd>
                    </div>

                    <div className="space-y-1">
                      <dt className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
                        Last activity
                      </dt>
                      <dd className="text-sm font-medium">
                        {activeConversation.kind === "thread"
                          ? detailTime.format(new Date(activeConversation.lastActivity))
                          : "Not sent yet"}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <UsersIcon className="size-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium">
                      {participants.length === 1 ? "Participant" : "Participants"}
                    </h3>
                  </div>

                  <div className="divide-y divide-border/70">
                    {participants.map((participant) => (
                      <div
                        className="flex items-center gap-3 py-3"
                        key={participant.handle}
                      >
                        <ThreadAvatar
                          contacts={participant.avatarContacts}
                          size="sm"
                          title={participant.title}
                        />

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {participant.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {participant.subtitle}
                          </p>
                        </div>

                        <Button
                          aria-label={`Copy ${participant.handle}`}
                          onClick={() => void copyPlainText(participant.handle)}
                          size="icon-sm"
                          type="button"
                          variant="ghost"
                        >
                          <CopyIcon />
                        </Button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </ScrollArea>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
