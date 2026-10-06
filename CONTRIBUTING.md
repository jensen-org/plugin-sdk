# Contributing

```sh
bun install
bun run check
```

`bun run check` is the gate: protocol sync, lint, build, typecheck, tests, the API report and the docs build.

## Branches and releases

Work on a topic branch or `develop`. Changes reach `main` by pull request. Add a changeset (`bun run changeset`) for any change to a published package. The four packages version together.

A release is a `v<version>` tag on a commit that is already on `main`, approved in the `release` environment.

## First publish of a package

See [RELEASING.md](RELEASING.md).

## The protocol

`protocol/plugin-api.v1.json` belongs to Jensen. Copy `schema/plugin-api.v1.json` over it, run `bun run protocol:generate` and review the diff. Never edit it here.
