import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Composer } from "./components/Composer.tsx";
import { ConversationView } from "./components/ConversationView.tsx";
import { Sidebar } from "./components/Sidebar.tsx";
import { StatusBar, type ConnectionState } from "./components/StatusBar.tsx";
import { ImsgClient, APIError } from "./api/client.ts";
import { ImsgEventStream } from "./api/sse.ts";
import type { ChatRow, Message } from "./api/types.ts";
import type { Config } from "./config.ts";
import { notifyNewMessage } from "./notify.ts";
import { theme } from "./theme.ts";

type Focus = "chats" | "messages" | "composer";

/**
 * Root TUI.
 *
 * Selection is tracked by **chat ID**, not array index. When a new message arrives and
 * the chat list reorders (most-recent-first), the selected conversation stays put
 * because we resolve the index from `selectedChatId` on every render.
 */
export function App({ config }: { config: Config }) {
  const client = useMemo(() => new ImsgClient(config), [config]);
  const dims = useTerminalDimensions();

  // Top-level UI state.
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [messagesByChat, setMessagesByChat] = useState<Record<number, Message[]>>({});
  const [unread, setUnread] = useState<Set<number>>(() => new Set());
  const [focus, setFocus] = useState<Focus>("chats");
  const [composer, setComposer] = useState("");
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [error, setError] = useState<string | null>(null);

  // Derive index from ID every render — stable across reorders.
  const selectedIndex = useMemo(() => {
    if (selectedChatId == null) return 0;
    const idx = chats.findIndex((c) => c.id === selectedChatId);
    return idx >= 0 ? idx : 0;
  }, [chats, selectedChatId]);

  const selected = chats[selectedIndex] ?? null;
  const selectedMessages = selected ? (messagesByChat[selected.id] ?? []) : [];

  // Keep selectedChatId in sync when the user hasn't explicitly picked one yet (first
  // load) or when the previously selected chat disappears from the list.
  useEffect(() => {
    if (chats.length === 0) return;
    if (selectedChatId != null && chats.some((c) => c.id === selectedChatId)) return;
    // Nothing selected or stale — default to the first chat.
    setSelectedChatId(chats[0]!.id);
  }, [chats, selectedChatId]);

  // ----- Data -----

  const reloadChats = useCallback(async () => {
    try {
      const list = await client.listChats(60);
      setChats(list);
      setError(null);
    } catch (err) {
      setError(describeError(err));
    }
  }, [client]);

  useEffect(() => {
    void reloadChats();
  }, [reloadChats]);

  // Load messages on selection change (one-shot per chat; new messages come via SSE).
  useEffect(() => {
    if (!selected) return;
    if (messagesByChat[selected.id]) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await client.listMessages(selected.id, 80);
        if (cancelled) return;
        setMessagesByChat((prev) => ({ ...prev, [selected.id]: list }));
      } catch (err) {
        if (!cancelled) setError(describeError(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, client, messagesByChat]);

  // Clear unread marker when opening a chat.
  useEffect(() => {
    if (!selected) return;
    setUnread((prev) => {
      if (!prev.has(selected.id)) return prev;
      const next = new Set(prev);
      next.delete(selected.id);
      return next;
    });
  }, [selected?.id]);

  // Terminal focus tracking via OpenTUI's renderer events. The renderer listens for
  // the terminal's focus reporting sequences internally and emits "focus" / "blur".
  const renderer = useRenderer();
  const terminalFocusedRef = useRef(true);
  useEffect(() => {
    const onFocus = () => { terminalFocusedRef.current = true; };
    const onBlur = () => { terminalFocusedRef.current = false; };
    renderer.on("focus", onFocus);
    renderer.on("blur", onBlur);
    return () => {
      renderer.off("focus", onFocus);
      renderer.off("blur", onBlur);
    };
  }, [renderer]);

  // SSE subscription. Single long-lived stream across all chats.
  const selectedChatIdRef = useRef<number | null>(null);
  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  useEffect(() => {
    const stream = new ImsgEventStream(config, {
      onOpen: () => {
        setConnection("online");
        setError(null);
      },
      onError: (err) => {
        setConnection("offline");
        setError(describeError(err));
      },
      onClose: () => setConnection("offline"),
      onMessage: (m) => {
        setMessagesByChat((prev) => {
          const existing = prev[m.chat_id] ?? [];
          if (existing.some((x) => x.id === m.id)) return prev;
          return { ...prev, [m.chat_id]: [...existing, m] };
        });
        setChats((prev) => {
          const next = reorderChat(prev, m);
          // Notify when:
          //  1. Terminal is unfocused → always (user isn't looking at itui at all)
          //  2. Terminal is focused but message is for a different chat
          const isActiveChat = selectedChatIdRef.current === m.chat_id;
          const shouldNotify = !m.is_from_me && (!terminalFocusedRef.current || !isActiveChat);
          if (shouldNotify) {
            const chat = next.find((c) => c.id === m.chat_id);
            const chatName = chat?.name || chat?.participants_resolved?.[0]?.name || "";
            notifyNewMessage(config, m, chatName);
          }
          return next;
        });
        if (!m.is_from_me && selectedChatIdRef.current !== m.chat_id) {
          setUnread((prev) => {
            const next = new Set(prev);
            next.add(m.chat_id);
            return next;
          });
        }
      },
    });
    setConnection("connecting");
    void stream.start();
    return () => stream.stop();
  }, [config]);

  // ----- Focus + navigation helpers -----

  const selectByOffset = useCallback(
    (delta: number) => {
      const nextIdx = Math.max(0, Math.min(chats.length - 1, selectedIndex + delta));
      const chat = chats[nextIdx];
      if (chat) setSelectedChatId(chat.id);
    },
    [chats, selectedIndex],
  );

  const selectChatByIndex = useCallback(
    (i: number) => {
      const chat = chats[i];
      if (chat) {
        setSelectedChatId(chat.id);
        setFocus("chats");
      }
    },
    [chats],
  );

  // ----- Keyboard -----

  useKeyboard((key) => {
    // Ctrl+Shift+N: test notification (debug). Fires a fake notification so you can
    // confirm notify-send / osascript works without waiting for a real message.
    if (key.ctrl && key.shift && key.name === "n") {
      notifyNewMessage(
        config,
        { id: 0, chat_id: 0, guid: "", sender: "", is_from_me: false, text: "Test notification from itui", created_at: new Date().toISOString(), attachments: [], reactions: [] },
        "itui test",
      );
      return;
    }

    if (key.ctrl && key.name === "c") {
      if (focus === "composer") {
        if (composer.length > 0) {
          setComposer("");
        } else {
          setFocus("messages");
        }
        return;
      }
      process.exit(0);
    }

    if (key.ctrl && key.name === "r") {
      void reloadChats();
      return;
    }
    if (key.ctrl && key.name === "n") {
      selectByOffset(1);
      return;
    }
    if (key.ctrl && key.name === "p") {
      selectByOffset(-1);
      return;
    }

    if (focus === "composer") {
      if (key.name === "escape") {
        setFocus("messages");
        return;
      }
      if (key.name === "tab") {
        setFocus(key.shift ? "messages" : "chats");
        return;
      }
      return;
    }

    if (key.name === "q") {
      process.exit(0);
    }
    if (key.name === "tab") {
      setFocus(key.shift ? prevFocus(focus) : nextFocus(focus));
      return;
    }

    if (focus === "chats") {
      if (key.name === "down" || key.name === "j") {
        selectByOffset(1);
      } else if (key.name === "up" || key.name === "k") {
        selectByOffset(-1);
      } else if (
        key.name === "return" ||
        key.name === "right" ||
        key.name === "l"
      ) {
        setFocus("messages");
      } else if (key.name === "i" || key.name === "c") {
        if (selected) setFocus("composer");
      }
    } else if (focus === "messages") {
      if (key.name === "left" || key.name === "h" || key.name === "escape") {
        setFocus("chats");
      } else if (key.name === "i" || key.name === "return") {
        if (selected) setFocus("composer");
      }
    }
  });

  const handleSubmit = useCallback(async () => {
    const text = composer.trim();
    if (!text || !selected) return;
    setSendStatus("sending…");
    try {
      await client.send({
        chatId: selected.id,
        chatIdentifier: selected.identifier,
        chatGuid: selected.guid,
        text,
      });
      setComposer("");
      setSendStatus(null);
    } catch (err) {
      setSendStatus(`failed to send: ${describeError(err)}`);
    }
  }, [client, composer, selected]);

  return (
    <box
      style={{
        width: dims.width,
        height: dims.height,
        flexDirection: "column",
        backgroundColor: theme.color.bg,
      }}
    >
      <box style={{ flexGrow: 1, flexDirection: "row" }}>
        <Sidebar
          chats={chats}
          selectedIndex={selectedIndex}
          focused={focus === "chats"}
          unread={unread}
          hideHandles={config.hideHandles}
          onSelect={selectChatByIndex}
          onFocusRequested={() => setFocus("chats")}
        />
        <box style={{ flexGrow: 1, flexDirection: "column" }}>
          <ConversationView
            chat={selected}
            messages={selectedMessages}
            focused={focus === "messages"}
            hideHandles={config.hideHandles}
            onFocusRequested={() => setFocus("messages")}
          />
          <Composer
            focused={focus === "composer"}
            disabled={!selected}
            value={composer}
            onInput={setComposer}
            onSubmit={handleSubmit}
            status={sendStatus}
            onFocusRequested={() => setFocus("composer")}
          />
        </box>
      </box>
      <StatusBar
        focus={focus}
        connection={connection}
        serverURL={config.server}
        error={error}
      />
    </box>
  );
}

function nextFocus(f: Focus): Focus {
  if (f === "chats") return "messages";
  if (f === "messages") return "composer";
  return "chats";
}

function prevFocus(f: Focus): Focus {
  if (f === "chats") return "composer";
  if (f === "messages") return "chats";
  return "messages";
}

function reorderChat(chats: ChatRow[], m: Message): ChatRow[] {
  const idx = chats.findIndex((c) => c.id === m.chat_id);
  if (idx === -1) return chats;
  const updated: ChatRow = {
    ...chats[idx]!,
    last_message_at: m.created_at,
  };
  const copy = [...chats];
  copy.splice(idx, 1);
  copy.unshift(updated);
  return copy;
}

function describeError(err: unknown): string {
  if (err instanceof APIError) return `${err.status} ${err.url}`;
  if (err instanceof Error) return err.message;
  return String(err);
}
