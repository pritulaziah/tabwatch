# Development

How to set up a development environment for TabWatch, run the checks, and
understand the code layout.

## Requirements

- Google Chrome 120 or later
- Node.js 22 or later with npm

## Setup

1. Clone the repository and open the project directory in a terminal.
2. Run `npm install`.

To load the extension into Chrome, follow the
[Installation](README.md#installation) section of the README.

## Commands

| Command | Effect |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Build the extension into `dist` |
| `npm test` | Run the test suite |
| `npm run typecheck` | Type-check the project with `tsc --noEmit` |
| `npm run lint` | Check the code with ESLint |
| `npm run format` | Rewrite the files with Prettier |
| `npm run format:check` | Report files that Prettier would rewrite |

Prettier owns the code style; the configuration is in `.prettierrc.json`.
Markdown files are not formatted by Prettier: they follow the repository
conventions of 80 columns and compact tables. ESLint owns the static
checks; the configuration is in `eslint.config.js`.

The continuous integration workflow in `.github/workflows/ci.yml` runs
`npm ci`, the formatting check, the lint, the type check, the tests, and
the build.

## TypeScript and ESLint

The type check runs on TypeScript 7. `typescript-eslint` still needs the
TypeScript 6 API, so the dependencies follow the side-by-side setup from
the TypeScript 7 release notes:

- `@typescript/native` is TypeScript 7 and provides the `tsc` binary.
- `typescript` is the `@typescript/typescript6` compatibility package,
  which re-exports the TypeScript 6 API and provides `tsc6`.

The two binaries do not conflict. Replace the aliases with plain
`typescript` when `typescript-eslint` supports TypeScript 7.

## Development loop

There is no hot reload for the popup or for the dashboard. After a change
to the interface, run `npm run build`, then reload the extension on
`chrome://extensions`.

### The theme before the first paint

`chrome.storage` answers only asynchronously, so the app cannot know the
stored theme before the first paint. `public/theme-boot.js` closes that
gap: it is a blocking script in `<head>`, it reads the mirror in
`localStorage`, and it stamps the `dark` class on `<html>` before the
stylesheet applies. `src/ui/theme.ts` writes the mirror on every change;
keep the key and the rules of the two files in sync. The script must stay
a plain file outside the bundle: a module, `defer`, or `async` would run
after the first paint and bring the flash back.

`npm run dev` serves the popup and the dashboard as ordinary web pages. The
Chrome APIs are absent from these pages. Use the development server for a
quick look at layout and styles, and load the built `dist` directory to
check the behavior of the extension.

Chrome stops an idle service worker at any time. The worker starts again on
the next browser event, so a tracking check can need a new interaction with
the browser.

## Build output

`npm run build` runs Vite two times:

- The first pass builds `index.html` (popup) and `dashboard.html`
  (dashboard) into `dist`.
- The second pass builds the service worker from `src/background/index.ts`
  into `dist/background.js`.

The manifest and the icons from `public` are copied into `dist` unchanged.

## Tests

`npm test` runs Vitest with two projects:

- `unit` runs `tests/**/*.test.ts` in a Node environment.
- `ui` runs `tests/ui/components/**/*.test.tsx` in jsdom.

Tests import `describe`, `it`, and `expect` from `vitest` explicitly.
`tests/helpers/fakeChromeStorage.ts` provides a fake `chrome.storage`, and
`tests/helpers/fakeChromeWorker.ts` a fake `chrome` for the service worker
wiring. `tests/helpers/required.ts` reads a fixture value that the test
knows is there. `tests/ui/components/setup.ts` provides the browser APIs
that jsdom does not implement.

## Code layout

| Directory | Content |
| --- | --- |
| `src/background` | Service worker and tracking state machine |
| `src/shared` | Domains, periods, aggregation, settings, export and import |
| `src/ui` | Components, hooks, theme, and all interface strings |
| `src/popup` | Popup entry point |
| `src/dashboard` | Dashboard entry point, routing, and screens |
| `public` | Manifest and icons |
| `tests` | Vitest tests that mirror the `src` layout |

## Conventions

- Test names use snake_case in the form `subject_behavior`.
- All user-facing text lives in `src/ui/strings.ts`. Components contain no
  string literals.
- The extension makes no network requests and collects no telemetry. A
  change that adds one needs a discussion before the implementation.

## UI components

The primitives in `src/components/ui` come from shadcn. They import `cn`
from the `cn` package, as the rest of the code does, so the repository has
no `src/lib/utils.ts`. A primitive added with the shadcn CLI recreates that
file: point the import at `cn` and delete the file again.

## Extension key

The manifest embeds a public key that fixes the extension ID. The ID
stays the same when the project directory moves or when you package the
extension. The matching private key is the file `key.pem` in the project
root. The file is not in version control. It is not necessary to build
the extension or to load it unpacked.

The repository already contains the public key in `public/manifest.json`.
To use a different ID, generate a new key pair:

```bash
openssl genrsa -out key.pem 2048
openssl rsa -in key.pem -pubout -outform DER | base64 -w 0
```

Put the output of the second command into the `key` field of
`public/manifest.json`.
