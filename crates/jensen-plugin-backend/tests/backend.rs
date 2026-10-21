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
