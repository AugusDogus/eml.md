# eml.md

Offline React SPA for converting `.eml` email files into clean Markdown using `postal-mime` in the browser.

## Commands

```bash
bun install
bun --bun run dev
bun --bun run build
bun --bun run test
```

## Architecture

- Router-only TanStack app, not a TanStack Start server app.
- File-based routes live in `src/routes`.
- Tailwind CSS is enabled through `@tailwindcss/vite`.
- `.eml` files are parsed locally with `postal-mime`.
- Conversion output focuses on the conversation body, with light participant labels for readability.
- TanStack Query is available through the root `QueryClientProvider`.
- tRPC is installed for future typing/integration work, but there is no HTTP transport or backend.

## Privacy

Email contents never leave the device. The app does not include a backend, API route, server function, database, or remote parser.

## Deployment

Run `bun --bun run build` and deploy the static output to any static host. Configure the host to fall back to `index.html` for client-side routes.

No environment variables are required.
