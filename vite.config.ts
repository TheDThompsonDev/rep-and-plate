import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createApi, readConfig } from "./server/http.ts";
import { handlePreview } from "./server/preview-node.ts";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: "fuel-local-api",
      configureServer(server) {
        const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };
        server.middlewares.use((req, res, next) => {
          void handlePreview(req, res, env).then(handled => { if (!handled) next(); }).catch(next);
        });
        server.middlewares.use(
          createApi(
            readConfig({ ...process.env, ...loadEnv(mode, process.cwd(), "") }),
          ),
        );
      },
      configurePreviewServer(server) {
        const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };
        server.middlewares.use((req, res, next) => {
          void handlePreview(req, res, env).then(handled => { if (!handled) next(); }).catch(next);
        });
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
