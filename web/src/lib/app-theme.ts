export type ThemePalette = {
  accent: string
  background: string
  foreground: string
  selectionBackground?: string
  selectionForeground?: string
  color1?: string
  color2?: string
  color3?: string
  color4?: string
  color5?: string
  color6?: string
}

export type AppThemeGroup = "classic" | "omarchy" | "imported"

export type AppThemePreset = {
  group: AppThemeGroup
  id: string
  name: string
  palette: ThemePalette
}

export type DerivedAppTheme = {
  cssVariables: Record<string, string>
  mode: "dark" | "light"
}

export const DEFAULT_APP_THEME_ID = "classic:night"
export const IMPORTED_APP_THEME_ID = "imported:local"

const REQUIRED_KEYS = new Set(["accent", "background", "foreground"])
const HEX_COLOR = /^#[0-9a-f]{6}$/i

const CLASSIC_THEMES: AppThemePreset[] = [
  {
    group: "classic",
    id: "classic:night",
    name: "Classic Night",
    palette: {
      accent: "#0a84ff",
      background: "#161a1f",
      foreground: "#f4f7ff",
      selectionBackground: "#0a84ff",
      selectionForeground: "#ffffff",
      color1: "#ff5d73",
      color2: "#34c759",
      color3: "#f6c44c",
      color4: "#0a84ff",
      color5: "#b47cff",
      color6: "#5cc8ff",
    },
  },
  {
    group: "classic",
    id: "classic:day",
    name: "Classic Day",
    palette: {
      accent: "#0a84ff",
      background: "#f6f8fc",
      foreground: "#1f2733",
      selectionBackground: "#cfe4ff",
      selectionForeground: "#11304d",
      color1: "#d84d5a",
      color2: "#34a853",
      color3: "#c98b19",
      color4: "#0a84ff",
      color5: "#8a5cf6",
      color6: "#168aad",
    },
  },
]

