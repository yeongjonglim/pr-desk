import { execFile } from "node:child_process";
import { promisify } from "node:util";
import react from "@vitejs/plugin-react";
import { defineConfig, type Connect, type Plugin } from "vite";

const run = promisify(execFile);

const ip = (addr: string | undefined) => (addr ?? "").replace(/^::ffff:/, "");
const isLoopback = (addr: string) => addr === "127.0.0.1" || addr === "::1";
// NetBird (like Tailscale) hands out addresses from the 100.64.0.0/10 shared range,
// which is only reachable through the mesh.
const isMesh = (addr: string) => {
  const [a, b] = addr.split(".").map(Number);
  return a === 100 && b >= 64 && b <= 127;
};

// The server listens on every interface so NetBird peers can reach it; this keeps
// everyone else (the LAN, a café's Wi-Fi) out.
function meshOnly(): Plugin {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const addr = ip(req.socket.remoteAddress);
    if (isLoopback(addr) || isMesh(addr)) return next();
    res.statusCode = 403;
    res.end("PR Desk only answers this machine and NetBird peers.");
  };
  return {
    name: "mesh-only",
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}

// Hands the page the token the gh CLI already holds, so there is nothing to sign in to.
// Only this machine gets it by default: the token can write to every repo you can, so
// other devices paste their own unless PR_DESK_SHARE_TOKEN=1.
function ghToken(): Plugin {
  const share = process.env.PR_DESK_SHARE_TOKEN === "1";
  const handler: Connect.NextHandleFunction = async (req, res, next) => {
    if (req.url !== "/api/token") return next();
    const addr = ip(req.socket.remoteAddress);
    // A custom header makes any cross-site fetch preflight, which Vite's CORS policy
    // refuses for non-localhost origins, so other sites can't read the token.
    if (req.headers["x-pr-desk"] !== "1" || !(isLoopback(addr) || (share && isMesh(addr)))) {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    try {
      const { stdout } = await run("gh", ["auth", "token"]);
      res.end(JSON.stringify({ token: stdout.trim() }));
    } catch {
      res.statusCode = 503;
      res.end(JSON.stringify({ error: "The gh CLI has no token. Run `gh auth login`, then reload." }));
    }
  };
  return {
    name: "gh-token",
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}

const server = { host: "0.0.0.0", allowedHosts: [".netbird.cloud", ".netbird.selfhosted"] };

export default defineConfig({
  plugins: [react(), meshOnly(), ghToken()],
  server: { ...server, port: 5173 },
  preview: { ...server, port: 4173 },
});
