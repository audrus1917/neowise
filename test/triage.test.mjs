import assert from "node:assert/strict";
import { once } from "node:events";
import { after, before, test } from "node:test";
import { createApp } from "../server.mjs";

const server = createApp();
let base;

before(async () => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
});

async function post(body) {
  return fetch(`${base}/api/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(3000),
  });
}

test("serves the page", async () => {
  const reply = await fetch(base);
  assert.equal(reply.status, 200);
  assert.match(reply.headers.get("content-type"), /text\/html/);
  assert.match(await reply.text(), /aria-live="polite"/);
});

for (const [topic, text] of [
  ["delivery", "Где доставка?"],
  ["pricing", "Уточните стоимость"],
  ["other", "Здравствуйте"],
]) {
  test(`ready: ${topic}`, async () => {
    const reply = await post(JSON.stringify({ text }));
    assert.equal(reply.status, 200);
    const body = await reply.json();
    assert.deepEqual(Object.keys(body).sort(), ["draft", "status", "topic"]);
    assert.equal(body.status, "ready");
    assert.equal(body.topic, topic);
    assert.equal(typeof body.draft, "string");
    assert.ok(body.draft.trim());
  });
}

for (const [name, body] of [
  ["malformed JSON", "{"],
  ["empty body", ""],
  ["null", "null"],
  ["array", "[]"],
  ["number", "42"],
  ["boolean", "true"],
  ["string", '"hello"'],
  ["missing text", "{}"],
  ["null text", '{"text":null}'],
  ["numeric text", '{"text":42}'],
  ["boolean text", '{"text":true}'],
  ["array text", '{"text":[]}'],
  ["object text", '{"text":{}}'],
  ["empty text", '{"text":""}'],
  ["whitespace text", JSON.stringify({ text: " \t\n " })],
]) {
  test(`invalid: ${name}`, async () => {
    const reply = await post(body);
    assert.equal(reply.status, 400);
    assert.deepEqual(await reply.json(), { status: "invalid_input" });
  });
}

for (const marker of ["error", "bad-json", "bad-topic", "empty-draft", "timeout"]) {
  test(`manual review: ${marker}`, async () => {
    const start = performance.now();
    const reply = await post(JSON.stringify({ text: `[${marker}]` }));
    assert.equal(reply.status, 200);
    assert.deepEqual(await reply.json(), { status: "manual_review", topic: null, draft: null });
    if (marker === "timeout") {
      const elapsed = performance.now() - start;
      assert.ok(elapsed >= 250, `Timeout returned too early: ${elapsed} ms`);
      assert.ok(elapsed < 1000, `Timeout exceeded its budget: ${elapsed} ms`);
    }
    const next = await post(JSON.stringify({ text: "Здравствуйте" }));
    assert.equal(next.status, 200);
    assert.equal((await next.json()).status, "ready");
  });
}
