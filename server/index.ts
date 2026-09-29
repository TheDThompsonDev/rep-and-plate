import "dotenv/config";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { createApi, readConfig } from "./http.ts";
import { handlePreview } from "./preview-node.ts";

const api = createApi(readConfig(process.env));
const root = resolve("dist");
const types: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
createServer(async (req, res) => {
  if (await handlePreview(req, res, process.env)) return;
  void api(req, res, () => {
    void (async () => {
      try {
        const pathname = decodeURIComponent(
          new URL(req.url ?? "/", "http://localhost").pathname,
        );
        if (req.method !== "GET" && req.method !== "HEAD") {
          res.writeHead(405).end();
          return;
        }
        const file = resolve(
          root,
          pathname === "/" ? "index.html" : `.${pathname}`,
        );
        if (
          !file.startsWith(root + sep) ||
          pathname.split("/").some((p) => p.startsWith("."))
        ) {
          res.writeHead(404).end();
          return;
        }
        const metadata = await stat(file);
        if (!metadata.isFile()) {
          res.writeHead(404).end();
          return;
        }
        res.setHeader(
          "Content-Type",
          types[extname(file)] ?? "application/octet-stream",
        );
        res.setHeader("X-Content-Type-Options", "nosniff");
        if (req.method === "HEAD") res.end();
        else createReadStream(file).pipe(res);
      } catch {
        res.writeHead(404).end("Not found");
      }
    })();
  });
}).listen(Number(process.env.PORT ?? 5173), "127.0.0.1", () =>
  console.log("Rep & Plate server ready on the local loopback interface."),
);
