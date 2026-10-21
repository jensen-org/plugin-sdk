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
            assert_eq!(params["id"], "c1");
            assert_eq!(params["tail"], 20);
            Ok(
                json!({ "lines": [{ "at": "t", "stream": "stderr", "text": "boom" }], "cursor": "next" }),
            )
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
            json!({ "ok": { "session": "s1", "page": {
                "lines": [{ "at": "t", "stream": "stderr", "text": "boom" }],
                "cursor": "next"
            } } })
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
                state: jensen_plugin_backend::types::ContainerWait::Healthy,
            },
            5000,
        );
        assert_eq!(met, Ok(false));
        clear_test_host();
    }

    #[test]
    fn a_shape_the_host_does_not_send_is_an_error_naming_the_method() {
        set_test_responder(|_, _| Ok(json!([{ "id": "r1" }])));
        let error = host_api::run::list().expect_err("incomplete instance");
        assert!(
            error.starts_with("run.list answered something unexpected"),
            "{error}"
        );
        clear_test_host();
    }

    #[test]
    fn typed_lists_read_the_hosts_answers() {
        set_test_responder(|method, _| match method {
            "sessions.list" => Ok(json!([{ "id": "s1", "status": "needs_input" }])),
            "worktrees.list" => Ok(json!([{
                "path": ".jensen/worktrees/a", "branch": "b", "head": "abc", "isPrimary": false,
                "locked": false, "merged": true, "idleDays": 3, "sessionId": "s1"
            }])),
            "run.list" => Ok(json!([{
                "id": "r1", "serviceId": "web", "status": "failed", "exitCode": 2,
                "ports": [{ "declared": 3000, "host": 3001 }], "startedAt": "t", "origin": "outside"
            }])),
            _ => Err("unexpected".into()),
        });
        let sessions = host_api::sessions::list().expect("sessions");
        assert_eq!(
            sessions[0].status,
            jensen_plugin_backend::types::SessionStatus::NeedsInput
        );
        assert!(host_api::worktrees::list().expect("worktrees")[0].merged);
        let runs = host_api::run::list().expect("runs");
        assert_eq!(runs[0].ports[0].host, 3001);
        assert_eq!(runs[0].exit_code, Some(2));
        clear_test_host();
    }
}

mod schema {
    use jensen_plugin_backend::json;
    use jensen_plugin_backend::types::*;
    use serde::de::DeserializeOwned;
    use serde_json::Value;

    fn vendored() -> Value {
        serde_json::from_str(include_str!("../../../protocol/plugin-api.v1.json")).expect("schema")
    }

    fn values(schema: &Value, pointer: &str) -> Vec<String> {
        schema
            .pointer(pointer)
            .and_then(Value::as_array)
            .unwrap_or_else(|| panic!("{pointer} is not an enum in the vendored schema"))
            .iter()
            .map(|value| value.as_str().expect("string").to_string())
            .collect()
    }

    fn every_value_has_a_variant<T: DeserializeOwned + serde::Serialize>(
        schema: &Value,
        pointer: &str,
    ) {
        let names = values(schema, pointer);
        assert!(!names.is_empty(), "{pointer}");
        for name in names {
            let parsed: T = serde_json::from_value(json!(name))
                .unwrap_or_else(|error| panic!("{pointer}: {name} has no variant: {error}"));
            assert_eq!(
                serde_json::to_value(parsed).expect("serialize"),
                json!(name)
            );
        }
    }

    #[test]
    fn every_enum_value_in_the_schema_has_a_rust_variant() {
        let schema = vendored();
        let defs = "/$defs";
        every_value_has_a_variant::<RunStatus>(
            &schema,
            &format!("{defs}/RunInstance/properties/status/enum"),
        );
        every_value_has_a_variant::<RunOrigin>(
            &schema,
            &format!("{defs}/RunInstance/properties/origin/enum"),
        );
        every_value_has_a_variant::<ContainerEngine>(
            &schema,
            &format!("{defs}/ContainerEngine/enum"),
        );
        every_value_has_a_variant::<ContainerTie>(&schema, &format!("{defs}/ContainerTie/enum"));
        every_value_has_a_variant::<ContainerState>(
            &schema,
            &format!("{defs}/Container/properties/state/enum"),
        );
        every_value_has_a_variant::<Health>(
            &schema,
            &format!("{defs}/Container/properties/health/enum"),
        );
        every_value_has_a_variant::<LogStream>(
            &schema,
            &format!("{defs}/LogLine/properties/stream/enum"),
        );
        every_value_has_a_variant::<SessionStatus>(
            &schema,
            &format!("{defs}/Session/properties/status/enum"),
        );
        every_value_has_a_variant::<ContainerWait>(
            &schema,
            &format!("{defs}/WaitCondition/oneOf/0/properties/state/enum"),
        );
        every_value_has_a_variant::<RunWait>(
            &schema,
            &format!("{defs}/WaitCondition/oneOf/2/properties/status/enum"),
        );
    }

    #[test]
    fn every_field_the_schema_requires_is_a_field_of_the_struct() {
        let schema = vendored();
        let full = |name: &str| -> Value {
            let def = &schema["$defs"][name];
            let mut object = serde_json::Map::new();
            for field in def["required"].as_array().expect("required") {
                let field = field.as_str().expect("name");
                let property = &def["properties"][field];
                object.insert(field.to_string(), sample(&schema, property));
            }
            Value::Object(object)
        };
        serde_json::from_value::<RunInstance>(full("RunInstance")).expect("RunInstance");
        serde_json::from_value::<Container>(full("Container")).expect("Container");
        serde_json::from_value::<LogLine>(full("LogLine")).expect("LogLine");
        serde_json::from_value::<Session>(full("Session")).expect("Session");
        serde_json::from_value::<Worktree>(full("Worktree")).expect("Worktree");
    }

    fn sample(schema: &Value, property: &Value) -> Value {
        if let Some(reference) = property.get("$ref").and_then(Value::as_str) {
            let target = schema.pointer(&reference[1..]).expect("ref");
            return sample(schema, target);
        }
        if let Some(options) = property.get("enum").and_then(Value::as_array) {
            return options[0].clone();
        }
        match property.get("type").and_then(Value::as_str) {
            Some("string") => json!("x"),
            Some("integer") => json!(1),
            Some("boolean") => json!(false),
            Some("array") => json!([]),
            Some("object") => json!({}),
            other => panic!("no sample for {other:?}"),
        }
    }
}
