# Contributing

```sh
bun install
bun run check
```

`bun run check` is the gate: protocol sync, lint, build, typecheck, tests and the API report. CI also runs `bun run docs:build` and `cargo test` in `crates/jensen-plugin-backend`.

## Branches and releases

Work on a topic branch or `develop`. Changes reach `main` by pull request. Add a changeset (`bun run changeset`) for any change to the published package.

A release is a `v<version>` tag on a commit that is already on `main`, approved in the `release` environment.

## First publish of a package

See [RELEASING.md](RELEASING.md).

## The protocol

`protocol/plugin-api.v1.json` belongs to Jensen. Copy `schema/plugin-api.v1.json` over it, run `bun run protocol:generate` and review the diff. Never edit it here.
