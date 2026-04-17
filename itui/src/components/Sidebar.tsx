import { theme } from "../theme.ts";
import { Avatar } from "./Avatar.tsx";
import type { ChatRow } from "../api/types.ts";

/**
 * Chat list sidebar.
 *
 * Each row is exactly 2 lines tall:
 *   Line 1:  [avatar] Name                   9:48a
 *   Line 2:           +1 (904) 502-4820          ← only if no name; otherwise blank
 *
 * When a resolved name exists the handle is hidden entirely — it's redundant information
 * and was causing ugly wrapping in the previous layout. The unread dot sits in the avatar
 * cell so it doesn't eat its own column.
 */
export function Sidebar({
  chats,
  selectedIndex,
  focused,
  unread,
  hideHandles,
  onSelect,
  onFocusRequested,
}: {
  chats: ChatRow[];
  selectedIndex: number;
  focused: boolean;
  unread: Set<number>;
  hideHandles: boolean;
  onSelect: (index: number) => void;
  onFocusRequested: () => void;
}) {
  return (
    <box
      style={{
        width: 36,
        height: "100%",
        flexShrink: 0,
        flexDirection: "column",
        backgroundColor: theme.color.surface,
        borderStyle: "single",
        borderColor: focused ? theme.color.borderStrong : theme.color.border,
      }}
      title={focused ? " Chats " : " chats "}
      titleAlignment="left"
      onMouseDown={onFocusRequested}
    >
      <scrollbox
        style={{ width: "100%", flexGrow: 1, paddingX: 1, paddingY: 1 }}
        stickyScroll={false}
        rootOptions={{ backgroundColor: theme.color.surface }}
        contentOptions={{ backgroundColor: theme.color.surface }}
        viewportOptions={{ backgroundColor: theme.color.surface }}
        wrapperOptions={{ backgroundColor: theme.color.surface }}
      >
        {chats.map((chat, i) => (
          <SidebarRow
            key={chat.id}
            chat={chat}
            selected={i === selectedIndex}
            focused={focused}
            unread={unread.has(chat.id)}
            hideHandles={hideHandles}
            onClick={() => onSelect(i)}
          />
        ))}
      </scrollbox>
    </box>
  );
}

function SidebarRow({
  chat,
  selected,
  focused,
  unread,
  hideHandles,
  onClick,
}: {
  chat: ChatRow;
  selected: boolean;
  focused: boolean;
  unread: boolean;
  hideHandles: boolean;
  onClick: () => void;
}) {
  const bg = selected
    ? focused
      ? theme.color.surfaceActive
      : theme.color.surfaceHover
    : theme.color.surface;

  const displayName = hideHandles ? chatDisplayName(chat) : chatTitle(chat);
  const time = formatTime(chat.last_message_at);

  return (
    <box
      style={{
        width: "100%",
        height: 3,
        flexShrink: 0,
        flexDirection: "row",
        backgroundColor: bg,
        paddingX: 1,
        paddingY: 1,
        gap: 1,
        alignItems: "center",
      }}
      onMouseDown={(event) => {
        onClick();
        event?.stopPropagation?.();
      }}
    >
      {/* Unread dot */}
      <box style={{ width: 1 }}>
        <text fg={unread ? theme.color.accent : "transparent"}>●</text>
      </box>
      <Avatar contact={chat.participants_resolved?.[0]} handle={chat.identifier} size={3} />
      <box style={{ flexGrow: 1, flexDirection: "row", justifyContent: "space-between", minWidth: 0 }}>
        <text
          fg={selected ? theme.color.textStrong : theme.color.text}
          attributes={unread || selected ? 1 : 0}
        >
          {truncate(displayName, 22)}
        </text>
        <text fg={theme.color.muted}>{time}</text>
      </box>
    </box>
  );
}

/** Shows resolved names, falls back to handles when no name exists. */
function chatTitle(chat: ChatRow): string {
  if (chat.name && chat.name.length > 0) return chat.name;
  const names = (chat.participants_resolved ?? [])
    .map((p) => p.name || p.handle)
    .filter((v) => v.length > 0);
  if (names.length > 0) return names.join(", ");
  return chat.identifier;
}

/** Shows only resolved names. Handles (phone/email) are replaced with "Unknown". */
function chatDisplayName(chat: ChatRow): string {
  if (chat.name && chat.name.length > 0) return chat.name;
  const names = (chat.participants_resolved ?? [])
    .map((p) => p.name || "Unknown")
    .filter((v) => v.length > 0);
  if (names.length > 0) return names.join(", ");
  return "Unknown";
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, Math.max(0, max - 1)) + "…";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    const h = d.getHours();
    const m = d.getMinutes();
    const am = h < 12;
    const hh = ((h + 11) % 12) + 1;
    return `${hh}:${m.toString().padStart(2, "0")}${am ? "a" : "p"}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
