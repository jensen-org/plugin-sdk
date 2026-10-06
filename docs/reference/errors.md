# Errors

A refused call rejects with `HostError`:

| `code` | Meaning |
|---|---|
| `bad_request` | the params were malformed or named something that does not exist |
| `permission_denied` | the capability named in `error.capability` was not granted |
| `not_found` | the target does not exist |
| `failed` | the call was valid and did not work |
| `unsupported` | Jensen does not serve that method |
| `rate_limited`, `too_busy`, `io_budget_exceeded`, `killed` | the plugin hit a budget |
