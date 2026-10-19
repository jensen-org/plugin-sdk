use serde::{Deserialize, Serialize};

use crate::host;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum EntryKind {
    File,
    Dir,
}

/// One entry of a folder listing, the same shape as the protocol's `DirEntry`.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct DirEntry {
    pub name: String,
    pub kind: EntryKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
}

/// Reads a file of any format. The path is relative to the project root and has to fall inside a scope
/// the user granted the plugin; Jensen refuses anything else.
pub fn read(path: &str) -> Result<Vec<u8>, String> {
    host::read_file(path)
}

/// Writes a file, creating its folders. Jensen refreshes any tab that shows it.
pub fn write(path: &str, data: &[u8]) -> Result<(), String> {
    host::write_file(path, data)
}

/// Deletes a file.
pub fn remove(path: &str) -> Result<(), String> {
    host::delete_file(path)
}

/// Lists a folder. Under a file type scope such as `*.yaml` it shows the folders and the files in scope,
/// and nothing else. Needs a Jensen that provides the `fs_list` import.
pub fn list(path: &str) -> Result<Vec<DirEntry>, String> {
    let bytes = host::list_dir(path)?;
    serde_json::from_slice(&bytes)
        .map_err(|error| format!("the listing is not valid json: {error}"))
}
