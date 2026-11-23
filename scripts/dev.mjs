import { createServer } from "node:http";
import { resolve } from "node:path";
import worker from "../worker/index.js";
import { LocalBucket } from "./local-bucket.mjs";

const port = Number(process.env.PORT || 8000);
const origin = "http://127.0.0.1:" + port;
const localAdmin = process.env.PORTFOLIO_LOCAL_ADMIN !== "0";
const env = {
  BUCKET: new LocalBucket(resolve(process.env.PORTFOLIO_DATA_DIR || "work/local-data")),
  PORTFOLIO_ADMIN_EMAIL: "local-admin@example.test",
  LOCAL_PREVIEW: "1", OWNER_AUTHENTICATED: localAdmin
};
const server = createServer(async (incoming, outgoing) => {
  try {
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (!name.startsWith("oai-") && value) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
    }
    if (localAdmin) {
      headers.set("oai-authenticated-user-id", "local-preview-owner");
      headers.set("oai-authenticated-user-email", env.PORTFOLIO_ADMIN_EMAIL);
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of incoming) {
      size += chunk.length;
      if (size > 13 * 1024 * 1024) { outgoing.writeHead(413); outgoing.end("Request too large"); return; }
      chunks.push(chunk);
    }
    const request = new Request(origin + incoming.url, { method: incoming.method, headers, ...(size ? { body: Buffer.concat(chunks) } : {}) });
    const result = await worker.fetch(request, env);
    outgoing.writeHead(result.status, Object.fromEntries(result.headers));
    outgoing.end(Buffer.from(await result.arrayBuffer()));
  } catch (error) { console.error(error.message); outgoing.writeHead(500); outgoing.end("Local preview error"); }
});
server.listen(port, "127.0.0.1", () => {
  console.log(`Portfolio: ${origin}\nAdmin: ${origin}/admin\nLocal records are separate from the published site. Local admin: ${localAdmin}.`);
});
