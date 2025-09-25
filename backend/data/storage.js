// ============================== FIXED STORAGE SYSTEM FOR 1-MINUTE PERIODS ==============================
// Replace backend/data/storage.js with this corrected version

const fs = require('fs');
const path = require('path');

class Storage {
  constructor() {
    this.activeGames = new Map(); // gameId -> game
    this.walletStreaks = new Map(); // walletAddress -> streakData
    this.dailyGames = new Map(); // walletAddress-period -> gameData
    this.assignedWords = {}; // walletAddress -> [wordAssignments]
    this.periodDeposits = new Map(); // walletAddress-period -> depositData

    // File paths for persistence
    this.dataDir = path.join(__dirname, 'persistence');
    this.dailyGamesFile = path.join(this.dataDir, 'daily-games.json');
    this.streaksFile = path.join(this.dataDir, 'streaks.json');
    this.depositsFile = path.join(this.dataDir, 'period-deposits.json');

    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    // Load persisted data on startup
    this.loadPersistedData();
  }

  // ✅ NEW: Load persisted data from files
  loadPersistedData() {
    try {
      // Load daily games
      if (fs.existsSync(this.dailyGamesFile)) {
        const data = JSON.parse(fs.readFileSync(this.dailyGamesFile, 'utf8'));
        this.dailyGames = new Map(Object.entries(data));
        console.log(`📁 Loaded ${this.dailyGames.size} persisted daily games`);
      }

      // Load streaks
      if (fs.existsSync(this.streaksFile)) {
        const data = JSON.parse(fs.readFileSync(this.streaksFile, 'utf8'));
        this.walletStreaks = new Map(Object.entries(data));

        // ✅ DEBUG: Check for any reset players in loaded data
        const resetPlayers = Object.entries(data).filter(([wallet, streakData]) =>
          streakData.maxStreak === 0 && streakData.currentStreak === 0
        );
        if (resetPlayers.length > 0) {
          console.log(`🔍 LOAD DEBUG - Found ${resetPlayers.length} reset players in loaded file:`,
            resetPlayers.map(([wallet, data]) => `${wallet.slice(0, 8)}: C=${data.currentStreak} M=${data.maxStreak}`)
          );
        }

        console.log(`📁 Loaded ${this.walletStreaks.size} persisted streaks`);
      }

      // Load period deposits
      if (fs.existsSync(this.depositsFile)) {
        const data = JSON.parse(fs.readFileSync(this.depositsFile, 'utf8'));
        this.periodDeposits = new Map(Object.entries(data));
        console.log(`📁 Loaded ${this.periodDeposits.size} persisted period deposits`);
      }

      console.log(`✅ Storage persistence loaded successfully`);
    } catch (error) {
      console.error('❌ Error loading persisted data:', error);
      // Continue with empty maps if loading fails
    }
  }

  // ✅ NEW: Save daily games to file
  saveDailyGamesToFile() {
    try {
      const data = Object.fromEntries(this.dailyGames);
      fs.writeFileSync(this.dailyGamesFile, JSON.stringify(data, null, 2));
      console.log(`💾 Saved ${this.dailyGames.size} daily games to file`);
    } catch (error) {
      console.error('❌ Error saving daily games:', error);
    }
  }

  // ✅ NEW: Save streaks to file
  saveStreaksToFile() {
    try {
      const data = Object.fromEntries(this.walletStreaks);

      // ✅ DEBUG: Log any maxStreak = 0 entries to verify admin resets are being saved
      const resetEntries = Object.entries(data).filter(([wallet, streakData]) =>
        streakData.maxStreak === 0 && streakData.currentStreak === 0
      );
      if (resetEntries.length > 0) {
        console.log(`🔍 SAVE DEBUG - Found ${resetEntries.length} reset players being saved:`,
          resetEntries.map(([wallet, data]) => `${wallet.slice(0, 8)}: C=${data.currentStreak} M=${data.maxStreak}`)
        );
      }

      fs.writeFileSync(this.streaksFile, JSON.stringify(data, null, 2));
      console.log(`💾 Saved ${this.walletStreaks.size} streaks to file`);
    } catch (error) {
      console.error('❌ Error saving streaks:', error);
    }
  }

  // ✅ NEW: Save period deposits to file
  saveDepositsToFile() {
    try {
      const data = Object.fromEntries(this.periodDeposits);
      fs.writeFileSync(this.depositsFile, JSON.stringify(data, null, 2));
      console.log(`💾 Saved ${this.periodDeposits.size} period deposits to file`);
    } catch (error) {
      console.error('❌ Error saving period deposits:', error);
    }
  }

