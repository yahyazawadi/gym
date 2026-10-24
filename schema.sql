-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    passphrase_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions Table (Secure Token Auth)
CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Workout Logs (Raw, High-Resolution Metrics)
CREATE TABLE IF NOT EXISTS workout_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    weight_kg REAL NOT NULL,
    reps INTEGER NOT NULL,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- User Routines / Custom Split Overrides (Optional custom order)
CREATE TABLE IF NOT EXISTS user_routines (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    split_name TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_user_date ON workout_logs(user_id, logged_at);
CREATE INDEX IF NOT EXISTS idx_logs_user_exercise ON workout_logs(user_id, exercise_id);
