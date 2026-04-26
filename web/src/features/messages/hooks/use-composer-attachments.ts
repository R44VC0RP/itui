import type { ChangeEvent, ClipboardEvent, DragEvent } from "react"
import { useCallback, useEffect, useRef, useState } from "react"

import type {
  ActiveConversation,
  ComposerAttachment,
} from "@/features/messages/types"
import {
  composerAttachmentKey,
  createComposerAttachment,
  releaseComposerAttachment,
} from "@/features/messages/utils"

export function useComposerAttachments({
  activeConversation,
  isSending,
  onQueueFiles,
}: {
  activeConversation: ActiveConversation | null
  isSending: boolean
  onQueueFiles?: () => void
}) {
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const [isDraggingComposerFiles, setIsDraggingComposerFiles] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const attachmentsRef = useRef<ComposerAttachment[]>([])
  const dragDepthRef = useRef(0)

  const updateAttachments = useCallback(
    (updater: (current: ComposerAttachment[]) => ComposerAttachment[]) => {
      setAttachments((current) => {
        const next = updater(current)

        if (next === current) {
          return current
        }

        const nextIDs = new Set(next.map((attachment) => attachment.id))
        current.forEach((attachment) => {
          if (!nextIDs.has(attachment.id)) {
            releaseComposerAttachment(attachment)
          }
        })

        return next
      })
    },
    []
  )

  const clearDragState = useCallback(() => {
    dragDepthRef.current = 0
    setIsDraggingComposerFiles(false)
  }, [])

  const resetAttachments = useCallback(() => {
    clearDragState()
    updateAttachments(() => [])
  }, [clearDragState, updateAttachments])

  const setAttachmentState = useCallback(
    (
      attachmentId: string,
      status: ComposerAttachment["status"],
      errorMessage?: string
    ) => {
      updateAttachments((current) => {
        const index = current.findIndex(
          (attachment) => attachment.id === attachmentId
        )

        if (index === -1) {
          return current
        }

        const existing = current[index]!

        if (
          existing.status === status &&
          existing.errorMessage === errorMessage
        ) {
          return current
        }

        const next = [...current]
        next[index] = {
          ...existing,
          errorMessage,
          status,
        }
        return next
      })
    },
    [updateAttachments]
  )

  const queueFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0 || !activeConversation || isSending) {
        return
      }

      onQueueFiles?.()

      updateAttachments((current) => {
        const existing = new Set(
          current.map((attachment) => composerAttachmentKey(attachment.file))
        )
        const additions = files
          .filter((file) => {
            const key = composerAttachmentKey(file)

            if (existing.has(key)) {
              return false
            }

            existing.add(key)
            return true
          })
          .map(createComposerAttachment)

        if (additions.length === 0) {
          return current
        }

        return [...current, ...additions]
      })
    },
    [activeConversation, isSending, onQueueFiles, updateAttachments]
  )

  const prepareAttachmentsForSend = useCallback(() => {
    const nextAttachments = attachments.map((attachment) =>
      attachment.status === "failed"
        ? {
            ...attachment,
            errorMessage: undefined,
            status: "queued" as const,
          }
        : attachment
    )

    updateAttachments((current) =>
      current.map((attachment) =>
        attachment.status === "failed"
          ? {
              ...attachment,
              errorMessage: undefined,
              status: "queued",
            }
          : attachment
      )
    )

    return nextAttachments
  }, [attachments, updateAttachments])

  const removeAttachment = useCallback(
    (attachmentId: string) => {
      updateAttachments((current) =>
        current.filter((attachment) => attachment.id !== attachmentId)
      )
    },
    [updateAttachments]
  )

  const transferHasFiles = useCallback(
    (transfer: Pick<DataTransfer, "items" | "types" | "files"> | null) => {
      if (!transfer) {
        return false
      }

      if (
        Array.from(transfer.items ?? []).some((item) => item.kind === "file")
      ) {
        return true
      }

      if (Array.from(transfer.types ?? []).includes("Files")) {
        return true
      }

      return (transfer.files?.length ?? 0) > 0
    },
    []
  )

  const extractTransferFiles = useCallback(
    (transfer: Pick<DataTransfer, "items" | "files"> | null) => {
      if (!transfer) {
        return []
      }

      const itemFiles = Array.from(transfer.items ?? [])
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter((file): file is File => file != null && file.size > 0)

      if (itemFiles.length > 0) {
        return itemFiles
      }

      return Array.from(transfer.files ?? []).filter((file) => file.size > 0)
    },
    []
  )

  const handleOpenFilePicker = useCallback(() => {
    if (!activeConversation || isSending) {
      return
    }

    fileInputRef.current?.click()
  }, [activeConversation, isSending])

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.currentTarget.files ?? [])
      queueFiles(files)
      event.currentTarget.value = ""
    },
    [queueFiles]
  )

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const files = extractTransferFiles(event.clipboardData)

      if (files.length === 0) {
        return
      }

      event.preventDefault()
      queueFiles(files)
    },
    [extractTransferFiles, queueFiles]
  )

  const handleDragEnter = useCallback(
    (event: DragEvent<HTMLFormElement>) => {
      if (
        !activeConversation ||
        isSending ||
        !transferHasFiles(event.dataTransfer)
      ) {
        return
      }

      event.preventDefault()
      dragDepthRef.current += 1
      setIsDraggingComposerFiles(true)
    },
    [activeConversation, isSending, transferHasFiles]
  )

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLFormElement>) => {
      if (
        !activeConversation ||
        isSending ||
        !transferHasFiles(event.dataTransfer)
      ) {
        return
      }

      event.preventDefault()
      event.dataTransfer.dropEffect = "copy"

      if (!isDraggingComposerFiles) {
        setIsDraggingComposerFiles(true)
      }
    },
    [activeConversation, isDraggingComposerFiles, isSending, transferHasFiles]
  )

  const handleDragLeave = useCallback(
    (event: DragEvent<HTMLFormElement>) => {
      if (!transferHasFiles(event.dataTransfer)) {
        return
      }

      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)

      if (dragDepthRef.current === 0) {
        setIsDraggingComposerFiles(false)
      }
    },
    [transferHasFiles]
  )

  const handleDrop = useCallback(
    (event: DragEvent<HTMLFormElement>) => {
      if (!transferHasFiles(event.dataTransfer)) {
        return
      }

      event.preventDefault()
      const files = extractTransferFiles(event.dataTransfer)
      clearDragState()
      queueFiles(files)
    },
    [clearDragState, extractTransferFiles, queueFiles, transferHasFiles]
  )

  useEffect(() => {
    attachmentsRef.current = attachments
  }, [attachments])

  useEffect(
    () => () => {
      attachmentsRef.current.forEach(releaseComposerAttachment)
    },
    []
  )

  return {
    attachments,
    clearDragState,
    fileInputRef,
    isDragActive:
      isDraggingComposerFiles && activeConversation != null && !isSending,
    onAddAttachment: handleOpenFilePicker,
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
    onFileChange: handleFileChange,
    onPaste: handlePaste,
    onRemoveAttachment: removeAttachment,
    prepareAttachmentsForSend,
    resetAttachments,
    setAttachmentState,
  }
}
