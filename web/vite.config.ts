import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const contracts = path.resolve(here, "../contracts");

// /api/state → GRAIL_STATE_PATH (agent'ın runtime/state.json'u) yoksa contracts/state.example.json (mock).
// /api/chain → GRAIL_CHAIN_PATH yoksa contracts/chain.json (henüz yoksa 404).
// Dosya her istekte yeniden okunur; UI birkaç saniyede bir yoklar.
function grailState(mode: string): Plugin {
  const env = { ...process.env, ...loadEnv(mode, here, "GRAIL_") };
  const statePath = env.GRAIL_STATE_PATH
    ? path.resolve(here, env.GRAIL_STATE_PATH)
    : mode === "demo"
      ? path.resolve(here, "fixtures/demo-state.json")
      : null;
  const chainPath = env.GRAIL_CHAIN_PATH ? path.resolve(here, env.GRAIL_CHAIN_PATH) : path.join(contracts, "chain.json");
  const mockPath = path.join(contracts, "state.example.json");

  const send = (res: import("node:http").ServerResponse, file: string, source: string) => {
    try {
      const body = fs.readFileSync(file, "utf8");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Grail-Source", source);
      res.end(body);
      return true;
    } catch {
      return false;
    }
  };

  const handler = (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse, next: () => void) => {
    const url = (req.url ?? "").split("?")[0];
    if (url === "/api/state") {
      if (statePath && send(res, statePath, mode === "demo" && !env.GRAIL_STATE_PATH ? "demo" : "live")) return;
      if (statePath) res.setHeader("X-Grail-Missing", statePath);
      if (send(res, mockPath, "mock")) return;
      res.statusCode = 404;
      res.end("{}");
      return;
    }
    if (url === "/api/chain") {
      if (send(res, chainPath, "chain")) return;
      // chain.json henüz yok (T-003): konsolu kırmızıya boğmamak için 200 + null
      res.setHeader("Content-Type", "application/json");
      res.end("null");
      return;
    }
    next();
  };

  return {
    name: "grail-state",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), grailState(mode)],
  server: { port: 5173, fs: { allow: [".."] } },
}));
