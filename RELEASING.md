# Releasing v0.1.0

Everything the repository can prepare is done. These steps need your npm and GitHub accounts, so they are yours.

## 1. npm package

npm trusted publishing can only be configured for a package that exists, so the first publish is a placeholder.
No token is stored anywhere.

1. Publish a placeholder by hand from an empty folder: `npm publish --access public --tag bootstrap` with the
   version `0.0.0-bootstrap.0`.
2. Allow this repository (npm 11.10 or newer):

```bash
npx -y npm@latest trust github @jensen-org/plugin-sdk --repo jensen-org/plugin-sdk --file release.yml --env release --allow-publish --yes
```

3. On npmjs.com under Settings, turn on "Require two-factor authentication and disallow tokens".
4. After the first real release, run `npm deprecate @jensen-org/plugin-sdk@0.0.0-bootstrap.0 "placeholder, use 0.1.0 or later"`
   and `npm dist-tag rm @jensen-org/plugin-sdk bootstrap`.

## 2. GitHub

- [ ] Create the environment `release` (Settings, Environments) with yourself as required reviewer. The release
      workflow waits for your approval.
- [ ] Create the environment `pr-review` with a required reviewer. CI's `approve` job waits on it.
- [ ] Settings, Pages, Source: GitHub Actions. The `docs` workflow deploys on every push to `main`.

## 3. Cut the release

- [ ] Merge `develop` into `main` by pull request.
- [ ] On `main`, run `bun run version-packages` (applies the changesets), then commit and push the result. The
      package already reads `0.1.0`, so with no pending changeset this changes nothing.
- [ ] Check `bun run check` passes.
- [ ] Tag and push: `git tag v0.1.0 && git push origin v0.1.0`.
- [ ] Approve the run in the `release` environment and confirm `@jensen-org/plugin-sdk` appears on npm.

## 4. After

- [ ] Open the docs site at `https://jensen-org.github.io/plugin-sdk/` and check the publishing guide.