  // ✅ FIXED: Get current 1-minute period identifier
  getCurrentPeriodString() {
    const now = new Date();
    const timestamp = Math.floor(now.getTime() / 60000); // 60000ms = 1 minute
    return `period-${timestamp}`;
  }

  // ✅ FIXED: Get previous 1-minute period
  getPreviousPeriodString() {
    const now = new Date();
    const timestamp = Math.floor(now.getTime() / 60000) - 1; // Previous 1-minute period
    return `period-${timestamp}`;
  }

  // ✅ CRITICAL FIX: Check if played in current 1-minute period (not daily)
  hasPlayedToday(walletAddress) {
    const currentPeriod = this.getCurrentPeriodString();
    const key = `${walletAddress}-${currentPeriod}`;
    return this.dailyGames.has(key);
  }

  // ✅ CRITICAL FIX: Mark as played in current 1-minute period (not daily)
  markPlayedToday(walletAddress, gameData) {
    const currentPeriod = this.getCurrentPeriodString();
    const key = `${walletAddress}-${currentPeriod}`;

    console.log(`💾 Saving completed game for ${walletAddress.slice(0, 8)}...`);

    this.dailyGames.set(key, {
      ...gameData,
      timestamp: new Date(),
      period: currentPeriod,
    });

    console.log(`✅ Game completion saved for ${walletAddress.slice(0, 8)}...`);

    // ✅ NEW: Persist to file immediately when game is completed
    this.saveDailyGamesToFile();
  }

  // ✅ NEW: Check if player won the current period
  hasWonCurrentPeriod(walletAddress) {
    const currentPeriod = this.getCurrentPeriodString();
    const key = `${walletAddress}-${currentPeriod}`;

    if (!this.dailyGames.has(key)) {
      return false; // Hasn't played = hasn't won
    }

    const gameData = this.dailyGames.get(key);
    return gameData && gameData.isWin === true;
  }

  // ✅ NEW: Get game data for current period
  getCurrentPeriodGameData(walletAddress) {
    const currentPeriod = this.getCurrentPeriodString();
    const key = `${walletAddress}-${currentPeriod}`;
    const gameData = this.dailyGames.get(key);

    if (gameData) {
      console.log(`✅ Found completed game for ${walletAddress.slice(0, 8)}...`);
    }

    return gameData || null;
  }

  // ✅ NEW: Check if a game was started in a previous period
  isGameFromPreviousPeriod(game) {
    if (!game || !game.startTime) {
      return false;
    }

    const currentPeriod = this.getCurrentPeriodString();
    const gamePeriod = this.getPeriodStringFromTimestamp(game.startTime);

    return gamePeriod !== currentPeriod;
  }

  // ✅ NEW: Get period string from timestamp
  getPeriodStringFromTimestamp(timestamp) {
    // ✅ FIX: Use same calculation as getCurrentPeriodString
    const periodTimestamp = Math.floor(timestamp / 60000); // 60000ms = 1 minute
    return `period-${periodTimestamp}`;
  }

  // ✅ TEST: Create a test game from previous period
  createTestGameFromPreviousPeriod(walletAddress) {
    const oldTimestamp = Date.now() - 600000; // 10 minutes ago (2 periods ago)
    const gameId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const game = {
      gameId,
      walletAddress,
      answer: 'test',
      guesses: [],
      maxGuesses: 6,
      isComplete: false,
      isWin: false,
      startTime: oldTimestamp,
      period: this.getPeriodStringFromTimestamp(oldTimestamp)
    };

    this.activeGames.set(gameId, game);
    console.log(`🧪 Created test game ${gameId} from previous period for ${walletAddress}`);
    return game;
  }

  // ✅ FIXED: Get today and yesterday for streak logic (using periods)
  getTodayString() {
    return this.getCurrentPeriodString();
  }

  getYesterdayString() {
    return this.getPreviousPeriodString();
  }

  // ✅ FIXED: Get time until next 1-minute reset
  getTimeUntilNextReset() {
    const now = Date.now();
    const currentPeriodStart = Math.floor(now / 60000) * 60000; // 1 minute = 60000ms
    const nextPeriodStart = currentPeriodStart + 60000;
    const timeUntilReset = nextPeriodStart - now;

    const minutes = Math.floor(timeUntilReset / 60000);
    const seconds = Math.floor((timeUntilReset % 60000) / 1000);

    return {
      minutes,
      seconds,
      totalSeconds: Math.floor(timeUntilReset / 1000),
      milliseconds: timeUntilReset,
      nextResetTime: new Date(nextPeriodStart),
    };
  }

