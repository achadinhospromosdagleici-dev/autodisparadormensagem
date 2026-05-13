import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // Local proxy to replace Supabase Edge Functions during dev
    {
      name: "local-proxy",
      configureServer(server) {
        server.middlewares.use("/api/proxy", async (req, res, next) => {
          if (req.method !== "POST") return next();
          let raw = "";
          req.on("data", (chunk) => (raw += chunk));
          req.on("end", async () => {
            try {
              const { baseUrl, token, endpoint, method, body } = JSON.parse(raw);
              const target =
                baseUrl.replace(/\/$/, "") +
                (endpoint?.startsWith("/") ? endpoint : "/" + (endpoint || "sessions"));
              const resp = await fetch(target, {
                method: method || "GET",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: token,
                },
                body: body && method !== "GET" ? JSON.stringify(body) : undefined,
              });
              const data = resp.headers.get("content-type")?.includes("json")
                ? await resp.json()
                : { text: await resp.text() };
              res.writeHead(resp.ok ? 200 : resp.status, {
                "Content-Type": "application/json",
              });
              res.end(JSON.stringify(data));
            } catch (e: any) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: e.message }));
            }
          });
        });
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