const OMARCHY_THEME_PALETTES: Record<string, ThemePalette> = {
  catppuccin: {
    accent: "#89b4fa",
    background: "#1e1e2e",
    foreground: "#cdd6f4",
    selectionBackground: "#f5e0dc",
    selectionForeground: "#1e1e2e",
    color1: "#f38ba8",
    color2: "#a6e3a1",
    color3: "#f9e2af",
    color4: "#89b4fa",
    color5: "#f5c2e7",
    color6: "#94e2d5",
  },
  "catppuccin-latte": {
    accent: "#1e66f5",
    background: "#eff1f5",
    foreground: "#4c4f69",
    selectionBackground: "#dc8a78",
    selectionForeground: "#eff1f5",
    color1: "#d20f39",
    color2: "#40a02b",
    color3: "#df8e1d",
    color4: "#1e66f5",
    color5: "#ea76cb",
    color6: "#179299",
  },
  ethereal: {
    accent: "#7d82d9",
    background: "#060b1e",
    foreground: "#ffcead",
    selectionBackground: "#ffcead",
    selectionForeground: "#060b1e",
    color1: "#ed5b5a",
    color2: "#92a593",
    color3: "#e9bb4f",
    color4: "#7d82d9",
    color5: "#c89dc1",
    color6: "#a3bfd1",
  },
  everforest: {
    accent: "#7fbbb3",
    background: "#2d353b",
    foreground: "#d3c6aa",
    selectionBackground: "#d3c6aa",
    selectionForeground: "#2d353b",
    color1: "#e67e80",
    color2: "#a7c080",
    color3: "#dbbc7f",
    color4: "#7fbbb3",
    color5: "#d699b6",
    color6: "#83c092",
  },
  "flexoki-light": {
    accent: "#205ea6",
    background: "#fffcf0",
    foreground: "#100f0f",
    selectionBackground: "#cecdc3",
    selectionForeground: "#100f0f",
    color1: "#d14d41",
    color2: "#879a39",
    color3: "#d0a215",
    color4: "#205ea6",
    color5: "#ce5d97",
    color6: "#3aa99f",
  },
  gruvbox: {
    accent: "#7daea3",
    background: "#282828",
    foreground: "#d4be98",
    selectionBackground: "#d65d0e",
    selectionForeground: "#ebdbb2",
    color1: "#ea6962",
    color2: "#a9b665",
    color3: "#d8a657",
    color4: "#7daea3",
    color5: "#d3869b",
    color6: "#89b482",
  },
  hackerman: {
    accent: "#82fb9c",
    background: "#0b0c16",
    foreground: "#ddf7ff",
    selectionBackground: "#ddf7ff",
    selectionForeground: "#0b0c16",
    color1: "#50f872",
    color2: "#4fe88f",
    color3: "#50f7d4",
    color4: "#829dd4",
    color5: "#86a7df",
    color6: "#7cf8f7",
  },
  kanagawa: {
    accent: "#7e9cd8",
    background: "#1f1f28",
    foreground: "#dcd7ba",
    selectionBackground: "#2d4f67",
    selectionForeground: "#c8c093",
    color1: "#c34043",
    color2: "#76946a",
    color3: "#c0a36e",
    color4: "#7e9cd8",
    color5: "#957fb8",
    color6: "#6a9589",
  },
  lumon: {
    accent: "#f2fcff",
    background: "#16242d",
    foreground: "#d6e2ee",
    selectionBackground: "#4d9ed3",
    selectionForeground: "#1b2d40",
    color1: "#4d86b0",
    color2: "#5e95bc",
    color3: "#6fa4c9",
    color4: "#6fb8e3",
    color5: "#8bc9eb",
    color6: "#b4e4f6",
  },
  "matte-black": {
    accent: "#e68e0d",
    background: "#121212",
    foreground: "#bebebe",
    selectionBackground: "#333333",
    selectionForeground: "#bebebe",
    color1: "#d35f5f",
    color2: "#ffc107",
    color3: "#b91c1c",
    color4: "#e68e0d",
    color5: "#d35f5f",
    color6: "#bebebe",
  },
  miasma: {
    accent: "#78824b",
    background: "#222222",
    foreground: "#c2c2b0",
    selectionBackground: "#78824b",
    selectionForeground: "#c2c2b0",
    color1: "#685742",
    color2: "#5f875f",
    color3: "#b36d43",
    color4: "#78824b",
    color5: "#bb7744",
    color6: "#c9a554",
  },
  nord: {
    accent: "#81a1c1",
    background: "#2e3440",
    foreground: "#d8dee9",
    selectionBackground: "#4c566a",
    selectionForeground: "#d8dee9",
    color1: "#bf616a",
    color2: "#a3be8c",
    color3: "#ebcb8b",
    color4: "#81a1c1",
    color5: "#b48ead",
    color6: "#88c0d0",
  },
  "osaka-jade": {
    accent: "#509475",
    background: "#111c18",
    foreground: "#c1c497",
    selectionBackground: "#c1c497",
    selectionForeground: "#111c18",
    color1: "#ff5345",
    color2: "#549e6a",
    color3: "#459451",
    color4: "#509475",
    color5: "#d2689c",
    color6: "#2dd5b7",
  },
  "retro-82": {
    accent: "#faa968",
    background: "#05182e",
    foreground: "#f6dcac",
    selectionBackground: "#faa968",
    selectionForeground: "#00172e",
    color1: "#f85525",
    color2: "#028391",
    color3: "#e97b3c",
    color4: "#faa968",
    color5: "#3f8f8a",
    color6: "#8cbfb8",
  },
  ristretto: {
    accent: "#f38d70",
    background: "#2c2525",
    foreground: "#e6d9db",
    selectionBackground: "#403e41",
    selectionForeground: "#e6d9db",
    color1: "#fd6883",
    color2: "#adda78",
    color3: "#f9cc6c",
    color4: "#f38d70",
    color5: "#a8a9eb",
    color6: "#85dacc",
  },
  "rose-pine": {
    accent: "#56949f",
    background: "#faf4ed",
    foreground: "#575279",
    selectionBackground: "#dfdad9",
    selectionForeground: "#575279",
    color1: "#b4637a",
    color2: "#286983",
    color3: "#ea9d34",
    color4: "#56949f",
    color5: "#907aa9",
    color6: "#d7827e",
  },
  "tokyo-night": {
    accent: "#7aa2f7",
    background: "#1a1b26",
    foreground: "#a9b1d6",
    selectionBackground: "#7aa2f7",
    selectionForeground: "#c0caf5",
    color1: "#f7768e",
    color2: "#9ece6a",
    color3: "#e0af68",
    color4: "#7aa2f7",
    color5: "#ad8ee6",
    color6: "#449dab",
  },
  vantablack: {
    accent: "#8d8d8d",
    background: "#0d0d0d",
    foreground: "#ffffff",
    selectionBackground: "#ffffff",
    selectionForeground: "#0d0d0d",
    color1: "#a4a4a4",
    color2: "#b6b6b6",
    color3: "#cecece",
    color4: "#8d8d8d",
    color5: "#9b9b9b",
    color6: "#b0b0b0",
  },
  white: {
    accent: "#6e6e6e",
    background: "#ffffff",
    foreground: "#000000",
    selectionBackground: "#1a1a1a",
    selectionForeground: "#ffffff",
    color1: "#2a2a2a",
    color2: "#3a3a3a",
    color3: "#4a4a4a",
    color4: "#1a1a1a",
    color5: "#2e2e2e",
    color6: "#3e3e3e",
  },
}

