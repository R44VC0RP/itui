import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { ResolvedContact } from "@/lib/imsg"
import { avatarSourceForContact } from "@/features/messages/thread-identity"
import { initialsFor } from "@/features/messages/utils"

export function ThreadAvatar({
  active = false,
  contacts = [],
  overflowCount = 0,
  size = "default",
  title,
}: {
  active?: boolean
  contacts?: ResolvedContact[]
  overflowCount?: number
  size?: "sm" | "default" | "lg"
  title: string
}) {
  const visibleContacts = contacts.slice(0, 2)

  if (visibleContacts.length > 1 || overflowCount > 0) {
    return (
      <div
        className={cn(
          "shrink-0 rounded-full",
          active && "ring-2 ring-primary/15 ring-offset-2 ring-offset-background"
        )}
      >
        <AvatarGroup className="items-end">
          {visibleContacts.map((contact) => {
            const avatarSource = avatarSourceForContact(contact)

            return (
              <Avatar key={contact.handle} size={size}>
                {avatarSource ? (
                  <AvatarImage alt={contact.name ?? contact.handle} src={avatarSource} />
                ) : null}
                <AvatarFallback className="font-medium tracking-tight">
                  {contact.initials || initialsFor(contact.name ?? contact.handle)}
                </AvatarFallback>
              </Avatar>
            )
          })}

          {overflowCount > 0 ? (
            <AvatarGroupCount>{`+${overflowCount}`}</AvatarGroupCount>
          ) : null}
        </AvatarGroup>
      </div>
    )
  }

  const contact = visibleContacts[0]
  const avatarSource = avatarSourceForContact(contact)

  return (
    <Avatar className={cn(active && "ring-2 ring-primary/15")} size={size}>
      {avatarSource ? (
        <AvatarImage alt={title} src={avatarSource} />
      ) : null}

      <AvatarFallback
        className={cn(
          "font-medium tracking-tight",
          active
            ? "bg-primary/12 text-primary"
            : "bg-secondary text-secondary-foreground"
        )}
      >
        {contact?.initials || initialsFor(title)}
      </AvatarFallback>
    </Avatar>
  )
}
