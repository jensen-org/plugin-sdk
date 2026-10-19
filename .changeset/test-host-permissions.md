---
"@jensen-org/plugin-sdk": minor
---

`TestHost` takes an opt-in `permissions` list. A call to a method whose capability is not in the list fails with `permission_denied`, so plugin tests can check their consent assumptions.
