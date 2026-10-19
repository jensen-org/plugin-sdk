---
"@jensen-org/plugin-sdk": minor
---

Act on Run and containers with `app.run.start`, `stop` and `restart` and `app.containers.stop`, `restart` and `remove`. Each resolves to `{ confirmed }`, and a declined confirmation is reported instead of thrown. The Rust backend crate adds `host_api::call`, `host_api::context` and typed helpers including `run::remove_own` and `wait::until`, with native test hooks, and moves to 0.3.0.