  // ✅ NEW: Clear played status for new period (called during transitions)
  clearPlayedStatusForNewPeriod() {
    const currentPeriod = this.getCurrentPeriodString();
    console.log(`🔄 Clearing played status for new period: ${currentPeriod}`);

    // This effectively allows players to play again in the new period
    // No need to actually clear anything - the period change handles it
  }

  // ✅ NEW: Get players who need streak protection
  getPlayersNeedingStreakProtection() {
    const protectedPlayers = [];
    const currentPeriod = this.getCurrentPeriodString();

    // Check all players who played this period
    for (let [key, gameData] of this.dailyGames.entries()) {
      if (key.includes(`-${currentPeriod}`) && gameData.isWin === true) {
        const walletAddress = key.replace(`-${currentPeriod}`, "");
        const streakData = this.getStreakData(walletAddress);

        if (streakData.currentStreak > 0) {
          protectedPlayers.push({
            walletAddress,
            currentStreak: streakData.currentStreak,
            wonThisPeriod: true,
            gameData,
          });
        }
      }
    }

    return protectedPlayers;
  }

  // ✅ NEW: Get players at risk of streak reset
  getPlayersAtRiskOfReset() {
    const atRiskPlayers = [];
    const currentPeriod = this.getCurrentPeriodString();

    // Check all players with streaks
    for (let [walletAddress, streakData] of this.walletStreaks.entries()) {
      if (streakData.currentStreak > 0) {
        const hasPlayedThisPeriod = this.hasPlayedToday(walletAddress);
        const hasWonThisPeriod = this.hasWonCurrentPeriod(walletAddress);

        if (!hasPlayedThisPeriod || !hasWonThisPeriod) {
          atRiskPlayers.push({
            walletAddress,
            currentStreak: streakData.currentStreak,
            hasPlayedThisPeriod,
            hasWonThisPeriod,
            riskReason: !hasPlayedThisPeriod ? "no_play" : "no_win",
          });
        }
      }
    }

    return atRiskPlayers;
  }

  // ✅ NEW: Period deposit tracking methods
  hasDepositedForCurrentPeriod(walletAddress) {
    const currentPeriod = this.getCurrentPeriodString();
    const key = `${walletAddress}-${currentPeriod}`;
    return this.periodDeposits.has(key);
  }

  markDepositForCurrentPeriod(walletAddress, depositData) {
    const currentPeriod = this.getCurrentPeriodString();
    const key = `${walletAddress}-${currentPeriod}`;

    console.log(`💰 Recording deposit for ${walletAddress.slice(0, 8)}... in period ${currentPeriod}`);

    this.periodDeposits.set(key, {
      ...depositData,
      timestamp: new Date(),
      period: currentPeriod,
    });

    console.log(`✅ Deposit recorded for ${walletAddress.slice(0, 8)}...`);

    // Persist to file immediately
    this.saveDepositsToFile();
  }

  getDepositForCurrentPeriod(walletAddress) {
    const currentPeriod = this.getCurrentPeriodString();
    const key = `${walletAddress}-${currentPeriod}`;
    return this.periodDeposits.get(key) || null;
  }

  // Game storage
  saveGame(game) {
    this.activeGames.set(game.gameId, game);
  }

  getGame(gameId) {
    return this.activeGames.get(gameId);
  }

  deleteGame(gameId) {
    this.activeGames.delete(gameId);
  }

  // ✅ NEW: Get active game by wallet address
  getActiveGame(walletAddress) {
    for (let [gameId, game] of this.activeGames.entries()) {
      if (game.walletAddress === walletAddress && !game.isComplete) {
        return game;
      }
    }
    return null;
  }

  // Streak storage
  getStreakData(walletAddress) {
    if (!this.walletStreaks.has(walletAddress)) {
      this.walletStreaks.set(walletAddress, {
        currentStreak: 0,
        maxStreak: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        lastPlayedDate: null,
      });
    }
    return this.walletStreaks.get(walletAddress);
  }

  saveStreakData(walletAddress, streakData) {
    this.walletStreaks.set(walletAddress, streakData);
    // ✅ NEW: Persist to file when streaks are updated
    this.saveStreaksToFile();
  }

