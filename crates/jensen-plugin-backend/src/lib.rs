mod abi;
pub mod fs;
mod host;

pub use abi::{Backend, Method};
pub use host::{LogLevel, log};
pub use serde_json::{Value, json};

#[doc(hidden)]
pub mod export {
    pub use crate::abi::{alloc, call, free};
}

/// Exports the functions Jensen looks for in a backend module. `register` receives a [`Backend`] to add
/// methods to, and runs once per call.
///
/// ```ignore
/// fn register(backend: &mut jensen_plugin_backend::Backend) {
///     backend.method("greet", |input| Ok(jensen_plugin_backend::json!({ "hello": input["name"] })));
/// }
/// jensen_plugin_backend::export!(register);
/// ```
#[macro_export]
macro_rules! export {
    ($register:path) => {
        #[unsafe(no_mangle)]
        pub extern "C" fn jensen_alloc(len: i32) -> i32 {
            $crate::export::alloc(len)
        }

        #[unsafe(no_mangle)]
        pub extern "C" fn jensen_free(ptr: i32, len: i32) {
            $crate::export::free(ptr, len)
        }

        #[unsafe(no_mangle)]
        pub extern "C" fn jensen_call(
            method_ptr: i32,
            method_len: i32,
            input_ptr: i32,
            input_len: i32,
        ) -> i64 {
            $crate::export::call($register, method_ptr, method_len, input_ptr, input_len)
        }
    };
}
