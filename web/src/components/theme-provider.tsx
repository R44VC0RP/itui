/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

import {
  BUILTIN_APP_THEMES,
  type AppThemePreset,
  DEFAULT_APP_THEME_ID,
  deriveAppTheme,
  findBuiltinTheme,
  createImportedTheme,
  parseColorsToml,
  IMPORTED_APP_THEME_ID,
} from "@/lib/app-theme"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: string
  storageKey?: string
  disableTransitionOnChange?: boolean
}

type ThemeProviderState = {
  activeTheme: AppThemePreset
  clearImportedTheme: () => void
  importThemeFile: (file: File) => Promise<void>
  importedTheme: AppThemePreset | null
  setTheme: (themeId: string) => void
  themeId: string
  themes: AppThemePreset[]
}

type StoredThemeState = {
  importedTheme: AppThemePreset | null
  themeId: string
}

const ThemeProviderContext = React.createContext<
  ThemeProviderState | undefined
>(undefined)

function disableTransitionsTemporarily() {
  const style = document.createElement("style")
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;transition:none!important}"
    )
  )
  document.head.appendChild(style)

  return () => {
    window.getComputedStyle(document.body)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        style.remove()
      })
    })
  }
}

function getLegacyThemeId(value: string) {
  if (value === "dark") {
    return "classic:night"
  }

  if (value === "light") {
    return "classic:day"
  }

  if (value === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "classic:night"
      : "classic:day"
  }

  return null
}

function isStoredImportedTheme(value: unknown): value is AppThemePreset {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Partial<AppThemePreset>
  return (
    candidate.group === "imported" &&
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.palette === "object" &&
    candidate.palette != null
  )
}

function readStoredThemeState(
  storageKey: string,
  defaultTheme: string
): StoredThemeState {
  const storedTheme = localStorage.getItem(storageKey)
  if (!storedTheme) {
    return { importedTheme: null, themeId: defaultTheme }
  }

  const legacyThemeId = getLegacyThemeId(storedTheme)
  if (legacyThemeId) {
    return { importedTheme: null, themeId: legacyThemeId }
  }

  try {
    const parsed = JSON.parse(storedTheme) as Partial<StoredThemeState>
    const importedTheme = isStoredImportedTheme(parsed.importedTheme)
      ? parsed.importedTheme
      : null
    const themeId =
      typeof parsed.themeId === "string" && parsed.themeId.length > 0
        ? parsed.themeId
        : defaultTheme

    return { importedTheme, themeId }
  } catch {
    return { importedTheme: null, themeId: defaultTheme }
  }
}

function persistThemeState(
  storageKey: string,
  nextState: StoredThemeState
) {
  localStorage.setItem(storageKey, JSON.stringify(nextState))
}

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_APP_THEME_ID,
  storageKey = "theme",
  disableTransitionOnChange = true,
}: ThemeProviderProps) {
  const [{ importedTheme, themeId }, setThemeState] =
    React.useState<StoredThemeState>(() =>
      readStoredThemeState(storageKey, defaultTheme)
    )

  const themes = React.useMemo(
    () =>
      importedTheme
        ? [...BUILTIN_APP_THEMES, importedTheme]
        : BUILTIN_APP_THEMES,
    [importedTheme]
  )

  const activeTheme =
    themes.find((theme) => theme.id === themeId) ??
    importedTheme ??
    findBuiltinTheme(defaultTheme) ??
    BUILTIN_APP_THEMES[0]

  const setTheme = React.useCallback(
    (nextThemeId: string) => {
      setThemeState((currentState) => {
        const resolvedThemeId =
          nextThemeId === IMPORTED_APP_THEME_ID && currentState.importedTheme == null
            ? defaultTheme
            : nextThemeId
        const nextState = {
          ...currentState,
          themeId: resolvedThemeId,
        }
        persistThemeState(storageKey, nextState)
        return nextState
      })
    },
    [defaultTheme, storageKey]
  )

  const clearImportedTheme = React.useCallback(() => {
    setThemeState((currentState) => {
      const nextState = {
        importedTheme: null,
        themeId:
          currentState.themeId === IMPORTED_APP_THEME_ID
            ? defaultTheme
            : currentState.themeId,
      }
      persistThemeState(storageKey, nextState)
      return nextState
    })
  }, [defaultTheme, storageKey])

  const importThemeFile = React.useCallback(
    async (file: File) => {
      const contents = await file.text()
      const importedPalette = parseColorsToml(contents)
      const nextImportedTheme = createImportedTheme(file.name, importedPalette)

      setThemeState(() => {
        const nextState = {
          importedTheme: nextImportedTheme,
          themeId: nextImportedTheme.id,
        }
        persistThemeState(storageKey, nextState)
        return nextState
      })
    },
    [storageKey]
  )

  const applyTheme = React.useCallback(
    (theme: AppThemePreset) => {
      const root = document.documentElement
      const { cssVariables, mode } = deriveAppTheme(theme.palette)
      const restoreTransitions = disableTransitionOnChange
        ? disableTransitionsTemporarily()
        : null

      root.classList.remove("light", "dark")
      root.classList.add(mode)
      root.style.colorScheme = mode
      root.dataset.appTheme = theme.id

      for (const [key, value] of Object.entries(cssVariables)) {
        root.style.setProperty(key, value)
      }

      if (restoreTransitions) {
        restoreTransitions()
      }
    },
    [disableTransitionOnChange]
  )

  React.useEffect(() => {
    applyTheme(activeTheme)
  }, [activeTheme, applyTheme])

  React.useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || event.key !== storageKey) {
        return
      }

      setThemeState(readStoredThemeState(storageKey, defaultTheme))
    }

    window.addEventListener("storage", handleStorageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [defaultTheme, storageKey])

  const value = React.useMemo(
    () => ({
      activeTheme,
      clearImportedTheme,
      importThemeFile,
      importedTheme,
      setTheme,
      themeId: activeTheme.id,
      themes,
    }),
    [
      activeTheme,
      clearImportedTheme,
      importThemeFile,
      importedTheme,
      setTheme,
      themes,
    ]
  )

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export function useAppTheme() {
  const context = React.useContext(ThemeProviderContext)
  if (context === undefined) {
    throw new Error("useAppTheme must be used within a ThemeProvider")
  }

  return context
}