  getAllStreaks() {
    return Array.from(this.walletStreaks.entries()).map(([wallet, data]) => ({
      wallet: wallet.slice(0, 4) + "..." + wallet.slice(-4),
      fullWallet: wallet,
      ...data,
    }));
  }

  // Word assignment methods
  getAssignedWords() {
    return this.assignedWords;
  }

  saveAssignedWords(assignedWords) {
    this.assignedWords = assignedWords;
  }

  getNextWordForPlayer(walletAddress) {
    // Check if player has assigned words
    const playerWords = this.assignedWords[walletAddress] || [];
    const nextAssignedWord = playerWords.find((w) => !w.used);

    if (nextAssignedWord) {
      console.log(
        `📝 Using assigned word "${nextAssignedWord.word}" for ${walletAddress}`
      );
      return nextAssignedWord.word;
    }

    // Fall back to random word selection
    return this.getRandomWord();
  }

  markAssignedWordAsUsed(walletAddress, word) {
    const playerWords = this.assignedWords[walletAddress] || [];
    const wordAssignment = playerWords.find((w) => w.word === word && !w.used);

    if (wordAssignment) {
      wordAssignment.used = true;
      wordAssignment.usedAt = new Date().toISOString();
      console.log(
        `✅ Marked assigned word "${word}" as used for ${walletAddress}`
      );
      return true;
    }

    return false;
  }

  getRandomWord() {
    // ✅ NEW: Use proper word list if available
    if (!this.wordList) {
      this.loadWordList();
    }

    const words = this.wordList && this.wordList.length > 0 ? this.wordList : this.getFallbackWords();
    const randomWord = words[Math.floor(Math.random() * words.length)];
    console.log(`🎲 Using random word "${randomWord}"`);
    return randomWord;
  }

  // ✅ NEW: Load word list from file
  loadWordList() {
    try {
      const fs = require('fs');
      const path = require('path');
      const wordListPath = path.join(__dirname, '../wordlist.json');

      if (fs.existsSync(wordListPath)) {
        this.wordList = JSON.parse(fs.readFileSync(wordListPath, 'utf8'))
          .map((w) => w.replace(/[^a-zA-Z]/g, "").toLowerCase())
          .filter((w) => w.length === 5);
        console.log(`📚 Loaded ${this.wordList.length} words for random assignment`);
      } else {
        console.warn("⚠️ wordlist.json not found, using fallback words");
        this.wordList = this.getFallbackWords();
      }
    } catch (error) {
      console.error("Error loading word list:", error);
      this.wordList = this.getFallbackWords();
    }
  }

  // ✅ NEW: Get fallback words
  getFallbackWords() {
    return [
      "apple", "brave", "cloud", "dance", "eagle", "flame", "grace", "happy",
      "input", "jolly", "karma", "light", "magic", "noble", "ocean", "peace",
      "quiet", "royal", "smart", "trust", "unity", "voice", "worth", "youth",
    ];
  }

  // ✅ NEW: Auto-assign random words to all players (conservative mode)
  autoAssignRandomWordsToAllPlayers(forceAssignment = false) {
    console.log(`🎲 Auto-assigning random words to all players (force: ${forceAssignment})...`);

    const allStreaks = this.getAllStreaks();
    let assignedCount = 0;

    for (const player of allStreaks) {
      const walletAddress = player.fullWallet;

      // Check if player already has an unused assigned word
      const playerWords = this.assignedWords[walletAddress] || [];
      const hasUnusedWord = playerWords.find((w) => !w.used);

      // ✅ NEW: Be more conservative - only assign if forced OR player has never had ANY words
      const hasNeverHadWords = playerWords.length === 0;

      if (!hasUnusedWord && (forceAssignment || hasNeverHadWords)) {
        // Assign a random word to this player
        const randomWord = this.getRandomWord();

        if (!this.assignedWords[walletAddress]) {
          this.assignedWords[walletAddress] = [];
        }

        this.assignedWords[walletAddress].push({
          word: randomWord,
          assignedAt: new Date().toISOString(),
          used: false,
          assignedBy: "system_auto_assignment",
          type: "period_auto_assignment",
        });

        assignedCount++;
        console.log(`🎯 Auto-assigned "${randomWord}" to ${walletAddress.slice(0, 8)}... (reason: ${forceAssignment ? 'forced' : 'never had words'})`);
      } else if (!hasUnusedWord && !forceAssignment) {
        console.log(`⏭️  Skipping ${walletAddress.slice(0, 8)}... - has previous words but no unused (not forced)`);
      }
    }

    console.log(`✅ Auto-assigned ${assignedCount} random words to players`);
    return assignedCount;
  }

