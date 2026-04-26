import { describe, expect, it } from "vitest"

import {
  BUILTIN_APP_THEMES,
  createImportedTheme,
  deriveAppTheme,
  parseColorsToml,
  serializeColorsToml,
  themeTomlFileName,
} from "@/lib/app-theme"

describe("app theme helpers", () => {
  it("parses Omarchy-style colors.toml files", () => {
    const palette = parseColorsToml(`
accent = "#7aa2f7"
foreground = "#a9b1d6"
background = "#1a1b26"
selection_background = "#7aa2f7"
selection_foreground = "#c0caf5"
color1 = "#f7768e"
color2 = "#9ece6a"
color3 = "#e0af68"
color4 = "#7aa2f7"
color5 = "#ad8ee6"
color6 = "#449dab"
`)

    expect(palette.accent).toBe("#7aa2f7")
    expect(palette.selectionBackground).toBe("#7aa2f7")
    expect(palette.color6).toBe("#449dab")
  })

  it("derives dark-mode variables from dark backgrounds", () => {
    const derived = deriveAppTheme({
      accent: "#7aa2f7",
      background: "#1a1b26",
      foreground: "#a9b1d6",
      color2: "#9ece6a",
      color6: "#449dab",
    })

    expect(derived.mode).toBe("dark")
    expect(derived.cssVariables["--primary"]).toBe("#7aa2f7")
    expect(derived.cssVariables["--message-rcs"]).toBe("#449dab")
  })

  it("derives light-mode variables from light backgrounds", () => {
    const derived = deriveAppTheme({
      accent: "#1e66f5",
      background: "#eff1f5",
      foreground: "#4c4f69",
      color2: "#40a02b",
      color6: "#179299",
    })

    expect(derived.mode).toBe("light")
    expect(derived.cssVariables["--message-sms"]).toBe("#40a02b")
  })

  it("derives readable bubble foregrounds for light transport colors", () => {
    const derived = deriveAppTheme({
      accent: "#e7f1ff",
      background: "#0f1720",
      foreground: "#f8fbff",
      color2: "#bcf7c5",
      color6: "#c8f2ff",
    })

    expect(derived.cssVariables["--message-imessage-foreground"]).toBe("#000000")
    expect(derived.cssVariables["--message-sms-foreground"]).toBe("#000000")
    expect(derived.cssVariables["--message-rcs-foreground"]).toBe("#000000")
  })

  it("keeps iMessage bubbles white on saturated blue accents", () => {
    const derived = deriveAppTheme({
      accent: "#2482e7",
      background: "#111821",
      foreground: "#f8fbff",
      color2: "#bcf7c5",
      color6: "#c8f2ff",
    })

    expect(derived.cssVariables["--message-imessage-foreground"]).toBe("#ffffff")
  })

  it("creates friendly imported theme names from filenames", () => {
    expect(createImportedTheme("tokyo-night.toml", parseColorsToml(`
accent = "#7aa2f7"
foreground = "#a9b1d6"
background = "#1a1b26"
`)).name).toBe("Tokyo Night")

    expect(createImportedTheme("colors.toml", parseColorsToml(`
accent = "#7aa2f7"
foreground = "#a9b1d6"
background = "#1a1b26"
`)).name).toBe("Imported Theme")
  })

  it("serializes the current palette back into a colors.toml file", () => {
    const palette = parseColorsToml(`
accent = "#7aa2f7"
foreground = "#a9b1d6"
background = "#1a1b26"
selection_background = "#7aa2f7"
selection_foreground = "#c0caf5"
color1 = "#f7768e"
color2 = "#9ece6a"
color3 = "#e0af68"
color4 = "#7aa2f7"
color5 = "#ad8ee6"
color6 = "#449dab"
`)

    expect(parseColorsToml(serializeColorsToml(palette))).toEqual(palette)
  })

  it("generates useful colors.toml filenames for built-in and imported themes", () => {
    const tokyoNight = BUILTIN_APP_THEMES.find(
      (theme) => theme.id === "omarchy:tokyo-night"
    )

    expect(tokyoNight).toBeTruthy()
    expect(themeTomlFileName(tokyoNight!)).toBe("tokyo-night.toml")

    expect(
      themeTomlFileName(
        createImportedTheme(
          "my-custom-theme.toml",
          parseColorsToml(`
accent = "#7aa2f7"
foreground = "#a9b1d6"
background = "#1a1b26"
`)
        )
      )
    ).toBe("my-custom-theme.toml")
  })

  it("ships official Omarchy presets alongside the built-in classic themes", () => {
    expect(BUILTIN_APP_THEMES.some((theme) => theme.id === "classic:night")).toBe(true)
    expect(BUILTIN_APP_THEMES.some((theme) => theme.id === "omarchy:tokyo-night")).toBe(true)
  })
})
