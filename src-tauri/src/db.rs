use rusqlite::{Connection, Result};

pub struct DbState {
    pub conn: std::sync::Mutex<Connection>,
}

pub fn init_db(db_path: &str) -> Result<Connection> {
    let conn = Connection::open(db_path)?;

    // Enable foreign key enforcement
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;

    // Wrap schema creation in a transaction for atomicity
    conn.execute_batch("BEGIN;")?;
    let result = conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS Project (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            version TEXT DEFAULT '1.0',
            data TEXT NOT NULL,
            phraseCount INTEGER DEFAULT 0,
            createdAt INTEGER NOT NULL,
            updatedAt INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ProjectBackup (
            id TEXT PRIMARY KEY,
            parentId TEXT NOT NULL,
            data TEXT NOT NULL,
            checksum TEXT NOT NULL,
            createdAt INTEGER NOT NULL,
            FOREIGN KEY (parentId) REFERENCES Project(id)
        );"
    );
    match result {
        Ok(()) => conn.execute_batch("COMMIT;")?,
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK;");
            return Err(e);
        }
    }

    Ok(conn)
}
