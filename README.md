# Тестовое Neowise. AI-помощник для входящих заявок

Ориентир — 45–60 минут. Менеджер вводит текст заявки, получает тему и черновик ответа. Он читает результат и сам решает, что отправить клиенту.

## Запуск

В репозитории есть сервер, HTML-страница и имитатор модели. Нужен Node.js 20 или новее. Зависимостей и ключей нет.

```sh
node server.mjs
```

Откройте http://127.0.0.1:3000. Порт можно задать через переменную `PORT`.

### Docker Compose

With Docker Engine and the Compose plugin installed, run:

```sh
docker compose up --build -d
```

Open http://127.0.0.1:3000. To use another host port, run
`PORT=3001 docker compose up --build -d` and open http://127.0.0.1:3001.
The container listens on `0.0.0.0:3000`; the published port is restricted to
the host's loopback interface. Direct Node.js startup still defaults to
`127.0.0.1`; set `HOST` to override its bind address.

Check the running application:

```sh
curl --fail http://127.0.0.1:3000/
curl --fail --json '{"text":"Delivery question"}' http://127.0.0.1:3000/api/triage
```

View logs with `docker compose logs app`. Stop and remove the container with
`docker compose down`. Rebuild after changing application files; the image
contains a copy of the source and does not mount the working directory.

## Implementation and tests

The API validates input before calling the simulator. It validates the model's
JSON, topic, and draft in `handleTriage` in `server.mjs`, then builds the response
from the validated fields. Model errors, invalid output, and the 300 ms deadline
produce `manual_review`; invalid requests produce HTTP 400 with `invalid_input`.
The deadline races the model call against a timer, aborts the simulator on
timeout, and clears the timer on completion. The supplied simulator is unchanged.

The page displays a Russian topic label and draft. It clears previous results
when submitting a request and shows a manual-processing message on model failure.
It also handles invalid input and network errors, disables duplicate submissions
while a request is pending, and renders model text with `textContent`.

Run the HTTP regression tests locally:

```sh
node --test test/triage.test.mjs
```

Or run them inside the image:

```sh
docker compose build app
docker compose run --rm --no-deps app node --test test/triage.test.mjs
```

Tests start their own server on an automatically assigned local port, close it
afterwards, and do not require a running application. They cover the page, all
three topics, invalid inputs, and all five simulator failure markers, including
the timeout and a successful request after each failure. The exported `createApp`
factory allows isolated HTTP tests without changing command-line startup.

For a browser check, submit a normal request, then each failure marker listed
below. Confirm that each failure removes the previous draft and offers manual
processing. Also check blank input, network failure, and button recovery.

The manager benefits from spending less time preparing the first response;
measure the average time from opening a request to a reviewed draft.

## GitHub Actions CI/CD

The workflow in `.github/workflows/ci.yml` runs on pushes to any branch,
pull requests, and manual runs from the Actions tab:

- Run the HTTP regression suite on Node.js 20, 22, and 24.
- Validate Compose configuration, build the Docker image, and run the same
  regression suite inside it.
- Start the container and check the published port: HTML, a successful request,
  invalid input, and manual review after a model timeout. The container is removed
  afterwards, including when a check fails.
- After all checks pass on `main`, publish the verified image to GHCR as
  `ghcr.io/audrus1917/neowise:sha-<full-commit-sha>` and
  `ghcr.io/audrus1917/neowise:latest`. Other branches and pull requests do not publish.

The image is transferred between jobs as a short-lived artifact; publication
uses the exact image that passed the container checks. The workflow calculates
the registry path from the repository name, so forks publish to their own namespace.
Only the publication job has `packages: write`. Authentication uses the automatic
`GITHUB_TOKEN`, following the [GitHub container publishing documentation](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images);
no personal token needs to be added to repository secrets. Actions are pinned
to commit SHAs.

Ensure Actions and package publication are permitted by the repository or
organization settings. An existing GHCR package may need to grant the repository
Actions access. Package visibility is managed separately in GitHub Packages;
a private package requires authentication when pulling it.

To repeat the published-port checks locally after starting the application:

```sh
node scripts/smoke.mjs
```

An optional URL argument checks another host port, for example
`node scripts/smoke.mjs http://127.0.0.1:3001`.

CD delivers a container image to the registry. Deploying it to a server requires
a deployment destination and is not configured here. Workflow execution begins
after these files are committed and pushed to GitHub; a local test does not
verify registry permissions or remote publication.

## Что изменить

1. Доработайте `POST /api/triage`. Принимайте JSON с полем `text`, содержащим непустую строку. При пустом, отсутствующем, нестроковом вводе или битом JSON верните HTTP 400 и `{"status":"invalid_input"}`.
2. При корректном ответе модели верните HTTP 200 и `{"status":"ready","topic":"…","draft":"…"}`. Допустимые темы — `delivery`, `pricing`, `other`. Черновик должен быть непустой строкой. При таймауте, ошибке модели или неподходящем ответе верните HTTP 200 и `{"status":"manual_review","topic":null,"draft":null}`. Ограничьте ожидание модели 300 мс. Оставьте поведение выданного имитатора прежним.
3. Покажите на странице тему и черновик при успехе. Для `manual_review` покажите понятное сообщение менеджеру и очистите предыдущий черновик. Добавьте хотя бы один исполнимый тест для поведения при сбое и инструкцию его запуска.

Для локальной проверки имитатор принимает любой обычный текст. Метки `[timeout]`, `[error]`, `[bad-json]`, `[bad-topic]`, `[empty-draft]` включают отдельные сценарии сбоя.

## Что прислать в бота

- Ссылку на pull request и SHA проверяемого коммита. Можно использовать свой учебный репозиторий. Сохраните начальный код первым коммитом, затем откройте PR из отдельной ветки.
- Короткую инструкцию запуска и прогона теста. В описании PR ответьте, где проверяется результат AI, что происходит при сбое, какой AI вы использовали и что проверили самостоятельно. Если работали без AI, укажите это.
- Одну фразу о том, какую пользу задача даёт менеджеру и как её можно измерить.

После сдачи бот может задать один-два коротких вопроса по вашему коду. Используйте учебные данные. Если не уложились по времени, отметьте незавершённые части в PR.
