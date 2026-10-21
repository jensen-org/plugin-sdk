use std::collections::BTreeMap;

use serde_json::{Value, json};

pub type Method = Box<dyn Fn(Value) -> Result<Value, String>>;

/// The methods a backend answers. Each takes the JSON the plugin sent and returns JSON, or a message
/// Jensen shows the user and hands back to the agent that called it.
#[derive(Default)]
pub struct Backend {
    methods: BTreeMap<String, Method>,
}

impl Backend {
    pub fn method<F>(&mut self, name: &str, handler: F) -> &mut Self
    where
        F: Fn(Value) -> Result<Value, String> + 'static,
    {
        self.methods.insert(name.to_string(), Box::new(handler));
        self
    }

    /// Runs one method, the way Jensen does, and returns the JSON envelope it answers with.
    pub fn handle(&self, method: &str, input: &[u8]) -> Vec<u8> {
        let outcome = match self.methods.get(method) {
            None => Err(format!("the backend has no method '{method}'")),
            Some(handler) => serde_json::from_slice::<Value>(input)
                .map_err(|error| format!("the input is not valid json: {error}"))
                .and_then(|value| handler(value)),
        };
        let envelope = match outcome {
            Ok(value) => json!({ "ok": value }),
            Err(message) => json!({ "error": message }),
        };
        serde_json::to_vec(&envelope).unwrap_or_else(|_| br#"{"error":"unserializable"}"#.to_vec())
    }
}

fn leak(bytes: Vec<u8>) -> (i32, i32) {
    let boxed = bytes.into_boxed_slice();
    let len = boxed.len() as i32;
    let ptr = Box::into_raw(boxed) as *mut u8 as usize as i32;
    (ptr, len)
}

pub fn alloc(len: i32) -> i32 {
    leak(vec![0u8; len.max(0) as usize]).0
}

pub fn free(ptr: i32, len: i32) {
    if len <= 0 {
        return;
    }
    let slice = std::ptr::slice_from_raw_parts_mut(ptr as u32 as usize as *mut u8, len as usize);
    drop(unsafe { Box::from_raw(slice) });
}

fn read(ptr: i32, len: i32) -> Vec<u8> {
    if len <= 0 {
        return Vec::new();
    }
    let slice =
        unsafe { std::slice::from_raw_parts(ptr as u32 as usize as *const u8, len as usize) };
    slice.to_vec()
}

pub fn call(
    register: fn(&mut Backend),
    method_ptr: i32,
    method_len: i32,
    input_ptr: i32,
    input_len: i32,
) -> i64 {
    let method = String::from_utf8_lossy(&read(method_ptr, method_len)).into_owned();
    let input = read(input_ptr, input_len);
    let mut backend = Backend::default();
    register(&mut backend);
    let (ptr, len) = leak(backend.handle(&method, &input));
    (i64::from(ptr as u32) << 32) | i64::from(len as u32)
}
