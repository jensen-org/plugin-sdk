use crate::host;

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
