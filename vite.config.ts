import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createApi, readConfig } from "./server/http.ts";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: "fuel-local-api",
      configureServer(server) {
        server.middlewares.use(
          createApi(
            readConfig({ ...process.env, ...loadEnv(mode, process.cwd(), "") }),
          ),
        );
      },
      configurePreviewServer(server) {
        server.middlewares.use(
          createApi(
            readConfig({ ...process.env, ...loadEnv(mode, process.cwd(), "") }),
          ),
        );
      },
    },
  ],
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
}));