  // ✅ NEW: Refresh words for all players (called on timer reset)
  refreshAllPlayerWords() {
    console.log("🔄 Refreshing words for all players due to timer reset...");

    // Clear all unused auto-assigned words
    for (const walletAddress of Object.keys(this.assignedWords)) {
      const playerWords = this.assignedWords[walletAddress] || [];
      // Remove unused auto-assigned words
      this.assignedWords[walletAddress] = playerWords.filter(
        (w) => w.used || w.type !== "period_auto_assignment"
      );
    }

    // Auto-assign new words to all players (forced because this is a period reset)
    const assignedCount = this.autoAssignRandomWordsToAllPlayers(true);

    console.log(`🔄 Word refresh complete: ${assignedCount} new words assigned`);
    return assignedCount;
  }

  getWordAssignmentStats() {
    const stats = {
      totalAssignments: 0,
      usedAssignments: 0,
      playerCount: 0,
    };

    for (const [walletAddress, words] of Object.entries(this.assignedWords)) {
      stats.playerCount++;
      stats.totalAssignments += words.length;
      stats.usedAssignments += words.filter((w) => w.used).length;
    }

    return stats;
  }

  // ✅ FIXED: Cleanup old periods (keep last 12 periods = 1 hour of history)
  cleanup() {
    const currentPeriod = this.getCurrentPeriodString();
    const currentTimestamp = Math.floor(Date.now() / 60000);
    const keepPeriodsBack = 12; // Keep last 12 periods (1 hour)

    console.log(`🧹 Cleaning up old periods. Current: ${currentPeriod}`);

    // Clean old period games
    let cleanedGames = 0;
    for (let [key, value] of this.dailyGames.entries()) {
      const keyParts = key.split("-");
      if (keyParts.length >= 3) {
        const keyPeriod = parseInt(keyParts[keyParts.length - 1]);
        if (keyPeriod < currentTimestamp - keepPeriodsBack) {
          this.dailyGames.delete(key);
          cleanedGames++;
        }
      }
    }

    // Clean old period deposits
    let cleanedDeposits = 0;
    for (let [key, value] of this.periodDeposits.entries()) {
      const keyParts = key.split("-");
      if (keyParts.length >= 3) {
        const keyPeriod = parseInt(keyParts[keyParts.length - 1]);
        if (keyPeriod < currentTimestamp - keepPeriodsBack) {
          this.periodDeposits.delete(key);
          cleanedDeposits++;
        }
      }
    }

    // Clean old active games (older than 10 minutes)
    let cleanedActiveGames = 0;
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    for (let [gameId, game] of this.activeGames.entries()) {
      if (game.startTime < tenMinutesAgo) {
        this.activeGames.delete(gameId);
        cleanedActiveGames++;
      }
    }

    console.log(
      `🧹 Cleanup complete: ${cleanedGames} old period games, ${cleanedDeposits} old deposits, ${cleanedActiveGames} old active games`
    );
  }

  // ✅ NEW: Debug method to check current state
  getDebugInfo() {
    const currentPeriod = this.getCurrentPeriodString();
    const previousPeriod = this.getPreviousPeriodString();

    return {
      currentPeriod,
      previousPeriod,
      totalActiveGames: this.activeGames.size,
      totalDailyGames: this.dailyGames.size,
      totalStreaks: this.walletStreaks.size,
      totalPeriodDeposits: this.periodDeposits.size,
      playersThisPeriod: Array.from(this.dailyGames.keys()).filter((key) =>
        key.includes(`-${currentPeriod}`)
      ).length,
      winnersThisPeriod: Array.from(this.dailyGames.entries()).filter(
        ([key, data]) =>
          key.includes(`-${currentPeriod}`) && data.isWin === true
      ).length,
      depositsThisPeriod: Array.from(this.periodDeposits.keys()).filter((key) =>
        key.includes(`-${currentPeriod}`)
      ).length,
      timeUntilReset: this.getTimeUntilNextReset(),
    };
  }
}

// Singleton instance
const storage = new Storage();

// ✅ FIXED: Run cleanup every 1 minute
setInterval(() => {
  storage.cleanup();
  console.log("🕐 1-minute period cleanup completed");
}, 1 * 60 * 1000); // 60,000 milliseconds = 1 minute

module.exports = storage;
