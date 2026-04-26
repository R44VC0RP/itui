# `web/`

This is the browser client source for the `itui` fork.

The Swift server keeps serving the application at runtime. This workspace exists to:

- author the browser UI in Vite + React + TypeScript
- use shadcn/ui as the design system and component source
- compile the app into static assets
- copy those assets back into `../Sources/imsg/Resources/web/` so `imsg serve` stays a single runtime service

The current direction is intentionally shadcn-first:

- no AI SDK in the baseline client
- no AI Elements dependency in the baseline client
- no markdown-heavy message renderer in the baseline client
- keep the default surface focused on feeling like a messaging app, not an AI chat demo

## Requirements

- Node.js `20.19+`
- npm

These are only required to work on `web/` itself. Running the bundled browser
app through `imsg serve` does not require Node.js/npm on the target Mac if the
checked-in assets are already current.

## Install

```bash
cd web
npm install
```

## Develop

For the bundled browser app served by Swift, use:

```bash
make web-serve
```

That builds `web/`, copies the generated bundle into
`../Sources/imsg/Resources/web/`, builds debug `imsg`, and serves
`http://127.0.0.1:13197`.

For live frontend development, run the Swift backend separately:

```bash
swift build -c debug --product imsg
./.build/debug/imsg serve --host 127.0.0.1 --port 13197
```

That path serves the bundled frontend copied into
`../Sources/imsg/Resources/web/`, not live `web/src` source.

Then start the Vite dev server:

```bash
make web-dev
```

Or directly:

```bash
cd web
npm run dev
```

If `imsg serve` is running on another host or port during development, point Vite
at it before starting the dev server:

```bash
cd web
cp .env.example .env.local
```

Then set `VITE_IMSG_PROXY_TARGET` in `.env.local`, for example:

```bash
VITE_IMSG_PROXY_TARGET=http://127.0.0.1:13197
```

If the backend is running on another Mac, either point this to the tailnet/LAN
host directly or tunnel it first:

```bash
ssh -L 13197:127.0.0.1:13197 user@your-hostname
VITE_IMSG_PROXY_TARGET=http://127.0.0.1:13197
```

## Bundle Into `imsg`

```bash
make web-build
```

That runs `../scripts/build-web.sh`, which:

- builds `web/dist`
- preserves `../Sources/imsg/Resources/web/debug.html`
- replaces the rest of `../Sources/imsg/Resources/web/` with the generated frontend bundle

`../Sources/imsg/Resources/web/` should be treated as generated output, not hand-authored source.

If you are testing the browser through `imsg serve`, re-run `make web-build`
after frontend changes. If you are testing through Vite, you do not need to
rebuild the Swift bundle each time.
