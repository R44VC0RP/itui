import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const proxyTarget = env.VITE_IMSG_PROXY_TARGET?.trim()

  return {
    plugins: [react(), tailwindcss()],
    preview: proxyTarget
      ? {
          proxy: {
            "/api": {
              changeOrigin: true,
              secure: false,
              target: proxyTarget,
            },
          },
        }
      : undefined,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    test: {
      environment: "node",
    },
    server: proxyTarget
      ? {
          proxy: {
            "/api": {
              changeOrigin: true,
              secure: false,
              target: proxyTarget,
            },
          },
        }
      : undefined,
  }
})
