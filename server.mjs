import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { classify } from "./mock-ai.mjs";

const html = await readFile(new URL("./index.html", import.meta.url));

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function handleTriage(request, response) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  let input;
  try {
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return json(response, 400, { status: "invalid_input" });
  }
  if (!input || Array.isArray(input) || typeof input.text !== "string" || !input.text.trim()) {
    return json(response, 400, { status: "invalid_input" });
  }

  const controller = new AbortController();
  let timer;
  let result;
  try {
    const output = await Promise.race([
      classify(input.text, { signal: controller.signal }),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("Model deadline exceeded"));
        }, 300);
      }),
    ]);
    result = JSON.parse(output);
    if (
      !result || Array.isArray(result) ||
      !["delivery", "pricing", "other"].includes(result.topic) ||
      typeof result.draft !== "string" || !result.draft.trim()
    ) {
      result = null;
    }
  } catch {
    // Provider failures and untrusted output require a manager's review.
    result = null;
  } finally {
    clearTimeout(timer);
  }

  if (!result) {
    return json(response, 200, { status: "manual_review", topic: null, draft: null });
  }
  return json(response, 200, { status: "ready", topic: result.topic, draft: result.draft });
}

export function createApp() {
  return createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(html);
      return;
    }
    if (request.method !== "POST" || request.url !== "/api/triage") {
      return json(response, 404, { status: "not_found" });
    }
    try {
      await handleTriage(request, response);
    } catch {
      json(response, 500, { status: "server_error" });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createApp().listen(Number(process.env.PORT || 3000), process.env.HOST || "127.0.0.1");
}
