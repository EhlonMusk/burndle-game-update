-- SQLite schema for BURNdle player database

CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT UNIQUE NOT NULL,
    current_streak INTEGER DEFAULT 0,
    max_streak INTEGER DEFAULT 0,
    total_games_played INTEGER DEFAULT 0,
    total_games_won INTEGER DEFAULT 0,
    total_guesses INTEGER DEFAULT 0, -- For calculating average guesses per win
    last_played_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL,
    game_id TEXT NOT NULL,
    word_answer TEXT NOT NULL,
    is_win BOOLEAN NOT NULL,
    guesses_used INTEGER NOT NULL,
    played_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wallet_address) REFERENCES players(wallet_address)
);

CREATE TABLE IF NOT EXISTS player_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL,
    next_word TEXT NOT NULL,
    assigned_date TEXT NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (wallet_address) REFERENCES players(wallet_address)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_wallet ON players(wallet_address);
CREATE INDEX IF NOT EXISTS idx_game_sessions_wallet ON game_sessions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_game_sessions_date ON game_sessions(played_date);
CREATE INDEX IF NOT EXISTS idx_player_words_wallet ON player_words(wallet_address);

-- Insert admin user (replace with your actual admin credentials)
CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, -- Use bcrypt hash
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);