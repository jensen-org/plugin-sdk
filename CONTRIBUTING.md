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

npm trusted publishing can only be configured for a package that already exists, so publish each package once by hand, in this order:

```sh
bun run build
npm publish --access public --workspace packages/protocol
npm publish --access public --workspace packages/ui
npm publish --access public --workspace packages/sdk
npm publish --access public --workspace packages/create
```

Then on npmjs.com, for each package, open Settings, Trusted Publisher, and add GitHub Actions with owner `jensen-org`, repository `plugin-sdk`, workflow `release.yml` and environment `release`. Turn on "Require two-factor authentication and disallow tokens". Later releases need no token.

## The protocol

`protocol/plugin-api.v1.json` belongs to Jensen. Copy `schema/plugin-api.v1.json` over it, run `bun run protocol:generate` and review the diff. Never edit it here.