const OMARCHY_THEMES: AppThemePreset[] = Object.entries(OMARCHY_THEME_PALETTES)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([slug, palette]) => ({
    group: "omarchy",
    id: `omarchy:${slug}`,
    name: slug
      .split("-")
      .map((part) =>
        /^\d+$/.test(part) ? part : `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`
      )
      .join(" "),
    palette,
  }))

export const BUILTIN_APP_THEMES: AppThemePreset[] = [
  ...CLASSIC_THEMES,
  ...OMARCHY_THEMES,
]

export function findBuiltinTheme(themeId: string) {
  return BUILTIN_APP_THEMES.find((theme) => theme.id === themeId) ?? null
}

export function createImportedTheme(
  fileName: string,
  palette: ThemePalette
): AppThemePreset {
  const normalizedName = fileNameToThemeName(fileName)

  return {
    group: "imported",
    id: IMPORTED_APP_THEME_ID,
    name: normalizedName,
    palette,
  }
}

export function serializeColorsToml(palette: ThemePalette) {
  const entries: [string, string | undefined][] = [
    ["accent", palette.accent],
    ["foreground", palette.foreground],
    ["background", palette.background],
    ["selection_background", palette.selectionBackground],
    ["selection_foreground", palette.selectionForeground],
    ["color1", palette.color1],
    ["color2", palette.color2],
    ["color3", palette.color3],
    ["color4", palette.color4],
    ["color5", palette.color5],
    ["color6", palette.color6],
  ]

  return entries
    .filter(([, value]) => typeof value === "string" && value.length > 0)
    .map(([key, value]) => `${key} = "${value}"`)
    .join("\n")
}

export function themeTomlFileName(theme: AppThemePreset) {
  const slug =
    theme.group === "omarchy"
      ? theme.id.replace(/^omarchy:/, "")
      : theme.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")

  return `${slug.length > 0 ? slug : "colors"}.toml`
}

export function parseColorsToml(contents: string): ThemePalette {
  const values: Partial<ThemePalette> = {}

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) {
      continue
    }

    const match = line.match(
      /^([a-zA-Z0-9_]+)\s*=\s*"([^"]+)"(?:\s+#.*)?$/
    )
    if (!match) {
      continue
    }

    const [, rawKey, rawValue] = match
    if (!HEX_COLOR.test(rawValue)) {
      continue
    }

    const key = tomlKeyToPaletteKey(rawKey)
    if (!key) {
      continue
    }

    values[key] = rawValue.toLowerCase()
  }

  for (const key of REQUIRED_KEYS) {
    if (!values[key as keyof ThemePalette]) {
      throw new Error(
        `Missing required key "${key}" in colors.toml. Expected at least accent, background, and foreground.`
      )
    }
  }

  return values as ThemePalette
}

