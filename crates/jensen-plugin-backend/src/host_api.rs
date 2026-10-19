use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use crate::host;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Caller {
    Ui,
    Agent,
}

/// Who is calling the backend, and from where. `session_id` and `checkout` are set for an agent that
/// called through a session; `checkout` is that session's worktree relative to the project root.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CallContext {
    pub caller: Caller,
    pub plugin_id: String,
    pub project_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub checkout: Option<String>,
}

/// Runs a protocol method as the plugin, under the same capability checks as the frontend. UI methods
/// are refused. A refusal comes back as the host's own message.
pub fn call(method: &str, params: Value) -> Result<Value, String> {
    let bytes = serde_json::to_vec(&params).map_err(|error| error.to_string())?;
    let answer = host::call_method(method, &bytes)?;
    if answer.is_empty() {
        return Ok(Value::Null);
    }
    serde_json::from_slice(&answer)
        .map_err(|error| format!("the answer is not valid json: {error}"))
}

/// The caller of the current backend call.
pub fn context() -> Result<CallContext, String> {
    let bytes = host::call_context()?;
    serde_json::from_slice(&bytes)
        .map_err(|error| format!("the context is not valid json: {error}"))
}

/// Tests only: answers every [`call`] natively. `responder` gets the method and its params.
#[cfg(not(target_arch = "wasm32"))]
pub fn set_test_responder<F>(responder: F)
where
    F: Fn(&str, Value) -> Result<Value, String> + 'static,
{
    host::set_responder(Some(Box::new(responder)));
}

/// Tests only: the context [`context`] returns natively.
#[cfg(not(target_arch = "wasm32"))]
pub fn set_test_context(context: &CallContext) {
    host::set_context(serde_json::to_vec(context).ok());
}

/// Tests only: forgets the responder and the context set on this thread.
#[cfg(not(target_arch = "wasm32"))]
pub fn clear_test_host() {
    host::set_responder(None);
    host::set_context(None);
}

/// Run's instances, and the one action a backend may take without a prompt.
pub mod run {
    use super::*;

    /// Needs `run` in the manifest.
    pub fn list() -> Result<Value, String> {
        call("run.list", json!({}))
    }

    /// Removes the calling session's own Compose project: containers, network, volumes and the images it
    /// built. Refused when the call has no session. Needs `run: "control"`.
    pub fn remove_own() -> Result<bool, String> {
        let answer = call("run.removeOwn", json!({}))?;
        Ok(answer["removed"].as_bool().unwrap_or(false))
    }
}

pub mod containers {
    use super::*;

    #[derive(Clone, Debug, Default, Serialize)]
    pub struct LogOptions {
        #[serde(skip_serializing_if = "Option::is_none")]
        pub since: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub until: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub tail: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        pub cursor: Option<String>,
    }

    /// One page of logs, `{ lines, cursor? }`. Needs `containers` in the manifest.
    pub fn logs(id: &str, options: &LogOptions) -> Result<Value, String> {
        let mut params = serde_json::to_value(options).map_err(|error| error.to_string())?;
        params["id"] = json!(id);
        call("containers.logs", params)
    }
}

pub mod git {
    use super::*;

    /// Needs `git` in the manifest.
    pub fn history(params: Value) -> Result<Value, String> {
        call("git.history", params)
    }
}

pub mod storage {
    use super::*;

    /// The plugin's saved data, `null` before the first save.
    pub fn load() -> Result<Value, String> {
        call("storage.load", json!({}))
    }

    /// The plugin's saved data for the open project.
    pub fn load_project() -> Result<Value, String> {
        call("storage.load", json!({ "scope": "project" }))
    }
}

/// Waiting happens in the host, because a backend has no clock and each call has a time limit.
pub mod wait {
    use super::*;

    #[derive(Clone, Debug, Serialize)]
    #[serde(tag = "kind", rename_all = "lowercase")]
    pub enum Condition {
        Container { id: String, state: String },
        Log { id: String, pattern: String },
        Run { id: String, status: String },
    }

    /// True when the condition was met, false when `timeout_ms` passed first. Each condition needs the
    /// capability that reads what it watches.
    pub fn until(condition: &Condition, timeout_ms: u64) -> Result<bool, String> {
        let answer = call(
            "wait.until",
            json!({ "condition": condition, "timeoutMs": timeout_ms }),
        )?;
        Ok(answer["met"].as_bool().unwrap_or(false))
    }
}
