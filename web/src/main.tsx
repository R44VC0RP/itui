import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { NuqsAdapter } from "nuqs/adapters/react"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { DEFAULT_APP_THEME_ID } from "@/lib/app-theme.ts"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <NuqsAdapter>
      <ThemeProvider
        defaultTheme={DEFAULT_APP_THEME_ID}
        storageKey="itui-web-theme"
      >
        <App />
      </ThemeProvider>
    </NuqsAdapter>
  </StrictMode>
)