export function deriveAppTheme(palette: ThemePalette): DerivedAppTheme {
  const mode = isDarkHex(palette.background) ? "dark" : "light"
  const imessageBubble = palette.accent
  const rcsBubble = palette.color6 ?? palette.color4 ?? palette.accent
  const smsBubble = palette.color2 ?? "#34c759"
  const imessageForeground = pickBubbleText(imessageBubble, { preferLight: true })
  const primaryForeground = imessageForeground
  const selectionBase = palette.selectionBackground ?? palette.accent

  return {
    mode,
    cssVariables: {
      "--accent": mix(palette.background, palette.accent, mode === "dark" ? 18 : 10),
      "--accent-foreground": palette.foreground,
      "--background": palette.background,
      "--border": mix(palette.background, palette.foreground, mode === "dark" ? 16 : 12),
      "--card": mix(palette.background, palette.foreground, mode === "dark" ? 8 : 4),
      "--card-foreground": palette.foreground,
      "--chart-1": palette.color4 ?? palette.accent,
      "--chart-2": palette.color2 ?? palette.accent,
      "--chart-3": palette.color3 ?? palette.accent,
      "--chart-4": palette.color5 ?? palette.accent,
      "--chart-5": palette.color6 ?? palette.accent,
      "--destructive": palette.color1 ?? "#ef4444",
      "--foreground": palette.foreground,
      "--input": mix(palette.background, palette.foreground, mode === "dark" ? 18 : 14),
      "--message-imessage": imessageBubble,
      "--message-imessage-foreground": imessageForeground,
      "--message-rcs": rcsBubble,
      "--message-rcs-foreground": pickBubbleText(rcsBubble),
      "--message-sms": smsBubble,
      "--message-sms-foreground": pickBubbleText(smsBubble),
      "--muted": mix(palette.background, palette.foreground, mode === "dark" ? 6 : 8),
      "--muted-foreground": mix(palette.foreground, palette.background, mode === "dark" ? 26 : 38),
      "--popover": mix(palette.background, palette.foreground, mode === "dark" ? 10 : 5),
      "--popover-foreground": palette.foreground,
      "--primary": palette.accent,
      "--primary-foreground": primaryForeground,
      "--ring": palette.accent,
      "--secondary": mix(palette.background, palette.foreground, mode === "dark" ? 10 : 6),
      "--secondary-foreground": palette.foreground,
      "--selection-background": palette.selectionBackground ?? mix(palette.background, palette.accent, mode === "dark" ? 20 : 14),
      "--selection-foreground": palette.selectionForeground ?? pickReadableText(selectionBase),
      "--sidebar": mix(palette.background, palette.foreground, mode === "dark" ? 4 : 2),
      "--sidebar-accent": mix(palette.background, palette.accent, mode === "dark" ? 14 : 8),
      "--sidebar-accent-foreground": palette.foreground,
      "--sidebar-border": mix(palette.background, palette.foreground, mode === "dark" ? 12 : 10),
      "--sidebar-foreground": palette.foreground,
      "--sidebar-primary": palette.accent,
      "--sidebar-primary-foreground": primaryForeground,
      "--sidebar-ring": palette.accent,
    },
  }
}

export function themePreviewSwatches(palette: ThemePalette) {
  return [
    palette.background,
    palette.foreground,
    palette.accent,
    palette.color2 ?? palette.accent,
    palette.color6 ?? palette.color4 ?? palette.accent,
  ]
}

function fileNameToThemeName(fileName: string) {
  const baseName = fileName.replace(/\.toml$/i, "").trim()
  return baseName.length === 0 || /^colors$/i.test(baseName)
    ? "Imported Theme"
    : baseName
        .replace(/[-_.]+/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .map((part) =>
          /^\d+$/.test(part) ? part : `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`
        )
        .join(" ")
}

function tomlKeyToPaletteKey(rawKey: string): keyof ThemePalette | null {
  if (rawKey === "selection_background") {
    return "selectionBackground"
  }

  if (rawKey === "selection_foreground") {
    return "selectionForeground"
  }

  if (
    rawKey === "accent" ||
    rawKey === "background" ||
    rawKey === "foreground" ||
    rawKey === "color1" ||
    rawKey === "color2" ||
    rawKey === "color3" ||
    rawKey === "color4" ||
    rawKey === "color5" ||
    rawKey === "color6"
  ) {
    return rawKey
  }

  return null
}

function hexToRgb(hex: string) {
  const sanitized = hex.replace("#", "")
  return {
    b: Number.parseInt(sanitized.slice(4, 6), 16),
    g: Number.parseInt(sanitized.slice(2, 4), 16),
    r: Number.parseInt(sanitized.slice(0, 2), 16),
  }
}

function relativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  const channels = [r, g, b].map((value) => {
    const normalized = value / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function contrastRatio(left: string, right: string) {
  const luminanceLeft = relativeLuminance(left)
  const luminanceRight = relativeLuminance(right)
  const lighter = Math.max(luminanceLeft, luminanceRight)
  const darker = Math.min(luminanceLeft, luminanceRight)
  return (lighter + 0.05) / (darker + 0.05)
}

function pickBubbleText(
  background: string,
  options?: {
    preferLight?: boolean
  }
) {
  if (options?.preferLight && contrastRatio(background, "#ffffff") >= 3.35) {
    return "#ffffff"
  }

  return pickReadableText(background)
}

function pickReadableText(background: string) {
  return contrastRatio(background, "#ffffff") >= contrastRatio(background, "#000000")
    ? "#ffffff"
    : "#000000"
}

function isDarkHex(hex: string) {
  return relativeLuminance(hex) < 0.34
}

function mix(base: string, tint: string, tintPercent: number) {
  const basePercent = 100 - tintPercent
  return `color-mix(in oklab, ${base} ${basePercent}%, ${tint} ${tintPercent}%)`
}
