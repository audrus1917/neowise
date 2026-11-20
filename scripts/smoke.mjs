import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

const base = process.argv[2] || "http://127.0.0.1:3000";

// Container startup is asynchronous; only the readiness check is retried.
let page;
for (let attempt = 0; attempt < 40; attempt++) {
  try {
    page = await fetch(base, { signal: AbortSignal.timeout(1000) });
    break;
  } catch (error) {
    if (attempt === 39) throw error;
    await delay(250);
  }
}
assert.equal(page.status, 200);
assert.match(page.headers.get("content-type"), /text\/html/);
assert.match(await page.text(), /id="message"/);
console.log("PASS: application HTML through published port");

for (const [name, body, status, expected] of [
  ["ready", { text: "Уточните доставку" }, 200, { status: "ready", topic: "delivery" }],
  ["invalid input", { text: "  " }, 400, { status: "invalid_input" }],
  ["model timeout", { text: "[timeout]" }, 200, { status: "manual_review", topic: null, draft: null }],
]) {
  const reply = await fetch(new URL("/api/triage", base), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(3000),
  });
  assert.equal(reply.status, status);
  const result = await reply.json();
  if (name === "ready") {
    assert.equal(typeof result.draft, "string");
    assert.ok(result.draft.trim());
    assert.deepEqual(result, { ...expected, draft: result.draft });
  } else {
    assert.deepEqual(result, expected);
  }
  console.log(`PASS: ${name} through published port`);
}
