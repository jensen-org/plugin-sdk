# Protocol

The wire contract is `protocol/plugin-api.v1.json`, vendored from Jensen's `schema/plugin-api.v1.json`.
`jensen-plugin-protocol` is generated from it, and a CI check fails if the two drift.

Every message is `{ v: 1, id, kind, ... }` over a `MessagePort`. `kind` is `req`, `res` or `evt`.

There is deliberately no method that adds or changes a page, and none that touches a stored secret.
