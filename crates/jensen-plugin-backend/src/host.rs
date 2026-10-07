#[derive(Clone, Copy, Debug)]
pub enum LogLevel {
    Info,
    Warn,
    Error,
}

impl LogLevel {
    fn name(self) -> &'static str {
        match self {
            LogLevel::Info => "info",
            LogLevel::Warn => "warn",
            LogLevel::Error => "error",
        }
    }
}

#[cfg(target_arch = "wasm32")]
mod imports {
    #[link(wasm_import_module = "jensen")]
    unsafe extern "C" {
        pub fn fs_read(path_ptr: i32, path_len: i32, out_ptr: i32, out_len: i32) -> i32;
        pub fn fs_write(
            path_ptr: i32,
            path_len: i32,
            data_ptr: i32,
            data_len: i32,
            out_ptr: i32,
            out_len: i32,
        ) -> i32;
        pub fn fs_delete(path_ptr: i32, path_len: i32, out_ptr: i32, out_len: i32) -> i32;
        pub fn log(level_ptr: i32, level_len: i32, text_ptr: i32, text_len: i32);
    }
}

#[cfg(target_arch = "wasm32")]
pub(crate) fn take(ptr: i32, len: i32) -> Vec<u8> {
    let slice = std::ptr::slice_from_raw_parts_mut(ptr as u32 as usize as *mut u8, len as usize);
    unsafe { Box::from_raw(slice) }.into_vec()
}

#[cfg(target_arch = "wasm32")]
fn address(bytes: &[u8]) -> i32 {
    bytes.as_ptr() as usize as i32
}

#[cfg(target_arch = "wasm32")]
fn length(bytes: &[u8]) -> i32 {
    bytes.len() as i32
}

#[cfg(target_arch = "wasm32")]
fn outcome(status: i32, ptr: i32, len: i32) -> Result<Vec<u8>, String> {
    let bytes = take(ptr, len);
    if status == 0 {
        Ok(bytes)
    } else {
        Err(String::from_utf8_lossy(&bytes).into_owned())
    }
}

#[cfg(target_arch = "wasm32")]
pub(crate) fn read_file(path: &str) -> Result<Vec<u8>, String> {
    let (mut ptr, mut len) = (0i32, 0i32);
    let status = unsafe {
        imports::fs_read(
            address(path.as_bytes()),
            length(path.as_bytes()),
            &mut ptr as *mut i32 as usize as i32,
            &mut len as *mut i32 as usize as i32,
        )
    };
    outcome(status, ptr, len)
}

#[cfg(target_arch = "wasm32")]
pub(crate) fn write_file(path: &str, data: &[u8]) -> Result<(), String> {
    let (mut ptr, mut len) = (0i32, 0i32);
    let status = unsafe {
        imports::fs_write(
            address(path.as_bytes()),
            length(path.as_bytes()),
            address(data),
            length(data),
            &mut ptr as *mut i32 as usize as i32,
            &mut len as *mut i32 as usize as i32,
        )
    };
    outcome(status, ptr, len).map(|_| ())
}

#[cfg(target_arch = "wasm32")]
pub(crate) fn delete_file(path: &str) -> Result<(), String> {
    let (mut ptr, mut len) = (0i32, 0i32);
    let status = unsafe {
        imports::fs_delete(
            address(path.as_bytes()),
            length(path.as_bytes()),
            &mut ptr as *mut i32 as usize as i32,
            &mut len as *mut i32 as usize as i32,
        )
    };
    outcome(status, ptr, len).map(|_| ())
}

/// Writes a line to Jensen's plugin log.
#[cfg(target_arch = "wasm32")]
pub fn log(level: LogLevel, text: &str) {
    let level = level.name();
    unsafe {
        imports::log(
            address(level.as_bytes()),
            length(level.as_bytes()),
            address(text.as_bytes()),
            length(text.as_bytes()),
        );
    }
}

#[cfg(not(target_arch = "wasm32"))]
pub(crate) fn read_file(path: &str) -> Result<Vec<u8>, String> {
    std::fs::read(path).map_err(|error| error.to_string())
}

#[cfg(not(target_arch = "wasm32"))]
pub(crate) fn write_file(path: &str, data: &[u8]) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(path)
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    std::fs::write(path, data).map_err(|error| error.to_string())
}

#[cfg(not(target_arch = "wasm32"))]
pub(crate) fn delete_file(path: &str) -> Result<(), String> {
    std::fs::remove_file(path).map_err(|error| error.to_string())
}

/// Writes a line to Jensen's plugin log. Natively, which is how tests run, it goes to standard error.
#[cfg(not(target_arch = "wasm32"))]
pub fn log(level: LogLevel, text: &str) {
    eprintln!("[{}] {text}", level.name());
}
