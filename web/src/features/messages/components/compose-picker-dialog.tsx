import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { MessageCircleIcon, SearchIcon, SquarePenIcon } from "lucide-react"

import { ThreadAvatar } from "@/features/messages/components/thread-avatar"
import type { ComposeOption } from "@/features/messages/types"
import type { ContactsList } from "@/lib/imsg"

export function ComposePickerDialog({
  authorization,
  contactOptions,
  errorMessage,
  isLoading,
  manualOption,
  onOpenChange,
  onQueryChange,
  onSelectOption,
  open,
  query,
  recentOptions,
  sessionKey,
}: {
  authorization: ContactsList["authorization"] | null
  contactOptions: ComposeOption[]
  errorMessage?: string | null
  isLoading: boolean
  manualOption: ComposeOption | null
  onOpenChange: (open: boolean) => void
  onQueryChange: (value: string) => void
  onSelectOption: (option: ComposeOption) => void
  open: boolean
  query: string
  recentOptions: ComposeOption[]
  sessionKey: number
}) {
  const hasSearch = query.trim().length > 0
  const primaryOption = manualOption ?? recentOptions[0] ?? contactOptions[0] ?? null
  const isContactsUnavailable =
    authorization != null &&
    authorization !== "authorized" &&
    authorization !== "limited"
  const resultsKey = `${sessionKey}:${query.trim().toLowerCase()}`

  const renderOption = (option: ComposeOption) => (
    <button
      key={option.key}
      type="button"
      onClick={() => onSelectOption(option)}
      className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 overflow-hidden rounded-[1.25rem] px-3 py-2.5 text-left transition-colors hover:bg-muted"
    >
      <ThreadAvatar
        contacts={option.avatarContacts}
        overflowCount={option.avatarOverflowCount}
        title={option.title}
      />
      <div className="min-w-0 overflow-hidden">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <p className="truncate text-sm font-medium tracking-tight">
            {option.title}
          </p>
          {option.isManual ? (
            <Badge variant="outline">New</Badge>
          ) : option.isExistingThread ? (
            <Badge variant="secondary">Existing</Badge>
          ) : null}
        </div>
        <p className="truncate pt-0.5 text-xs text-muted-foreground">
          {option.subtitle}
        </p>
      </div>
    </button>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(88svh,46rem)] w-[min(36rem,calc(100vw-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        key={sessionKey}
      >
        <DialogHeader className="gap-0 border-b px-5 pt-5 pb-4">
          <DialogTitle className="text-[18px] font-semibold tracking-tight">
            New message
          </DialogTitle>
          <DialogDescription className="pt-1.5">
            Pick a contact or enter a phone number/email to start a
            conversation.
          </DialogDescription>

          <div className="pt-4">
            <InputGroup className="bg-background">
              <InputGroupAddon align="inline-start">
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                aria-label="Search contacts"
                autoFocus
                key={`compose-recipient-search-${sessionKey}`}
                name="compose-recipient-search"
                onChange={(event) => onQueryChange(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || !primaryOption) {
                    return
                  }

                  event.preventDefault()
                  onSelectOption(primaryOption)
                }}
                placeholder="Name, phone, or email"
                value={query}
              />
            </InputGroup>
          </div>
        </DialogHeader>

        <ScrollArea
          className="min-h-0 flex-1 overflow-x-hidden"
          key={resultsKey}
        >
          <div className="flex flex-col gap-4 px-3 py-3">
            {isLoading ? (
              <div className="flex min-h-40 flex-col items-center justify-center gap-3 px-6 text-center">
                <Spinner className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Loading contacts
                </p>
              </div>
            ) : errorMessage ? (
              <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-6 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <MessageCircleIcon />
                </div>
                <div className="flex max-w-sm flex-col gap-1">
                  <p className="text-sm font-medium">Can’t load contacts</p>
                  <p className="text-sm text-muted-foreground">
                    {errorMessage}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {manualOption ? (
                  <div className="flex flex-col gap-1">
                    <p className="px-2 text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                      Start New
                    </p>
                    {renderOption(manualOption)}
                  </div>
                ) : null}

                {recentOptions.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    <p className="px-2 text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                      Recent
                    </p>
                    <div className="flex flex-col gap-0.5">
                      {recentOptions.map(renderOption)}
                    </div>
                  </div>
                ) : null}

                {contactOptions.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    <p className="px-2 text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                      Contacts
                    </p>
                    <div className="flex flex-col gap-0.5">
                      {contactOptions.map(renderOption)}
                    </div>
                  </div>
                ) : null}

                {manualOption == null &&
                recentOptions.length === 0 &&
                contactOptions.length === 0 ? (
                  <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-6 text-center">
                    <div className="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                      <SquarePenIcon />
                    </div>
                    <div className="flex max-w-sm flex-col gap-1">
                      <p className="text-sm font-medium">
                        {hasSearch
                          ? "No people found"
                          : "No contacts available"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {isContactsUnavailable
                          ? "Contacts access is not available yet. You can still type a phone number or email."
                          : hasSearch
                            ? "Try a different name, phone number, or email."
                            : "Type a phone number or email to start a conversation."}
                      </p>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
