# Contributing

## Before you start

Open an issue and describe the problem or the change before you write
code. TabWatch keeps a small scope:

- The extension tracks time and shows statistics. It does not block sites,
  and it does not sort sites into categories.
- All data stays on the machine. There are no accounts, no sync, and no
  telemetry.
- The extension targets Google Chrome only.

A change that adds a network request, a new permission, or a third-party
service needs a discussion before the implementation.

## Development environment

Follow [DEVELOPMENT.md](DEVELOPMENT.md) to install the dependencies, to
learn the commands, and to read the conventions.

## Checks

Run the checks before you open a pull request:

```bash
npm run format
npm run lint
npm run typecheck
npm test
```

The continuous integration workflow runs the same checks, plus
`npm run format:check` and the build.

## Report a problem

Include the following in an issue:

- The Chrome version from `chrome://version`.
- The steps that show the problem.
- The result you expect and the result you see.

## Pull requests

- Keep one change in one pull request.
- Describe what the change does and why.
- Add a test for new logic in `src/shared` or in `src/background`.
- Follow the conventions in
  [DEVELOPMENT.md](DEVELOPMENT.md#conventions).
