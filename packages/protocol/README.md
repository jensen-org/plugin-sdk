# jensen-plugin-protocol

The wire protocol between [Jensen](https://github.com/jensen-org/jensen) and its plugins, as types and
constants. It is generated from the host's `schema/plugin-api.v1.json`, so it can never drift from what
Jensen actually speaks.

You almost never import this directly. [`jensen-plugin-sdk`](../sdk) re-exports everything a plugin needs.
