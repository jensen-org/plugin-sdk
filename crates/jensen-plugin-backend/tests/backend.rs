#![allow(clippy::expect_used)]

use jensen_plugin_backend::{Backend, json};

fn greeter() -> Backend {
    let mut backend = Backend::default();
    backend
        .method("greet", |input| {
            let name = input["name"].as_str().ok_or("name is required")?;
            Ok(json!({ "hello": name }))
        })
        .method("echo", Ok);
    backend
}

fn answer(backend: &Backend, method: &str, input: &str) -> serde_json::Value {
    serde_json::from_slice(&backend.handle(method, input.as_bytes())).expect("json envelope")
}

#[test]
fn a_method_answers_with_an_ok_envelope() {
    let reply = answer(&greeter(), "greet", r#"{"name":"Ada"}"#);
    assert_eq!(reply, json!({ "ok": { "hello": "Ada" } }));
}

#[test]
fn a_failing_method_answers_with_an_error_envelope() {
    let reply = answer(&greeter(), "greet", "{}");
    assert_eq!(reply, json!({ "error": "name is required" }));
}

#[test]
fn an_unknown_method_and_bad_json_are_errors() {
    assert!(answer(&greeter(), "missing", "{}")["error"].is_string());
    assert!(answer(&greeter(), "echo", "not json")["error"].is_string());
}

#[test]
fn files_round_trip_through_the_native_fallback() {
    let dir = std::env::temp_dir().join("jensen-plugin-backend-test");
    let path = dir.join("a/b.bin");
    let path = path.to_str().expect("utf-8 path");
    jensen_plugin_backend::fs::write(path, &[1, 2, 3]).expect("write");
    assert_eq!(
        jensen_plugin_backend::fs::read(path).expect("read"),
        vec![1, 2, 3]
    );
    jensen_plugin_backend::fs::remove(path).expect("remove");
    assert!(jensen_plugin_backend::fs::read(path).is_err());
}

#[test]
fn a_folder_lists_through_the_native_fallback() {
    use jensen_plugin_backend::fs::{DirEntry, EntryKind};

    let dir = std::env::temp_dir().join("jensen-plugin-backend-list-test");
    let _ = std::fs::remove_dir_all(&dir);
    let root = dir.to_str().expect("utf-8 path");
    jensen_plugin_backend::fs::write(&format!("{root}/b.yaml"), b"abc").expect("write");
    jensen_plugin_backend::fs::write(&format!("{root}/sub/c.yaml"), b"").expect("write");

    let entries = jensen_plugin_backend::fs::list(root).expect("list");
    assert_eq!(
        entries,
        vec![
            DirEntry {
                name: "b.yaml".into(),
                kind: EntryKind::File,
                size: Some(3)
            },
            DirEntry {
                name: "sub".into(),
                kind: EntryKind::Dir,
                size: None
            },
        ]
    );
    assert!(jensen_plugin_backend::fs::list(&format!("{root}/missing")).is_err());
    let _ = std::fs::remove_dir_all(&dir);
}

mod host_access {
    use jensen_plugin_backend::host_api::{
        self, CallContext, Caller, clear_test_host, set_test_context, set_test_responder, wait,
    };
    use jensen_plugin_backend::{Backend, json};

    fn agent() -> CallContext {
        CallContext {
            caller: Caller::Agent,
            plugin_id: "acme.containers".into(),
            project_id: "p1".into(),
            session_id: Some("s1".into()),
            checkout: Some(".jensen/worktrees/a".into()),
        }
    }

    #[test]
    fn a_method_reads_the_caller_and_calls_the_host() {
        set_test_context(&agent());
        set_test_responder(|method, params| {
            assert_eq!(method, "containers.logs");
            Ok(json!({ "lines": [], "id": params["id"], "tail": params["tail"] }))
        });
        let mut backend = Backend::default();
        backend.method("logs", |input| {
            let context = host_api::context()?;
            let page = host_api::containers::logs(
                input["id"].as_str().ok_or("id is required")?,
                &host_api::containers::LogOptions {
                    tail: Some(20),
                    ..Default::default()
                },
            )?;
            Ok(json!({ "session": context.session_id, "page": page }))
        });

        let reply: serde_json::Value =
            serde_json::from_slice(&backend.handle("logs", br#"{"id":"c1"}"#)).expect("envelope");

        assert_eq!(
            reply,
            json!({ "ok": { "session": "s1", "page": { "lines": [], "id": "c1", "tail": 20 } } })
        );
        clear_test_host();
    }

    #[test]
    fn the_context_reads_back_what_the_test_set() {
        set_test_context(&agent());
        assert_eq!(host_api::context().expect("context"), agent());
        clear_test_host();
        assert!(host_api::context().is_err());
    }

    #[test]
    fn an_unknown_method_surfaces_the_hosts_message() {
        set_test_responder(|method, _| Err(format!("the plugin API has no method '{method}'")));
        assert_eq!(
            host_api::call("nope.missing", json!({})),
            Err("the plugin API has no method 'nope.missing'".to_string())
        );
        clear_test_host();
    }

    #[test]
    fn remove_own_and_wait_read_the_hosts_answers() {
        set_test_responder(|method, params| match method {
            "run.removeOwn" => Ok(json!({ "removed": true })),
            "wait.until" => {
                assert_eq!(
                    params,
                    json!({
                        "condition": { "kind": "container", "id": "c1", "state": "healthy" },
                        "timeoutMs": 5000
                    })
                );
                Ok(json!({ "met": false }))
            }
            _ => Err("unexpected".into()),
        });

        assert_eq!(host_api::run::remove_own(), Ok(true));
        let met = wait::until(
            &wait::Condition::Container {
                id: "c1".into(),
                state: "healthy".into(),
            },
            5000,
        );
        assert_eq!(met, Ok(false));
        clear_test_host();
    }
}
