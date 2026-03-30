import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const baseUrl =
  ((import.meta as any)?.env?.VITE_BASE_URL as string | undefined) ||
  process.env.VITE_BASE_URL ||
  "/co-authorship/"

export default defineConfig({
  base: baseUrl,
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
