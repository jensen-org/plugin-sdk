---
"@jensen-org/plugin-sdk": minor
---

The manifest accepts `sessions`, `run` and `containers` permissions and a read only `fsRead` list. File scopes also take file name patterns such as `Dockerfile*` and `.env*`. `jensen-plugin validate` checks them and `jensen-plugin publish` writes them only when a plugin asks, so existing manifests are unchanged.
