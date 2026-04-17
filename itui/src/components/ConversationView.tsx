import { theme } from "../theme.ts";
import { Avatar } from "./Avatar.tsx";
import type { ChatRow, Message } from "../api/types.ts";

/** Consecutive messages from the same sender within this window collapse into one group. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

/**
 * Scrollable message list.
 *
 * Messages from the same sender within a 5-minute window are grouped together:
 *
 *   ┌─────────────────────────┐
 *   │ Jess 💕                 │   ← sender header, only on first in group
 *   │ Beef and broccoli ?     │
 *   │ Did you get a rice       │
 *   │ cooker                  │   ← multiple bubbles stacked tight
 *   │ 3:10 PM                 │   ← timestamp only on last in group
 *   └─────────────────────────┘
 *
 * This keeps the screen from being drowned in "Jess 💕" labels and `PM`s while still
 * giving you a clear "who/when" signal at the boundaries of every conversation run.
 */
export function ConversationView({
  chat,
  messages,
  focused,
  hideHandles,
  onFocusRequested,
}: {
  chat: ChatRow | null;
  messages: Message[];
  focused: boolean;
  hideHandles: boolean;
  onFocusRequested: () => void;
}) {
  return (
    <box
      style={{
        flexGrow: 1,
        flexDirection: "column",
        backgroundColor: theme.color.bg,
        borderStyle: "single",
        borderColor: focused ? theme.color.borderStrong : theme.color.border,
      }}
      title={chat ? ` ${hideHandles ? displayName(chat) : title(chat)} ` : " Messages "}
      titleAlignment="center"
      onMouseDown={onFocusRequested}
    >
      <Header chat={chat} hideHandles={hideHandles} />
      {/* key={chat?.id} forces React to unmount/remount the scrollbox when the
          selected chat changes. A fresh scrollbox respects stickyStart="bottom"
          from the start, so history-heavy conversations open at the newest
          messages instead of sitting at the top. */}
      <scrollbox
        key={chat?.id ?? "__empty__"}
        style={{ width: "100%", flexGrow: 1, paddingX: 3, paddingY: 1 }}
        stickyScroll={true}
        stickyStart="bottom"
        rootOptions={{ backgroundColor: theme.color.bg }}
        contentOptions={{ backgroundColor: theme.color.bg }}
        viewportOptions={{ backgroundColor: theme.color.bg }}
        wrapperOptions={{ backgroundColor: theme.color.bg }}
      >
        {messages.length === 0 ? (
          <box style={{ width: "100%", padding: 2, alignItems: "center" }}>
            <text fg={theme.color.muted}>
              {chat ? "No messages yet." : "Select a chat on the left."}
            </text>
          </box>
        ) : (
          buildSections(messages).map((section) => {
            if (section.kind === "day") {
              return <DayDivider key={section.key} label={section.label} />;
            }
            return (
              <MessageGroup
                key={section.key}
                group={section}
                chat={chat}
                hideHandles={hideHandles}
              />
            );
          })
        )}
      </scrollbox>
    </box>
  );
}

function Header({ chat, hideHandles }: { chat: ChatRow | null; hideHandles: boolean }) {
  if (!chat) {
    return (
      <box
        style={{
          height: 2,
          width: "100%",
          paddingX: 3,
          alignItems: "center",
          backgroundColor: theme.color.surface,
          borderColor: theme.color.border,
        }}
      >
        <text fg={theme.color.muted}>No conversation selected</text>
      </box>
    );
  }
  const primary = chat.participants_resolved?.[0];
  const headerTitle = hideHandles ? displayName(chat) : title(chat);
  const subtitle = hideHandles
    ? (chat.is_group ? `${chat.participants.length} participants` : "")
    : (chat.is_group ? `${chat.participants.length} participants` : chat.identifier);
  return (
    <box
      style={{
        height: 2,
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        paddingX: 3,
        backgroundColor: theme.color.surface,
      }}
    >
      <Avatar contact={primary} handle={chat.identifier} size={3} />
      <text fg={theme.color.textStrong} attributes={1}>
        {headerTitle}
      </text>
      {subtitle.length > 0 && (
        <>
          <text fg={theme.color.muted}>·</text>
          <text fg={theme.color.muted}>{subtitle}</text>
        </>
      )}
    </box>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <box
      style={{
        width: "100%",
        flexDirection: "row",
        justifyContent: "center",
        paddingY: 1,
      }}
    >
      <text fg={theme.color.muted}>{`── ${label} ──`}</text>
    </box>
  );
}

type MessageGroupSection = {
  kind: "group";
  key: string;
  senderKey: string;
  isFromMe: boolean;
  contact?: Message["sender_contact"];
  messages: Message[];
  lastStamp: string;
};

type DaySection = { kind: "day"; key: string; label: string };

type Section = MessageGroupSection | DaySection;

