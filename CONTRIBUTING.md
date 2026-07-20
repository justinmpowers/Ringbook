# Contributing to Ringbook

Thanks for your interest in contributing!

## Development setup

See the [README](README.md#development) for how to run the backend
(`npm run dev` on `:3000`) and frontend (`npm run dev` via Vite on `:5173`)
locally.

## Making changes

1. Fork the repo and create a feature branch off `main`.
2. Make your changes.
3. There is currently no automated test suite or linter, so please manually
   verify your change works by running the app locally (both dev servers,
   or a full `docker compose up` build) before opening a PR.
4. Open a pull request against `main` describing what changed and why, and
   what you tested.

## Commit messages

This repo loosely follows a `type: short description` convention, e.g.
`feat: add cover image uploader`, `fix: drop admin username from bootstrap
log line`, `ci: only build on merge to main`. Common types: `feat`, `fix`,
`ci`, `docs`, `refactor`.

## Reporting bugs vs. security issues

Regular bugs: please open a GitHub issue.

Security vulnerabilities: **do not** open a public issue — see
[SECURITY.md](SECURITY.md) for how to report privately.
