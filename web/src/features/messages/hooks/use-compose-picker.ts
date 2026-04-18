import { startTransition, useCallback, useMemo, useState } from "react"

import type { ContactsList, ResolvedContact } from "@/lib/imsg"
import { dedupeComposeOptionsByHandle } from "@/features/messages/compose-options"
import type {
  ComposeOption,
  DraftConversation,
  ThreadSummary,
} from "@/features/messages/types"
import { MessagesService } from "@/features/messages/services/messages-service"
import { rankComposeOptions } from "@/features/messages/search"
import {
  draftServiceForHandle,
  findThreadByHandle,
  handlesMatch,
  isHandleLike,
  normalizeHandle,
} from "@/features/messages/utils"
import { displayNameForContact } from "@/features/messages/thread-identity"

export function useComposePicker({
  onSelectExistingThread,
  onStartDraftConversation,
  service,
  threads,
}: {
  onSelectExistingThread: (threadId: number) => void
  onStartDraftConversation: (conversation: DraftConversation) => void
  service: MessagesService
  threads: ThreadSummary[]
}) {
  const [contacts, setContacts] = useState<ResolvedContact[]>([])
  const [contactsAuthorization, setContactsAuthorization] = useState<
    ContactsList["authorization"] | null
  >(null)
  const [contactsError, setContactsError] = useState<string | null>(null)
  const [composeQuery, setComposeQuery] = useState("")
  const [isComposeOpen, setIsComposeOpen] = useState(false)
  const [composeSessionKey, setComposeSessionKey] = useState(0)
  const [hasLoadedContacts, setHasLoadedContacts] = useState(false)
  const [isLoadingContacts, setIsLoadingContacts] = useState(false)

  const loadContacts = useCallback(async () => {
    if (hasLoadedContacts || isLoadingContacts) {
      return
    }

    setIsLoadingContacts(true)

    try {
      const nextContacts = await service.listContacts()

      startTransition(() => {
        setContacts(nextContacts.contacts)
        setContactsAuthorization(nextContacts.authorization)
        setContactsError(null)
        setHasLoadedContacts(true)
      })
    } catch (error) {
      setContactsError(
        error instanceof Error ? error.message : "Failed to load contacts"
      )
    } finally {
      setIsLoadingContacts(false)
    }
  }, [hasLoadedContacts, isLoadingContacts, service])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsComposeOpen(open)

      if (!open) {
        setComposeQuery("")
        return
      }

      setContactsError(null)
      setComposeSessionKey((current) => current + 1)
      void loadContacts()
    },
    [loadContacts]
  )

  const handleOpenCompose = useCallback(() => {
    handleOpenChange(true)
  }, [handleOpenChange])

  const composeSearch = composeQuery.trim().toLowerCase()

  const recentComposeOptions = useMemo(
    () => {
      const nextOptions = threads
        .flatMap<ComposeOption>((thread) => {
          if (thread.isGroup || !thread.primaryHandle.trim()) {
            return []
          }

          const searchText = [
            thread.title,
            thread.primaryHandle,
            thread.contact?.name ?? "",
          ]
            .join(" ")
            .toLowerCase()

          if (composeSearch && !searchText.includes(composeSearch)) {
            return []
          }

          return [
            {
              avatarContacts: thread.avatarContacts,
              avatarOverflowCount: thread.avatarOverflowCount,
              contact: thread.contact,
              handle: thread.primaryHandle,
              isExistingThread: true,
              isManual: false,
              key: `recent-${thread.id}`,
              participantContacts: thread.participantContacts,
              service: thread.service,
              subtitle: thread.subtitle,
              threadId: thread.id,
              title: thread.title,
            },
          ]
        })

      return dedupeComposeOptionsByHandle(
        rankComposeOptions(nextOptions, composeSearch)
      ).slice(0, 8)
    },
    [composeSearch, threads]
  )

  const recentHandleKeys = useMemo(
    () =>
      new Set(
        recentComposeOptions.map((option) => normalizeHandle(option.handle))
      ),
    [recentComposeOptions]
  )

  const contactComposeOptions = useMemo(
    () => {
      const nextOptions = contacts
        .flatMap<ComposeOption>((contact) => {
          const handleKey = normalizeHandle(contact.handle)

          if (!handleKey || recentHandleKeys.has(handleKey)) {
            return []
          }

          const searchText = [displayNameForContact(contact), contact.handle]
            .join(" ")
            .toLowerCase()

          if (composeSearch && !searchText.includes(composeSearch)) {
            return []
          }

          const existingThread = findThreadByHandle(threads, contact.handle)

          return [
            {
              avatarContacts: contact.has_avatar || contact.name
                ? [contact]
                : [],
              avatarOverflowCount: 0,
              contact,
              handle: contact.handle,
              isExistingThread: existingThread != null,
              isManual: false,
              key: `contact-${handleKey}`,
              participantContacts: [contact],
              service: existingThread?.service ?? draftServiceForHandle(contact.handle),
              subtitle: contact.handle,
              threadId: existingThread?.id,
              title: displayNameForContact(contact),
            },
          ]
        })

      return dedupeComposeOptionsByHandle(
        rankComposeOptions(nextOptions, composeSearch)
      )
    },
    [composeSearch, contacts, recentHandleKeys, threads]
  )

  const manualComposeOption = useMemo(() => {
    const trimmed = composeQuery.trim()

    if (!isHandleLike(trimmed)) {
      return null
    }

    const knownOption = [...recentComposeOptions, ...contactComposeOptions].some(
      (option) => handlesMatch(option.handle, trimmed)
    )

    if (knownOption) {
      return null
    }

    return {
      avatarContacts: [],
      avatarOverflowCount: 0,
      handle: trimmed,
      isExistingThread: false,
      isManual: true,
      key: `manual-${normalizeHandle(trimmed) || trimmed.toLowerCase()}`,
      participantContacts: [],
      service: draftServiceForHandle(trimmed),
      subtitle: "Start a new conversation",
      title: trimmed,
    } satisfies ComposeOption
  }, [composeQuery, contactComposeOptions, recentComposeOptions])

  const handleSelectOption = useCallback(
    (option: ComposeOption) => {
      handleOpenChange(false)

      if (option.threadId != null) {
        onSelectExistingThread(option.threadId)
        return
      }

      onStartDraftConversation({
        avatarContacts: option.avatarContacts,
        avatarOverflowCount: option.avatarOverflowCount,
        contact: option.contact,
        handle: option.handle,
        kind: "draft",
        participantContacts: option.participantContacts,
        service: option.service,
        subtitle: option.subtitle,
        title: option.title,
      })
    },
    [handleOpenChange, onSelectExistingThread, onStartDraftConversation]
  )

  return {
    authorization: contactsAuthorization,
    contactOptions: contactComposeOptions,
    errorMessage: contactsError,
    isLoading: isLoadingContacts,
    manualOption: manualComposeOption,
    onOpenChange: handleOpenChange,
    onOpenCompose: handleOpenCompose,
    onQueryChange: setComposeQuery,
    onSelectOption: handleSelectOption,
    open: isComposeOpen,
    query: composeQuery,
    recentOptions: recentComposeOptions,
    sessionKey: composeSessionKey,
  }
}