function buildSections(messages: Message[]): Section[] {
  const out: Section[] = [];
  let lastDayKey = "";
  let current: MessageGroupSection | null = null;

  for (const m of messages) {
    if (m.is_reaction) {
      // Reactions break the current group so the caption doesn't get glued onto an
      // unrelated author's run of messages.
      if (current) {
        out.push(current);
        current = null;
      }
      out.push({
        kind: "group",
        key: `r-${m.id}`,
        senderKey: m.sender,
        isFromMe: m.is_from_me,
        contact: m.sender_contact,
        messages: [m],
        lastStamp: m.created_at,
      });
      continue;
    }

    const d = new Date(m.created_at);
    const dayKey = dayBucket(d);
    if (dayKey !== lastDayKey) {
      if (current) {
        out.push(current);
        current = null;
      }
      out.push({ kind: "day", key: `d-${dayKey}`, label: formatDayLabel(d) });
      lastDayKey = dayKey;
    }

    const senderKey = m.is_from_me ? "__me__" : m.sender;
    const withinWindow =
      current &&
      current.senderKey === senderKey &&
      Math.abs(new Date(m.created_at).getTime() - new Date(current.lastStamp).getTime()) <=
        GROUP_WINDOW_MS;

    if (current && withinWindow) {
      current.messages.push(m);
      current.lastStamp = m.created_at;
    } else {
      if (current) out.push(current);
      current = {
        kind: "group",
        key: `g-${m.id}`,
        senderKey,
        isFromMe: m.is_from_me,
        contact: m.sender_contact,
        messages: [m],
        lastStamp: m.created_at,
      };
    }
  }
  if (current) out.push(current);
  return out;
}

function MessageGroup({
  group,
  chat,
  hideHandles,
}: {
  group: MessageGroupSection;
  chat: ChatRow | null;
  hideHandles: boolean;
}) {
  const firstMessage = group.messages[0]!;

  if (firstMessage.is_reaction) {
    const who = group.contact?.name || (hideHandles ? "Someone" : firstMessage.sender) || "Someone";
    const emoji = firstMessage.reaction_emoji ?? "•";
    const verb = firstMessage.is_reaction_add === false ? "removed" : "reacted";
    return (
      <box style={{ width: "100%", paddingY: 0, alignItems: "center" }}>
        <text fg={theme.color.muted}>
          {emoji} {who} {verb}
        </text>
      </box>
    );
  }

  const isMe = group.isFromMe;
  const bubbleBg = isMe ? theme.color.accent : theme.color.surface;
  const textColor = isMe ? theme.color.textStrong : theme.color.text;
  const name = group.contact?.name || (hideHandles ? "Unknown" : firstMessage.sender);
  const isGroup = chat?.is_group ?? false;

  return (
    <box
      style={{
        width: "100%",
        flexDirection: "column",
        alignItems: isMe ? "flex-end" : "flex-start",
        marginBottom: 2,
      }}
    >
      {/* Name shown only for group chats receiving messages; 1:1 DMs don't need it
          because the header already identifies the other person. */}
      {!isMe && isGroup && (
        <box style={{ paddingLeft: 1, marginBottom: 0 }}>
          <text fg={theme.color.muted} attributes={1}>
            {name}
          </text>
        </box>
      )}

      {group.messages.map((m) => (
        <Bubble
          key={m.id}
          message={m}
          bg={bubbleBg}
          fg={textColor}
          isMe={isMe}
        />
      ))}

      <box style={{ paddingX: 1, marginTop: 0 }}>
        <text fg={theme.color.muted}>{formatStamp(group.lastStamp)}</text>
      </box>
    </box>
  );
}

function Bubble({
  message,
  bg,
  fg,
  isMe,
}: {
  message: Message;
  bg: string;
  fg: string;
  isMe: boolean;
}) {
  const attachLabel = attachmentsLabel(message);
  // maxWidth is 80% of a 120-col terminal — generous but leaves a clear gutter on the
  // "other" side so you can instantly tell who sent what.
  return (
    <box
      style={{
        maxWidth: "80%",
        backgroundColor: bg,
        paddingX: 2,
        paddingY: 0,
        marginBottom: 0,
        flexDirection: "column",
        alignItems: isMe ? "flex-end" : "flex-start",
      }}
    >
      {message.text.length > 0 && <text fg={fg}>{message.text}</text>}
      {attachLabel && (
        <text fg={isMe ? theme.color.textStrong : theme.color.muted}>{attachLabel}</text>
      )}
      {message.reactions.length > 0 && (
        <text fg={theme.color.muted}>{message.reactions.map((r) => r.emoji).join(" ")}</text>
      )}
    </box>
  );
}

function attachmentsLabel(m: Message): string {
  if (m.attachments.length === 0) return "";
  const first = m.attachments[0]!;
  const kind = first.mime_type.startsWith("image/")
    ? "image"
    : first.mime_type.startsWith("video/")
      ? "video"
      : first.mime_type.startsWith("audio/")
        ? "audio"
        : "file";
  const more = m.attachments.length > 1 ? ` (+${m.attachments.length - 1})` : "";
  const name = first.transfer_name || first.filename || "";
  return `[${kind}${name ? ` · ${name}` : ""}${more}]`;
}

function title(chat: ChatRow): string {
  if (chat.name && chat.name.length > 0) return chat.name;
  const names = (chat.participants_resolved ?? [])
    .map((p) => p.name || p.handle)
    .filter((v) => v.length > 0);
  return names.length > 0 ? names.join(", ") : chat.identifier;
}

/** Names only — handles replaced with "Unknown". */
function displayName(chat: ChatRow): string {
  if (chat.name && chat.name.length > 0) return chat.name;
  const names = (chat.participants_resolved ?? [])
    .map((p) => p.name || "Unknown")
    .filter((v) => v.length > 0);
  return names.length > 0 ? names.join(", ") : "Unknown";
}

function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours();
  const m = d.getMinutes();
  const am = h < 12;
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

function dayBucket(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDayLabel(d: Date): string {
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return "Yesterday";
  }
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}
