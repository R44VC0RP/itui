import { type ChangeEvent, useMemo, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useAppTheme } from "@/components/theme-provider"
import {
  serializeColorsToml,
  themePreviewSwatches,
  themeTomlFileName,
  type AppThemePreset,
} from "@/lib/app-theme"
import { DownloadIcon, KeyboardIcon, PaletteIcon, Trash2Icon, UploadIcon } from "lucide-react"

const FONT_SCALE_OPTIONS = [
  { label: "Small", value: 0.9 },
  { label: "Default", value: 1 },
  { label: "Medium", value: 1.1 },
  { label: "Large", value: 1.2 },
  { label: "Extra large", value: 1.3 },
] as const

const SHORTCUTS = [
  {
    description: "Open the new message picker",
    keys: ["C"],
    label: "New message",
  },
  {
    description: "Focus the conversation search field",
    keys: ["/"],
    label: "Search conversations",
  },
  {
    description: "Jump to the composer",
    keys: ["R"],
    label: "Focus composer",
  },
  {
    description: "Open the file picker for attachments",
    keys: ["U"],
    label: "Add attachment",
  },
  {
    description: "Move to the next conversation in the list",
    keys: ["J"],
    label: "Next conversation",
  },
  {
    description: "Move to the previous conversation in the list",
    keys: ["K"],
    label: "Previous conversation",
  },
  {
    description: "Send the current message",
    keys: ["Enter"],
    label: "Send",
  },
  {
    description: "Insert a newline in the composer",
    keys: ["Shift", "Enter"],
    label: "New line",
  },
  {
    description: "Pick the highlighted result in the new message dialog",
    keys: ["Enter"],
    label: "Choose result",
  },
  {
    description: "Blur the active field or close the current sheet/dialog",
    keys: ["Esc"],
    label: "Close overlay",
  },
] as const

