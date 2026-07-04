import { Repo } from "../db/repo.ts";
import { handleApi } from "./api.ts";

const repo = new Repo();
const PORT = Number(process.env.PORT ?? 4747);

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const api = await handleApi({ repo }, req);
    if (api) return api;

    // static SPA hosting
    const url = new URL(req.url);
    let path = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(`public${path}`);
    if (await file.exists()) return new Response(file);
    // hash-router SPA: unknown paths fall back to index
    return new Response(Bun.file("public/index.html"));
  },
});

console.log(`Agent Eval Studio → http://localhost:${server.port}`);
