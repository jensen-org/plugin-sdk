# Security

## Reporting a vulnerability

Use GitHub private vulnerability reporting: open the Security tab of this repository and choose Report a vulnerability. Do not open a public issue for a security problem.

## What these packages are

`jensen-plugin-sdk`, `jensen-ui`, `jensen-plugin-protocol` and `create-jensen-plugin` run inside a plugin's sandboxed frame or on a developer's machine. They hold no secrets and expose no way to read one: the protocol has no method for a keychain item, credential or token, and a test fails the build if one appears. The permission model is enforced by Jensen below the plugin, not by this SDK.

## How the project is protected

- Every change reaches `main` through a pull request with green checks and an approval in the `pr-review` environment.
- A release is a `v*` tag on a commit already on `main`, approved in the `release` environment, published through npm trusted publishing with provenance. No npm token is stored.
- Every GitHub Action is pinned to a full commit SHA and workflows run read only unless a job needs more.
- Secret scanning, push protection and Dependabot are on.