export function SettingsSheet({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const {
    activeTheme,
    clearImportedTheme,
    fontScale,
    importThemeFile,
    importedTheme,
    setFontScale,
    setTheme,
    themeId,
    themes,
  } = useAppTheme()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusTone, setStatusTone] = useState<"error" | "muted">("muted")

  const classicThemes = useMemo(
    () => themes.filter((theme) => theme.group === "classic"),
    [themes]
  )
  const omarchyThemes = useMemo(
    () => themes.filter((theme) => theme.group === "omarchy"),
    [themes]
  )

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ""

    if (!file) {
      return
    }

    try {
      await importThemeFile(file)
      setStatusTone("muted")
      setStatusMessage(`Imported ${file.name} for this browser.`)
    } catch (error) {
      setStatusTone("error")
      setStatusMessage(error instanceof Error ? error.message : "Could not import colors.toml.")
    }
  }

  const handleDownloadCurrentTheme = () => {
    const contents = serializeColorsToml(activeTheme.palette)
    const blob = new Blob([`${contents}\n`], { type: "text/plain;charset=utf-8" })
    const href = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = href
    anchor.download = themeTomlFileName(activeTheme)
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(href)
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetContent className="w-full border-border/70 bg-background/98 p-0 sm:max-w-md">
          <SheetHeader className="gap-2 px-6 pt-6 pb-5">
            <SheetTitle className="text-[18px] font-semibold tracking-tight">
              Settings
            </SheetTitle>
          </SheetHeader>

        <Separator />

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-6 px-6 py-5">
            <section className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <PaletteIcon className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Appearance</h3>
              </div>

              <div className="rounded-3xl border border-border/70 bg-muted/35 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{activeTheme.name}</p>
                    <p className="pt-1 text-xs text-muted-foreground">
                      {activeTheme.group === "omarchy"
                        ? "Official Omarchy preset"
                        : activeTheme.group === "imported"
                          ? "Imported from colors.toml"
                          : "Built-in itui preset"}
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      aria-label="Download current colors.toml"
                      onClick={handleDownloadCurrentTheme}
                      size="icon-sm"
                      title="Download current colors.toml"
                      type="button"
                      variant="ghost"
                    >
                      <DownloadIcon />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {themePreviewSwatches(activeTheme.palette).map((color, index) => (
                    <span
                      aria-hidden="true"
                      className="size-7 rounded-full border border-black/10 shadow-sm"
                      key={`${activeTheme.id}-${index}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>

                {activeTheme.group === "imported" ? (
                  <div className="mt-4">
                    <Badge variant="outline">Local only</Badge>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                  Theme
                </p>

                <Select onValueChange={setTheme} value={themeId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a theme" />
                  </SelectTrigger>
                  <SelectContent align="start" position="popper">
                    <SelectGroup>
                      <SelectLabel>Classic</SelectLabel>
                      {classicThemes.map((theme) => (
                        <ThemeOptionItem key={theme.id} theme={theme} />
                      ))}
                    </SelectGroup>

                    <SelectSeparator />

                    <SelectGroup>
                      <SelectLabel>Omarchy</SelectLabel>
                      {omarchyThemes.map((theme) => (
                        <ThemeOptionItem key={theme.id} theme={theme} />
                      ))}
                    </SelectGroup>

                    {importedTheme ? (
                      <>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel>Imported</SelectLabel>
                          <ThemeOptionItem theme={importedTheme} />
                        </SelectGroup>
                      </>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                  Text size
                </p>

                <Select
                  onValueChange={(value) => setFontScale(Number.parseFloat(value))}
                  value={fontScale.toFixed(1)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a text size" />
                  </SelectTrigger>
                  <SelectContent align="start" position="popper">
                    <SelectGroup>
                      {FONT_SCALE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value.toFixed(1)}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                  Import colors.toml
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                    variant="outline"
                  >
                    <UploadIcon data-icon="inline-start" />
                    Import file
                  </Button>

                  {importedTheme ? (
                    <Button
                      onClick={clearImportedTheme}
                      type="button"
                      variant="ghost"
                    >
                      <Trash2Icon data-icon="inline-start" />
                      Forget imported theme
                    </Button>
                  ) : null}
                </div>

                <input
                  accept=".toml,text/plain"
                  className="hidden"
                  onChange={handleImport}
                  ref={fileInputRef}
                  type="file"
                />

                <div className="rounded-2xl border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Make your own</p>
                  <p className="pt-1">
                    Download the current theme, edit the hex values, then import the file back here.
                  </p>
                  <p className="pt-2">
                    Required keys: <code>accent</code>, <code>background</code>, <code>foreground</code>.
                  </p>
                  <p className="pt-1">
                    Optional keys: <code>selection_background</code>, <code>selection_foreground</code>, <code>color1</code> through <code>color6</code>.
                  </p>
                </div>

                {statusMessage ? (
                  <p
                    className={
                      statusTone === "error"
                        ? "text-xs text-destructive"
                        : "text-xs text-muted-foreground"
                    }
                  >
                    {statusMessage}
                  </p>
                ) : null}
              </div>
            </section>

            <Separator />

            <section className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <KeyboardIcon className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Shortcuts</h3>
              </div>

              <div className="flex flex-col divide-y divide-border/70">
                {SHORTCUTS.map((shortcut) => (
                  <div
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                    key={shortcut.label}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{shortcut.label}</p>
                      <p className="pt-1 text-xs text-muted-foreground">
                        {shortcut.description}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      {shortcut.keys.map((key) => (
                        <kbd
                          className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-lg border border-border/70 bg-muted/45 px-2 text-[11px] font-medium text-muted-foreground"
                          key={`${shortcut.label}-${key}`}
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

function ThemeOptionItem({ theme }: { theme: AppThemePreset }) {
  return (
    <SelectItem value={theme.id}>
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex items-center gap-1.5">
          {themePreviewSwatches(theme.palette)
            .slice(0, 4)
            .map((color, index) => (
              <span
                aria-hidden="true"
                className="size-3 rounded-full border border-black/10"
                key={`${theme.id}-${index}`}
                style={{ backgroundColor: color }}
              />
            ))}
        </span>

        <span className="min-w-0">
          <span className="block truncate">{theme.name}</span>
        </span>
      </span>
    </SelectItem>
  )
}
