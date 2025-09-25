const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

class Database {
  constructor() {
    const dbPath = path.join(__dirname, "burndle.db");
    this.db = new sqlite3.Database(dbPath);
    this.initializeDatabase();
  }

  initializeDatabase() {
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    // Split and execute each statement
    const statements = schema.split(";").filter((stmt) => stmt.trim());

    statements.forEach((statement) => {
      if (statement.trim()) {
        this.db.run(statement, (err) => {
          if (err) {
            console.error("Error executing schema statement:", err);
          }
        });
      }
    });
  }

  // Player management
  async getPlayer(walletAddress) {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT * FROM players WHERE wallet_address = ?",
        [walletAddress],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  async createOrUpdatePlayer(walletAddress, gameData) {
    const player = await this.getPlayer(walletAddress);
    const today = new Date().toISOString().split("T")[0];

    if (player) {
      return this.updatePlayer(walletAddress, gameData, player);
    } else {
      return this.createPlayer(walletAddress, gameData, today);
    }
  }

  async createPlayer(walletAddress, gameData, today) {
    return new Promise((resolve, reject) => {
      const currentStreak = gameData.isWin ? 1 : 0;
      const maxStreak = currentStreak;

      this.db.run(
        `INSERT INTO players (
                    wallet_address, current_streak, max_streak, 
                    total_games_played, total_games_won, total_guesses, 
                    last_played_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          walletAddress,
          currentStreak,
          maxStreak,
          1,
          gameData.isWin ? 1 : 0,
          gameData.guesses,
          today,
        ],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async updatePlayer(walletAddress, gameData, existingPlayer) {
    return new Promise((resolve, reject) => {
      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      let newCurrentStreak = existingPlayer.current_streak;
      let newMaxStreak = existingPlayer.max_streak;

      // Update streak logic
      if (gameData.isWin) {
        if (!existingPlayer.last_played_date) {
          newCurrentStreak = 1;
        } else if (existingPlayer.last_played_date === yesterdayStr) {
          newCurrentStreak += 1;
        } else if (existingPlayer.last_played_date < yesterdayStr) {
          newCurrentStreak = 1;
        }

        if (newCurrentStreak > newMaxStreak) {
          newMaxStreak = newCurrentStreak;
        }
      } else {
        newCurrentStreak = 0;
      }

      const newTotalGames = existingPlayer.total_games_played + 1;
      const newTotalWins =
        existingPlayer.total_games_won + (gameData.isWin ? 1 : 0);
      const newTotalGuesses = existingPlayer.total_guesses + gameData.guesses;

      this.db.run(
        `UPDATE players SET 
                    current_streak = ?, max_streak = ?, 
                    total_games_played = ?, total_games_won = ?, 
                    total_guesses = ?, last_played_date = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE wallet_address = ?`,
        [
          newCurrentStreak,
          newMaxStreak,
          newTotalGames,
          newTotalWins,
          newTotalGuesses,
          today,
          walletAddress,
        ],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  async recordGameSession(
    walletAddress,
    gameId,
    wordAnswer,
    isWin,
    guessesUsed
  ) {
    return new Promise((resolve, reject) => {
      const today = new Date().toISOString().split("T")[0];

      this.db.run(
        `INSERT INTO game_sessions (
                    wallet_address, game_id, word_answer, 
                    is_win, guesses_used, played_date
                ) VALUES (?, ?, ?, ?, ?, ?)`,
        [walletAddress, gameId, wordAnswer, isWin, guessesUsed, today],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async assignNextWord(walletAddress, word) {
    return new Promise((resolve, reject) => {
      const today = new Date().toISOString().split("T")[0];

      this.db.run(
        `INSERT INTO player_words (wallet_address, next_word, assigned_date)
                VALUES (?, ?, ?)`,
        [walletAddress, word, today],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async getPlayerNextWord(walletAddress) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT next_word FROM player_words 
                WHERE wallet_address = ? AND used = FALSE 
                ORDER BY assigned_date DESC LIMIT 1`,
        [walletAddress],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.next_word : null);
        }
      );
    });
  }

  async markWordAsUsed(walletAddress, word) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE player_words SET used = TRUE 
                WHERE wallet_address = ? AND next_word = ?`,
        [walletAddress, word],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  // Admin queries
  async getAllPlayers() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT 
                    wallet_address,
                    current_streak,
                    max_streak,
                    total_games_played,
                    total_games_won,
                    total_guesses,
                    CASE 
                        WHEN total_games_won > 0 
                        THEN ROUND(CAST(total_guesses AS FLOAT) / total_games_won, 2)
                        ELSE 0 
                    END as avg_guesses_per_win,
                    last_played_date,
                    created_at
                FROM players 
                ORDER BY current_streak DESC, max_streak DESC`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async getPlayerStats(walletAddress) {
    const player = await this.getPlayer(walletAddress);
    if (!player) return null;

    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT 
                    p.*,
                    CASE 
                        WHEN p.total_games_won > 0 
                        THEN ROUND(CAST(p.total_guesses AS FLOAT) / p.total_games_won, 2)
                        ELSE 0 
                    END as avg_guesses_per_win,
                    pw.next_word
                FROM players p
                LEFT JOIN player_words pw ON p.wallet_address = pw.wallet_address 
                    AND pw.used = FALSE
                WHERE p.wallet_address = ?
                ORDER BY pw.assigned_date DESC
                LIMIT 1`,
        [walletAddress],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  async getGameHistory(walletAddress, limit = 50) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM game_sessions 
                WHERE wallet_address = ? 
                ORDER BY created_at DESC 
                LIMIT ?`,
        [walletAddress, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async getTopStreaks(limit = 10) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT 
                    wallet_address,
                    current_streak,
                    max_streak,
                    total_games_played,
                    total_games_won,
                    CASE 
                        WHEN total_games_won > 0 
                        THEN ROUND(CAST(total_guesses AS FLOAT) / total_games_won, 2)
                        ELSE 0 
                    END as avg_guesses_per_win
                FROM players 
                ORDER BY current_streak DESC, max_streak DESC 
                LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  close() {
    this.db.close();
  }
}

module.exports = Database;
