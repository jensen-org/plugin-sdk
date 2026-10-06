# Releasing v0.1.0

Everything the repository can prepare is done. These steps need your npm and GitHub accounts, so they are yours.

## 1. npm packages

npm trusted publishing can only be configured for a package that exists. Pick one route.

Route A, bootstrap with a token (recommended):

1. On npmjs.com create a granular access token with publish rights for the `jensen-plugin-protocol`, `jensen-ui`,
   `jensen-plugin-sdk` and `create-jensen-plugin` names.
2. Add it as the secret `NPM_TOKEN` in the GitHub environment `release`. The release workflow uses it only when it is set.
3. After the first release, set up the trusted publishers below, then delete the secret.

Route B, publish once by hand: `bun run build`, then `npm publish --access public --workspace packages/<name>` in the
order protocol, ui, sdk, create.

Trusted publishers, for each of the four packages, on npmjs.com under Settings, Trusted Publisher: GitHub Actions,
owner `jensen-org`, repository `plugin-sdk`, workflow `release.yml`, environment `release`. Then turn on
"Require two-factor authentication and disallow tokens".

## 2. GitHub

- [ ] Create the environment `release` (Settings, Environments) with yourself as required reviewer. The release
      workflow waits for your approval.
- [ ] Create the environment `pr-review` with a required reviewer. CI's `approve` job waits on it.
- [ ] Settings, Pages, Source: GitHub Actions. The `docs` workflow deploys on every push to `main`.

## 3. Cut the release

- [ ] Merge `develop` into `main` by pull request.
- [ ] On `main`, run `bun run version-packages` (applies the changesets, all four packages move together to `0.1.0`),
      then commit and push the result. The packages already read `0.1.0`, so with no pending changeset this changes nothing.
- [ ] Check `bun run check` passes.
- [ ] Tag and push: `git tag v0.1.0 && git push origin v0.1.0`.
- [ ] Approve the run in the `release` environment and confirm the four packages appear on npm.

## 4. After

- [ ] Remove `NPM_TOKEN` from the `release` environment once the trusted publishers are in place.
- [ ] Open the docs site at `https://jensen-org.github.io/plugin-sdk/` and check the publishing guide.
