# Project Instructions

## Scope and source of truth

This repository contains the Neowise incoming-request triage exercise. Use `README.md` as the acceptance criteria. The Russian plan in `_docs/implementation-plan.md` records the implementation approach and verification criteria.

## Architecture and commands

- Runtime: Node.js 20 or newer, using ES modules and built-in APIs. There is no package manifest or dependency installation step.
- `server.mjs` serves the page and handles `POST /api/triage` using `node:http`.
- `index.html` contains the Russian manager-facing interface, styles, and browser JavaScript.
- `mock-ai.mjs` exports `classify(text, { signal })` and returns a JSON string. Preserve this supplied simulator and all its failure scenarios unchanged.
- Start the application with `node server.mjs`. The default address is `http://127.0.0.1:3000`; `PORT` overrides the port.
- `HOST` overrides the server's bind address. The Docker image sets it to `0.0.0.0`, runs as the `node` user, and listens on container port 3000.
- Start the container with `docker compose up --build -d` and stop it with `docker compose down`. Compose publishes the port on host loopback only; `PORT` overrides the host port. Rebuild after source changes.
- The Docker build context uses an allowlist in `.dockerignore`, and the Dockerfile copies application files explicitly. Update both when adding files needed inside the container, including future tests.
- Keep the implementation within the existing server and page unless a small supporting file is needed. Use built-in Node.js testing tools for new tests.
- `createApp` in `server.mjs` creates an HTTP server without binding a port; direct execution starts the application. Run regression tests with `node --test test/triage.test.mjs`, or build the image and run `docker compose run --rm --no-deps app node --test test/triage.test.mjs`.

## Required behavior

- Accept a JSON object with a string `text` containing at least one non-whitespace character. Malformed JSON and invalid input return HTTP 400 with exactly `{"status":"invalid_input"}`. Do not call the model for invalid input.
- Limit model waiting time to 300 ms. Use the simulator's existing abort-signal support and clean up timers after completion.
- Validate the parsed model response before using it. Only `delivery`, `pricing`, and `other` are valid topics; `draft` must be a non-whitespace string.
- A valid model result returns HTTP 200 with `status: "ready"`, `topic`, and `draft`. Construct the response from validated fields rather than spreading the model output.
- Model errors, timeouts, malformed model JSON, and invalid model responses return HTTP 200 with exactly `{"status":"manual_review","topic":null,"draft":null}`.
- Keep input validation failures separate from model failures. Preserve meaningful handling of unexpected server errors.
- Display the topic and draft on success. On manual review, clear the previous result and show an actionable Russian message. Handle invalid input and network failures visibly.
- Render model content as text, preserving the page's accessible result announcement. The manager reviews the draft and decides what to send; do not add automatic sending.

## Validation and documentation

GitHub Actions runs Node.js 20/22/24 tests, Docker regression tests, and published-port checks through `scripts/smoke.mjs`. Only successful `main` runs publish the verified image to GHCR. Keep publication permissions limited to the publication job and pin action versions to commit SHAs. Deployment to a server is not configured.

Add executable regression coverage for failure behavior and document the actual test command in `README.md`. Cover the simulator markers `[timeout]`, `[error]`, `[bad-json]`, `[bad-topic]`, and `[empty-draft]`, along with valid and invalid requests. HTTP tests must clean up any server processes they start. Allow scheduling and transport overhead in timeout assertions while distinguishing the deadline from the simulator's full delay.

Manually verify that a successful result followed by a failure removes the old draft. Report checks actually performed and any remaining gaps.

Write project instructions and code comments in English. Preserve Russian manager-facing copy and the explicitly requested Russian plan in `_docs`.
