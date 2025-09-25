// backend/routes/admin.js - FIXED with proper game status detection and pause/reset functionality
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const router = express.Router();

// Use the existing storage system
const storage = require("../data/storage");

// ✅ NEW: Game pause/resume state
let isGamePaused = false;
let pausedBy = null;
let pausedAt = null;

// ✅ NEW: Game finish state
let isGameFinished = false;
let finishedBy = null;
let finishedAt = null;
let finishLeaderboard = null;

// ✅ NEW: Stop game message configuration
let stopGameMessage = "Thanks for playing BURNdle! Prizes will be distributed soon. Keep an eye on our socials for more updates. The next game starts in: [1 hour clock].";


function isGameCurrentlyPaused() {
  return isGamePaused;
}

function getPauseInfo() {
  return {
    isPaused: isGamePaused,
    pausedBy: pausedBy,
    pausedAt: pausedAt,
    message: isGamePaused ? "Game is currently paused" : "Game is active",
  };
}

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "burndle-admin-secret-key"
    );
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// Admin login - SIMPLIFIED VERSION FOR TESTING
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  console.log("Login attempt:", { username, password }); // Debug log

  try {
    // Simple admin credentials for testing (CHANGE THESE!)
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

    console.log("Expected credentials:", { ADMIN_USERNAME, ADMIN_PASSWORD }); // Debug log

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      console.log("Invalid credentials provided");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { username, role: "admin" },
      process.env.JWT_SECRET || "burndle-admin-secret-key",
      { expiresIn: "24h" }
    );

    console.log("Login successful, token generated");
    res.json({ success: true, token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// ✅ NEW: Game pause/resume endpoints

// Get game pause status
router.get("/game-pause-status", authenticateAdmin, (req, res) => {
  try {
    res.json({
      success: true,
      isPaused: isGamePaused,
      pausedBy: pausedBy,
      pausedAt: pausedAt,
      message: isGamePaused ? "Game is currently paused" : "Game is active",
    });
  } catch (error) {
    console.error("Error getting pause status:", error);
    res.status(500).json({ error: "Failed to get pause status" });
  }
});

// ✅ NEW: Get game finish status
router.get("/game-finish-status", authenticateAdmin, (req, res) => {
  try {
    res.json({
      success: true,
      isFinished: isGameFinished,
      finishedBy: finishedBy,
      finishedAt: finishedAt,
      leaderboard: finishLeaderboard,
      message: isGameFinished ? "Game is finished" : "Game is active",
    });
  } catch (error) {
    console.error("Error getting finish status:", error);
    res.status(500).json({ error: "Failed to get finish status" });
  }
});

// Pause game
router.post("/game-pause", authenticateAdmin, (req, res) => {
  try {
    const { adminUsername, reason } = req.body;

    if (isGamePaused) {
      return res.status(400).json({
        success: false,
        error: "Game is already paused",
        isPaused: true,
      });
    }

    isGamePaused = true;
    pausedBy = adminUsername || req.admin.username || "admin";
    pausedAt = new Date().toISOString();

    console.log(
      `⏸️ Game paused by ${pausedBy}: ${reason || "No reason provided"}`
    );

    // Your existing broadcasts
    if (global.broadcastToAll) {
      global.broadcastToAll("game-paused", {
        adminUsername: pausedBy,
        reason: reason,
        pausedAt: pausedAt,
      });
    }

    if (global.broadcastToAdmins) {
      global.broadcastToAdmins("game-paused", {
        adminUsername: pausedBy,
        reason: reason,
        pausedAt: pausedAt,
      });
    }

    // 🚨 ADD THIS: Socket.io broadcast for pause handler
    if (io) {
      io.emit("game_paused", {
        isPaused: true,
        pausedBy: pausedBy,
        pausedAt: pausedAt,
        message: reason || "Game paused by administrator",
      });
      console.log("📡 Broadcasted game_paused event via Socket.io");
    }

    res.json({
      success: true,
      message: `Game paused by ${pausedBy}`,
      isPaused: true,
      pausedBy: pausedBy,
      pausedAt: pausedAt,
    });
  } catch (error) {
    console.error("Error pausing game:", error);
    res.status(500).json({ error: "Failed to pause game" });
  }
});

// Stop game
router.post("/game-stop", authenticateAdmin, (req, res) => {
  try {
    console.log("🛑 STOP GAME ROUTE CALLED - req.body:", req.body);
    const { adminUsername } = req.body;
    const stoppedBy = adminUsername || req.admin.username || "admin";
    const stoppedAt = new Date().toISOString();

    console.log(`🛑 Game STOPPED by ${stoppedBy}`);

    // Reset game pause state since game is now stopped
    isGamePaused = false;
    pausedBy = null;
    pausedAt = null;

    // Set game finish state
    isGameFinished = true;
    finishedBy = stoppedBy;
    finishedAt = stoppedAt;

    // Get top 3 leaderboard
    console.log("🛑 About to call storage.getAllStreaks()");
    const allStreaks = storage.getAllStreaks();
    console.log("🛑 Got streaks:", allStreaks ? allStreaks.length : "null", "items");
    const leaderboard = allStreaks
      .sort((a, b) => (b.maxStreak || 0) - (a.maxStreak || 0))
      .slice(0, 3)
      .map((player, index) => ({
        rank: index + 1,
        wallet: player.wallet || player.fullWallet?.slice(0, 8) + "...",
        fullWallet: player.fullWallet || player.wallet,
        maxStreak: player.maxStreak || 0,
        gamesWon: player.gamesWon || 0,
        gamesPlayed: player.gamesPlayed || 0
      }));

    // Store leaderboard for persistence
    finishLeaderboard = leaderboard;

    // Broadcast game stopped
    if (global.broadcastToAll) {
      global.broadcastToAll("game-stopped", {
        stoppedBy: stoppedBy,
        stoppedAt: stoppedAt,
        leaderboard: leaderboard,
        message: stopGameMessage,
      });
    }

    if (io) {
      io.emit("game_stopped", {
        stoppedBy: stoppedBy,
        stoppedAt: stoppedAt,
        leaderboard: leaderboard,
        message: stopGameMessage,
      });
    }

    res.json({
      success: true,
      message: `Game stopped by ${stoppedBy}`,
      leaderboard: leaderboard,
      stopMessage: stopGameMessage,
    });
  } catch (error) {
    console.error("Error stopping game:", error);
    res.status(500).json({ error: "Failed to stop game" });
  }
});

// Get stop game message
router.get("/stop-game-message", authenticateAdmin, (req, res) => {
  try {
    res.json({
      success: true,
      message: stopGameMessage,
    });
  } catch (error) {
    console.error("Error getting stop message:", error);
    res.status(500).json({ error: "Failed to get stop message" });
  }
});

// Update stop game message
router.post("/stop-game-message", authenticateAdmin, (req, res) => {
  try {
    const { message } = req.body;
    const adminUsername = req.admin.username || "admin";

    if (message) {
      stopGameMessage = message.trim();
      console.log(`📝 Stop game message updated by ${adminUsername}`);
    }

    res.json({
      success: true,
      message: "Stop game message updated successfully",
      stopMessage: stopGameMessage,
      updatedBy: adminUsername,
    });
  } catch (error) {
    console.error("Error updating stop message:", error);
    res.status(500).json({ error: "Failed to update stop message" });
  }
});

// Resume game
router.post("/game-resume", authenticateAdmin, (req, res) => {
  try {
    const { adminUsername, reason } = req.body;

    if (!isGamePaused) {
      return res.status(400).json({
        success: false,
        error: "Game is not currently paused",
        isPaused: false,
      });
    }

    const resumedBy = adminUsername || req.admin.username || "admin";
    const resumedAt = new Date().toISOString();

    console.log(
      `▶️ Game resumed by ${resumedBy}: ${reason || "No reason provided"}`
    );

    isGamePaused = false;
    pausedBy = null;
    pausedAt = null;

    // Your existing broadcasts
    if (global.broadcastToAll) {
      global.broadcastToAll("game-resumed", {
        adminUsername: resumedBy,
        reason: reason,
        resumedAt: resumedAt,
      });
    }

    if (global.broadcastToAdmins) {
      global.broadcastToAdmins("game-resumed", {
        adminUsername: resumedBy,
        reason: reason,
        resumedAt: resumedAt,
      });
    }

    // 🚨 ADD THIS: Socket.io broadcast for pause handler
    if (io) {
      io.emit("game_resumed", {
        isPaused: false,
        resumedBy: resumedBy,
        resumedAt: resumedAt,
        message: reason || "Game has been resumed",
      });
      console.log("📡 Broadcasted game_resumed event via Socket.io");
    }

    res.json({
      success: true,
      message: `Game resumed by ${resumedBy}`,
      isPaused: false,
      resumedBy: resumedBy,
    });
  } catch (error) {
    console.error("Error resuming game:", error);
    res.status(500).json({ error: "Failed to resume game" });
  }
});

// ✅ NEW: Reset all data endpoint
router.post("/reset-all-data", authenticateAdmin, (req, res) => {
  try {
    const { adminUsername, confirmationCode } = req.body;

    // Require confirmation code
    if (confirmationCode !== "RESET_EVERYTHING_NOW") {
      return res.status(400).json({
        success: false,
        error: "Invalid confirmation code",
      });
    }

    const resetBy = adminUsername || req.admin.username || "admin";
    const resetAt = new Date().toISOString();

    console.log(`🗑️ DANGER: All data reset initiated by ${resetBy}`);

    // ✅ DEBUG: Log what will be cleared
    const allStreaks = storage.getAllStreaks();
    const streaksWithMax = allStreaks.filter(p => (p.maxStreak || 0) > 0);
    console.log(`🔍 RESET ALL - Will clear data for ${allStreaks.length} players, ${streaksWithMax.length} have max streaks > 0`);
    if (streaksWithMax.length > 0) {
      console.log(`🔍 RESET ALL - Players with max streaks:`,
        streaksWithMax.map(p => `${p.fullWallet.slice(0, 8)}: Max=${p.maxStreak}`).join(', ')
      );
    }

    // ✅ RESET EVERYTHING: Complete wipe of all player data
    console.log(`🗑️ COMPLETE WIPE - Removing ${storage.walletStreaks.size} players completely`);
    const removedPlayers = Array.from(storage.walletStreaks.keys()).map(w => w.slice(0, 8) + '...');
    if (removedPlayers.length > 0) {
      console.log(`🗑️ PLAYERS REMOVED:`, removedPlayers.join(', '));
    }

    storage.activeGames.clear();
    storage.walletStreaks.clear(); // Complete removal of all player data
    storage.dailyGames.clear();
    storage.assignedWords = {};

    // ✅ NEW: Auto-assign random words to all players after reset
    console.log("🎲 ADMIN RESET - Auto-assigning random words after data reset");
    storage.autoAssignRandomWordsToAllPlayers(true); // Force assignment after reset

    // ✅ CRITICAL: Save the cleared data to persistent files
    storage.saveStreaksToFile();
    storage.saveDailyGamesToFile();
    storage.saveAssignedWords(storage.assignedWords);

    console.log(`💾 RESET ALL - Persisted all cleared data to files`);

    // Reset game pause state
    isGamePaused = false;
    pausedBy = null;
    pausedAt = null;

    console.log(`✅ All data reset completed by ${resetBy}`);

    // ✅ NEW: Broadcast difficulty reset to all players
    if (global.broadcastToAll) {
      global.broadcastToAll("difficulty-reset", {
        resetBy: resetBy,
        resetAt: resetAt,
        message: "Difficulty reset - all rows restored to 6",
        rows: 6
      });
    }

    // Your existing broadcasts
    if (global.broadcastToAll) {
      global.broadcastToAll("game-reset", {
        adminUsername: resetBy,
        resetAt: resetAt,
        message: "All game data has been reset",
      });
    }

    if (global.broadcastToAdmins) {
      global.broadcastToAdmins("game-reset", {
        adminUsername: resetBy,
        resetAt: resetAt,
        message: "All game data has been reset",
      });
    }

    // 🚨 ADD THIS: Socket.io broadcast for pause handler
    if (io) {
      io.emit("game_reset", {
        resetBy: resetBy,
        resetAt: resetAt,
        message: "All game data has been reset",
      });
      console.log("📡 Broadcasted game_reset event via Socket.io");
    }

    res.json({
      success: true,
      message: `All data reset successfully by ${resetBy}`,
      resetBy: resetBy,
      resetAt: resetAt,
      itemsReset: {
        activeGames: "cleared",
        streaks: "cleared",
        dailyGames: "cleared",
        assignedWords: "cleared",
        gamePauseState: "reset",
      },
    });
  } catch (error) {
    console.error("Error resetting all data:", error);
    res.status(500).json({ error: "Failed to reset data" });
  }
});

// ✅ NEW: Countdown completion reset endpoint (no auth required - called automatically)
router.post("/countdown-completion-reset", (req, res) => {
  try {
    const { reason, timestamp } = req.body;

    // Verify this is called from countdown completion
    if (reason !== 'countdown_completion') {
      return res.status(400).json({
        success: false,
        error: "Invalid reset reason",
      });
    }

    const resetBy = "COUNTDOWN_SYSTEM";
    const resetAt = new Date().toISOString();

    console.log(`🕐 COUNTDOWN RESET: All data reset initiated by countdown completion at ${resetAt}`);

    // ✅ DEBUG: Log what will be cleared
    const allStreaks = storage.getAllStreaks();
    const streaksWithMax = allStreaks.filter(p => (p.maxStreak || 0) > 0);
    console.log(`🔍 COUNTDOWN RESET - Will clear data for ${allStreaks.length} players, ${streaksWithMax.length} have max streaks > 0`);

    if (streaksWithMax.length > 0) {
      console.log(`🔍 COUNTDOWN RESET - Players with max streaks:`,
        streaksWithMax.map(p => `${p.wallet.slice(0, 8)}: ${p.maxStreak}`).join(", ")
      );
    }

    // ✅ RESET EVERYTHING: Complete wipe of all player data
    storage.activeGames.clear();
    storage.walletStreaks.clear();
    storage.dailyGames.clear();
    storage.assignedWords = {}; // ✅ FIXED: Should be object, not array

    // ✅ NEW: Auto-assign random words to all players for new period
    console.log("🎲 COUNTDOWN RESET - Auto-assigning random words for new period");
    storage.autoAssignRandomWordsToAllPlayers(true); // Force assignment after countdown reset

    // Save the cleared state to files
    storage.saveActivesToFile();
    storage.saveStreaksToFile();
    storage.saveDailyGamesToFile();
    storage.saveAssignedWords(storage.assignedWords);

    console.log(`💾 COUNTDOWN RESET - Persisted all cleared data to files`);

    // Reset game pause and finish state
    isGamePaused = false;
    pausedBy = null;
    pausedAt = null;
    isGameFinished = false;
    finishedBy = null;
    finishedAt = null;
    finishLeaderboard = null;

    console.log(`✅ Countdown completion reset completed at ${resetAt}`);

    // ✅ NEW: Broadcast difficulty reset to all players for countdown completion
    if (global.broadcastToAll) {
      global.broadcastToAll("difficulty-reset", {
        resetBy: resetBy,
        resetAt: resetAt,
        message: "New period - difficulty reset to 6 rows for all players",
        rows: 6,
        reason: "countdown_completion"
      });
    }

    // Broadcast to all clients
    if (global.broadcastToAll) {
      global.broadcastToAll("game-reset", {
        adminUsername: resetBy,
        resetAt: resetAt,
        message: "New game period has begun - all data reset",
      });
    }

    // 🚨 Socket.io broadcast for pause handler
    if (io) {
      io.emit("game_reset", {
        resetBy: resetBy,
        resetAt: resetAt,
        message: "New game period has begun - all data reset",
      });
      console.log("📡 Broadcasted game_reset event via Socket.io");
    }

    res.json({
      success: true,
      message: `Countdown completion reset successful`,
      resetBy: resetBy,
      resetAt: resetAt,
      playersReset: allStreaks.length,
      itemsReset: {
        activeGames: "cleared",
        streaks: "cleared",
        dailyGames: "cleared",
        assignedWords: "cleared",
        gamePauseState: "reset",
        gameFinishState: "reset",
      },
    });
  } catch (error) {
    console.error("Error in countdown completion reset:", error);
    res.status(500).json({ error: "Failed to reset data" });
  }
});

// ✅ NEW: System status endpoint
router.get("/system-status", authenticateAdmin, (req, res) => {
  try {
    const allStreaks = storage.getAllStreaks();
    const debugInfo = storage.getDebugInfo();

    const status = {
      totalPlayers: allStreaks.length,
      activeGames: storage.activeGames.size,
      totalStreaks: storage.walletStreaks.size,
      dailyGameRecords: storage.dailyGames.size,
      isPaused: isGamePaused,
      pausedBy: pausedBy,
      pausedAt: pausedAt,
      currentPeriod: storage.getCurrentPeriodString(),
      timeUntilReset: storage.getTimeUntilNextReset(),
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 + " MB",
      uptime: Math.round(process.uptime()) + " seconds",
      serverTime: new Date().toISOString(),
      ...debugInfo,
    };

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("Error getting system status:", error);
    res.status(500).json({ error: "Failed to get system status" });
  }
});

// ✅ Reset specific player's streak (admin endpoint)
router.post(
  "/admin-reset-player-streak",
  authenticateAdmin,
  async (req, res) => {
    const { walletAddress, reason, adminUsername } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: "Missing wallet address" });
    }

    try {
      console.log(`🔍 ADMIN RESET START - Resetting streaks for ${walletAddress.slice(0, 8)}...`);

      const streakData = storage.getStreakData(walletAddress);
      const oldCurrentStreak = streakData.currentStreak;
      const oldMaxStreak = streakData.maxStreak || 0;

      console.log(`🔍 BEFORE RESET - ${walletAddress.slice(0, 8)}: Current=${oldCurrentStreak}, Max=${oldMaxStreak}`);

      if (oldCurrentStreak === 0 && oldMaxStreak === 0) {
        return res.json({
          success: true,
          data: streakData,
          message: "Player has no streaks to reset",
          oldCurrentStreak: 0,
          oldMaxStreak: 0,
          newCurrentStreak: 0,
          newMaxStreak: 0,
        });
      }

      // Reset both current and max streaks
      streakData.currentStreak = 0;
      streakData.maxStreak = 0;
      streakData.lastPlayedDate = storage.getTodayString();

      console.log(`🔍 AFTER RESET - ${walletAddress.slice(0, 8)}: Current=${streakData.currentStreak}, Max=${streakData.maxStreak}`);

      storage.markPlayedToday(walletAddress, {
        gameId: "admin_reset",
        isWin: false,
        guesses: 0,
        reason: reason || "admin_manual_reset",
        resetBy: adminUsername || "admin",
      });

      storage.saveStreakData(walletAddress, streakData);

      // ✅ VERIFICATION: Check data immediately after save
      const verifyData = storage.getStreakData(walletAddress);
      console.log(`🔍 VERIFICATION AFTER SAVE - ${walletAddress.slice(0, 8)}: Current=${verifyData.currentStreak}, Max=${verifyData.maxStreak}`);

      // ✅ NEW: Broadcast difficulty reset for the specific player
      if (global.broadcastToPlayer) {
        global.broadcastToPlayer(walletAddress, "difficulty-reset", {
          resetBy: adminUsername || "admin",
          resetAt: new Date().toISOString(),
          message: "Admin reset - difficulty restored to 6 rows",
          rows: 6,
          reason: "admin_manual_reset"
        });
      }

      // Broadcast admin reset
      if (global.broadcastToAdmins) {
        global.broadcastToAdmins("streak-reset", {
          walletAddress,
          oldCurrentStreak,
          oldMaxStreak,
          newCurrentStreak: 0,
          newMaxStreak: 0,
          reason: "admin_manual_reset",
          resetBy: adminUsername || "admin",
          timestamp: new Date().toISOString(),
          wasAdminReset: true,
        });
      }

      // ✅ FIX: Also broadcast to all players to update leaderboards
      if (global.broadcastToAll) {
        const allStreaks = storage.getAllStreaks();

        global.broadcastToAll("leaderboard-updated", {
          leaderboard: allStreaks
            .sort((a, b) => (b.maxStreak || 0) - (a.maxStreak || 0))
            .slice(0, 10),
          reason: "admin_streak_reset",
          updatedPlayer: walletAddress,
        });
      }

      console.log(
        `👨‍💼 Admin ${
          adminUsername || "admin"
        } reset streaks for ${walletAddress.slice(0, 8)}...: Current ${oldCurrentStreak} -> 0, Max ${oldMaxStreak} -> 0`
      );

      res.json({
        success: true,
        data: streakData,
        message: `Admin reset player streaks - Current: ${oldCurrentStreak} -> 0, Max: ${oldMaxStreak} -> 0`,
        oldCurrentStreak,
        oldMaxStreak,
        newCurrentStreak: 0,
        newMaxStreak: 0,
        resetBy: adminUsername || "admin",
      });
    } catch (error) {
      console.error("Error in admin streak reset:", error);
      res.status(500).json({ error: "Failed to reset player streak" });
    }
  }
);

// ✅ COMPLETELY FIXED: Enhanced smart word assignment with proper game detection
router.post("/assign-word", authenticateAdmin, async (req, res) => {
  try {
    const { walletAddress, word } = req.body;

    if (!walletAddress || !word) {
      return res
        .status(400)
        .json({ error: "Wallet address and word required" });
    }

    // Validate word format
    if (word.length !== 5 || !/^[a-z]+$/.test(word.toLowerCase())) {
      return res.status(400).json({
        error: "Word must be exactly 5 letters and contain only letters",
      });
    }

    const normalizedWord = word.toLowerCase();

    // ✅ CRITICAL FIX: Enhanced active game detection
    const activeGame = findActiveGameEnhanced(walletAddress);
    const gameStatus = analyzePlayerGameStatus(walletAddress, activeGame);

    console.log(`🔍 Enhanced game status for ${walletAddress.slice(0, 8)}...:`);
    console.log(`  Has Active Game: ${gameStatus.hasActiveGame}`);
    console.log(`  Game Age: ${gameStatus.gameAge}ms`);
    console.log(`  Guess Count: ${gameStatus.guessCount}`);
    console.log(`  Can Change Current: ${gameStatus.canChangeCurrentWord}`);
    console.log(`  Assignment Strategy: ${gameStatus.assignmentStrategy}`);

    if (gameStatus.hasActiveGame && gameStatus.canChangeCurrentWord) {
      // ✅ STRATEGY 1: Change current word (no guesses yet)
      console.log(
        `🎮 Changing current word for active player: ${walletAddress.slice(
          0,
          8
        )}...`
      );

      activeGame.answer = normalizedWord;
      storage.saveGame(activeGame);

      // Mark assigned word as used to prevent conflicts
      markAssignedWordAsUsed(walletAddress, normalizedWord);

      // Broadcast to WebSocket if available
      if (global.broadcastToAdmins) {
        global.broadcastToAdmins("current-word-changed", {
          walletAddress,
          word: normalizedWord,
          gameId: activeGame.gameId,
          assignedBy: req.admin.username,
          timestamp: new Date().toISOString(),
        });
      }

      return res.json({
        success: true,
        type: "current_game_updated",
        message: `Current word changed to "${normalizedWord.toUpperCase()}" for active player ${walletAddress.slice(
          0,
          8
        )}...`,
        data: {
          walletAddress,
          word: normalizedWord,
          gameId: activeGame.gameId,
          gameGuesses: activeGame.guesses.length,
          assignedBy: req.admin.username,
          gameStatus: gameStatus,
        },
      });
    } else if (gameStatus.hasActiveGame && !gameStatus.canChangeCurrentWord) {
      // ✅ STRATEGY 2: Player already made guesses - assign for next game
      console.log(
        `🔄 Player has guesses, assigning for next game: ${walletAddress.slice(
          0,
          8
        )}...`
      );

      const assignmentResult = assignWordForNextGame(
        walletAddress,
        normalizedWord,
        req.admin.username
      );

      return res.json({
        success: true,
        type: "next_game_assigned",
        message: `Player has made ${
          activeGame.guesses.length
        } guesses. Word "${normalizedWord.toUpperCase()}" assigned for next game.`,
        data: {
          ...assignmentResult,
          gameStatus: gameStatus,
        },
      });
    } else {
      // ✅ STRATEGY 3: No active game - assign for when they connect/play
      console.log(
        `💤 Assigning word for disconnected player: ${walletAddress.slice(
          0,
          8
        )}...`
      );

      const assignmentResult = assignWordForNextGame(
        walletAddress,
        normalizedWord,
        req.admin.username
      );

      return res.json({
        success: true,
        type: "disconnected_player_assigned",
        message: `Word "${normalizedWord.toUpperCase()}" assigned for when ${walletAddress.slice(
          0,
          8
        )}... next plays.`,
        data: {
          ...assignmentResult,
          gameStatus: gameStatus,
        },
      });
    }
  } catch (error) {
    console.error("Error in smart word assignment:", error);
    res.status(500).json({ error: "Failed to assign word" });
  }
});

// ✅ COMPLETELY REWRITTEN: Enhanced active game detection
function findActiveGameEnhanced(walletAddress) {
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  console.log(
    `🔍 Enhanced search for active game: ${walletAddress.slice(0, 8)}...`
  );
  console.log(`📊 Total active games in storage: ${storage.activeGames.size}`);

  let bestMatch = null;
  let newestGame = null;

  for (let [gameId, game] of storage.activeGames.entries()) {
    console.log(`  🎮 Checking game ${gameId}:`);
    console.log(`    Wallet: ${game.walletAddress?.slice(0, 8)}...`);
    console.log(`    Complete: ${game.isComplete}`);
    console.log(`    Age: ${now - game.startTime}ms`);
    console.log(`    Guesses: ${game.guesses?.length || 0}`);

    // Must match wallet address
    if (game.walletAddress !== walletAddress) {
      console.log(`    ❌ Wallet mismatch`);
      continue;
    }

    // Must not be complete
    if (game.isComplete) {
      console.log(`    ❌ Game is complete`);
      continue;
    }

    const gameAge = now - game.startTime;

    // Track the newest game for this wallet (even if old)
    if (!newestGame || game.startTime > newestGame.startTime) {
      newestGame = game;
    }

    // Prefer games within current period (1 minute)
    if (gameAge <= fiveMinutes) {
      console.log(`    ✅ Valid current period game`);
      if (!bestMatch || game.startTime > bestMatch.startTime) {
        bestMatch = game;
      }
    } else {
      console.log(`    ⚠️ Game too old (${Math.round(gameAge / 1000)}s)`);
    }
  }

  // If no current period game, but we have a recent game, consider it
  if (!bestMatch && newestGame) {
    const newestAge = now - newestGame.startTime;
    // Allow up to 10 minutes for edge cases (2 periods)
    if (newestAge <= 10 * 60 * 1000) {
      console.log(
        `    🕐 Using newest game despite age: ${Math.round(newestAge / 1000)}s`
      );
      bestMatch = newestGame;
    }
  }

  if (bestMatch) {
    console.log(
      `✅ Found active game: ${bestMatch.gameId} (${
        bestMatch.guesses?.length || 0
      } guesses)`
    );
  } else {
    console.log(`❌ No active game found for ${walletAddress.slice(0, 8)}...`);
  }

  return bestMatch;
}

// ✅ NEW: Analyze player game status comprehensively
function analyzePlayerGameStatus(walletAddress, activeGame) {
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  if (!activeGame) {
    return {
      hasActiveGame: false,
      canChangeCurrentWord: false,
      assignmentStrategy: "next_game",
      gameAge: null,
      guessCount: 0,
      statusReason: "no_active_game",
    };
  }

  const gameAge = now - activeGame.startTime;
  const guessCount = activeGame.guesses?.length || 0;
  const isCurrentPeriod = gameAge <= fiveMinutes;
  const canChangeCurrentWord = isCurrentPeriod && guessCount === 0;

  let assignmentStrategy;
  let statusReason;

  if (canChangeCurrentWord) {
    assignmentStrategy = "change_current";
    statusReason = "active_no_guesses";
  } else if (isCurrentPeriod && guessCount > 0) {
    assignmentStrategy = "next_game";
    statusReason = "active_with_guesses";
  } else {
    assignmentStrategy = "next_game";
    statusReason = "game_too_old";
  }

  return {
    hasActiveGame: true,
    canChangeCurrentWord,
    assignmentStrategy,
    gameAge,
    guessCount,
    statusReason,
    isCurrentPeriod,
    gameId: activeGame.gameId,
  };
}

// ✅ ENHANCED: Get all players data with real-time game status
router.get("/players", authenticateAdmin, async (req, res) => {
  try {
    const allStreaks = storage.getAllStreaks();
    const assignedWords = storage.getAssignedWords();
    const now = Date.now();

    console.log(
      `📊 Processing ${allStreaks.length} players with enhanced game status...`
    );

    // Transform data to match expected format with enhanced game detection
    const playersWithStats = allStreaks.map((player, globalIndex) => {
      const walletAddress = player.fullWallet;

      // Get next unused word for this player
      const playerWords = assignedWords[walletAddress] || [];
      const nextWord = playerWords.find((w) => !w.used);

      // ✅ CRITICAL FIX: Use enhanced active game detection (moved up)
      const activeGame = findActiveGameEnhanced(walletAddress);
      const gameStatus = analyzePlayerGameStatus(walletAddress, activeGame);

      // ✅ NEW: Get actual current/next word (not just assigned word)
      let displayWord = "Random";
      if (gameStatus.hasActiveGame && activeGame && activeGame.answer) {
        // Player has active game - show current word they're solving
        displayWord = activeGame.answer.toUpperCase();
      } else if (nextWord) {
        // Player has assigned word for next game
        displayWord = nextWord.word.toUpperCase();
      } else {
        // ✅ FIXED: Be more conservative about showing random words
        // Only show a preview word if the player has never had any assigned words
        const hasNeverHadWords = playerWords.length === 0;
        if (hasNeverHadWords) {
          // New player - show what word they would get
          const nextRandomWord = storage.getNextWordForPlayer ? storage.getNextWordForPlayer(walletAddress) : null;
          if (nextRandomWord) {
            displayWord = nextRandomWord.toUpperCase();
          }
        } else {
          // Player has had words before - just show "Pending" until they get a new assignment
          displayWord = "Pending";
        }
      }

      // ✅ Enhanced game status display
      let gameStatusText = "💤 Offline";
      let gameStatusClass = "offline";

      if (gameStatus.hasActiveGame) {
        const ageMinutes = Math.round(gameStatus.gameAge / 60000);
        const ageSeconds = Math.round((gameStatus.gameAge % 60000) / 1000);

        if (gameStatus.isCurrentPeriod) {
          if (gameStatus.guessCount === 0) {
            gameStatusText = `🎮 Active (${ageMinutes}m${ageSeconds}s, no guesses)`;
            gameStatusClass = "active";
          } else {
            gameStatusText = `🎮 Active (${gameStatus.guessCount} guesses, ${ageMinutes}m${ageSeconds}s)`;
            gameStatusClass = "active";
          }
        } else {
          gameStatusText = `⏰ Recent Game (${ageMinutes}m${ageSeconds}s ago)`;
          gameStatusClass = "recent";
        }
      }


      // ✅ AGGRESSIVE DEBUG: Log EVERY player's maxStreak
      console.log(`🔍 PLAYER ${walletAddress.slice(0, 8)}: Raw=${JSON.stringify({currentStreak: player.currentStreak, maxStreak: player.maxStreak})}`);

      return {
        wallet_address: walletAddress,
        current_streak: player.currentStreak || 0,
        max_streak: player.maxStreak || 0,
        total_games_played: player.gamesPlayed || 0,
        total_games_won: player.gamesWon || 0,
        avg_guesses_per_win:
          player.gamesWon > 0
            ? (
                (player.totalGuesses || player.gamesWon * 4) / player.gamesWon
              ).toFixed(1)
            : "N/A",
        next_word: displayWord,
        last_played_date: player.lastPlayedDate || "Unknown",
        assigned_words_count: playerWords.length,
        unused_words_count: playerWords.filter((w) => !w.used).length,

        // ✅ ENHANCED: Real-time game status
        has_active_game: gameStatus.hasActiveGame,
        active_game_guesses: gameStatus.guessCount,
        can_change_current_word: gameStatus.canChangeCurrentWord,
        game_status_text: gameStatusText,
        game_status_class: gameStatusClass,
        game_age_ms: gameStatus.gameAge,
        assignment_strategy: gameStatus.assignmentStrategy,
        status_reason: gameStatus.statusReason,

        // Additional debug info
        active_game_id: gameStatus.gameId || null,
        is_current_period: gameStatus.isCurrentPeriod || false,
      };
    });

    // ✅ Sort by game activity first, then by streak
    playersWithStats.sort((a, b) => {
      // Active games first
      if (a.has_active_game && !b.has_active_game) return -1;
      if (!a.has_active_game && b.has_active_game) return 1;

      // Then by current streak
      if (b.current_streak !== a.current_streak) {
        return b.current_streak - a.current_streak;
      }

      // Then by max streak
      return b.max_streak - a.max_streak;
    });

    console.log(`✅ Enhanced player data processed:`);
    console.log(`  Total players: ${playersWithStats.length}`);
    console.log(
      `  Active games: ${
        playersWithStats.filter((p) => p.has_active_game).length
      }`
    );
    console.log(
      `  Can change current word: ${
        playersWithStats.filter((p) => p.can_change_current_word).length
      }`
    );

    res.json({
      success: true,
      data: playersWithStats,
      total: playersWithStats.length,
      debug: {
        timestamp: new Date().toISOString(),
        total_active_games: storage.activeGames.size,
        active_players: playersWithStats.filter((p) => p.has_active_game)
          .length,
        current_period_players: playersWithStats.filter(
          (p) => p.is_current_period
        ).length,
      },
    });
  } catch (error) {
    console.error("Error getting enhanced players:", error);
    res.status(500).json({ error: "Failed to get players data" });
  }
});

// ✅ Helper function for next game assignment (unchanged)
function assignWordForNextGame(walletAddress, word, adminUsername) {
  const assignedWords = storage.getAssignedWords();

  if (!assignedWords[walletAddress]) {
    assignedWords[walletAddress] = [];
  }

  const assignment = {
    word: word,
    assignedAt: new Date().toISOString(),
    used: false,
    assignedBy: adminUsername,
    type: "next_game",
  };

  assignedWords[walletAddress].push(assignment);
  storage.saveAssignedWords(assignedWords);

  console.log(
    `✅ Word "${word}" assigned to ${walletAddress.slice(
      0,
      8
    )}... for next game by admin ${adminUsername}`
  );

  // Broadcast word assignment
  if (global.broadcastToAdmins) {
    global.broadcastToAdmins("word-assigned", {
      walletAddress,
      word: word,
      assignedBy: adminUsername,
      type: "next_game",
      timestamp: new Date().toISOString(),
    });
  }

  return {
    walletAddress,
    word: word,
    assignedAt: assignment.assignedAt,
    assignedBy: adminUsername,
    type: "next_game",
  };
}

// ✅ Helper function to mark word as used (unchanged)
function markAssignedWordAsUsed(walletAddress, word) {
  const assignedWords = storage.getAssignedWords();
  const playerWords = assignedWords[walletAddress] || [];
  const wordAssignment = playerWords.find((w) => w.word === word && !w.used);

  if (wordAssignment) {
    wordAssignment.used = true;
    wordAssignment.usedAt = new Date().toISOString();
    storage.saveAssignedWords(assignedWords);
    console.log(
      `✅ Marked assigned word "${word}" as used for ${walletAddress.slice(
        0,
        8
      )}...`
    );
  }
}

// ✅ Get database statistics (unchanged)
router.get("/stats", authenticateAdmin, async (req, res) => {
  try {
    const allStreaks = storage.getAllStreaks();
    const assignedWords = storage.getAssignedWords();

    const totalPlayers = allStreaks.length;
    const totalGamesPlayed = allStreaks.reduce(
      (sum, p) => sum + (p.gamesPlayed || 0),
      0
    );
    const totalGamesWon = allStreaks.reduce(
      (sum, p) => sum + (p.gamesWon || 0),
      0
    );
    const averageWinRate =
      totalGamesPlayed > 0
        ? ((totalGamesWon / totalGamesPlayed) * 100).toFixed(1)
        : 0;

    // Count total word assignments
    const totalWordAssignments = Object.values(assignedWords).reduce(
      (sum, words) => sum + words.length,
      0
    );

    // ✅ Enhanced active games count using new detection
    let activeGamesCount = 0;
    let currentPeriodGames = 0;

    for (const player of allStreaks) {
      const activeGame = findActiveGameEnhanced(player.fullWallet);
      if (activeGame) {
        activeGamesCount++;
        const gameStatus = analyzePlayerGameStatus(
          player.fullWallet,
          activeGame
        );
        if (gameStatus.isCurrentPeriod) {
          currentPeriodGames++;
        }
      }
    }

    const topStreaks = allStreaks
      .sort((a, b) => (b.currentStreak || 0) - (a.currentStreak || 0))
      .slice(0, 5)
      .map((player) => ({
        wallet_address: player.wallet,
        current_streak: player.currentStreak || 0,
        max_streak: player.maxStreak || 0,
        total_games_played: player.gamesPlayed || 0,
        total_games_won: player.gamesWon || 0,
      }));

    res.json({
      success: true,
      data: {
        totalPlayers,
        totalGamesPlayed,
        totalGamesWon,
        totalWordAssignments,
        activeGamesCount,
        currentPeriodGames,
        averageWinRate: `${averageWinRate}%`,
        topStreaks,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error getting stats:", error);
    res.status(500).json({ error: "Failed to get statistics" });
  }
});

// ✅ Get specific player data
router.get("/player/:walletAddress", authenticateAdmin, async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const streakData = storage.getStreakData(walletAddress);
    const assignedWords = storage.getAssignedWords();
    const playerWords = assignedWords[walletAddress] || [];
    const activeGame = findActiveGameEnhanced(walletAddress);
    const gameStatus = analyzePlayerGameStatus(walletAddress, activeGame);

    if (!streakData && playerWords.length === 0) {
      return res.status(404).json({ error: "Player not found" });
    }

    res.json({
      success: true,
      data: {
        player: {
          wallet_address: walletAddress,
          current_streak: streakData?.currentStreak || 0,
          max_streak: streakData?.maxStreak || 0,
          total_games_played: streakData?.gamesPlayed || 0,
          total_games_won: streakData?.gamesWon || 0,
          last_played_date: streakData?.lastPlayedDate || "Never",
          assigned_words: playerWords,
          next_word: playerWords.find((w) => !w.used)?.word || "Random",

          // Enhanced game status
          has_active_game: gameStatus.hasActiveGame,
          can_change_current_word: gameStatus.canChangeCurrentWord,
          game_status: gameStatus,
        },
        gameHistory: [], // Will be empty until database is implemented
      },
    });
  } catch (error) {
    console.error("Error getting player stats:", error);
    res.status(500).json({ error: "Failed to get player stats" });
  }
});

// ✅ Creator fees and burn tracking endpoints
const PumpFunScraper = require("../utils/pumpFunScraper");
const TokenBurnTracker = require("../utils/tokenBurnTracker");

// Initialize the scraper and burn tracker instances
const pumpFunScraper = new PumpFunScraper();
const tokenBurnTracker = new TokenBurnTracker();

// Creator fees endpoint (main)
router.get("/creator-fees", async (req, res) => {
  try {
    console.log("📊 Admin requesting creator fees data...");

    const creatorData = await pumpFunScraper.getCreatorRewards(false); // Use cache if available

    console.log(`💰 Creator fees: ${creatorData.totalFeesSOL} SOL`);
    console.log(`🔄 Data source: ${creatorData.source}`);

    res.json({
      success: true,
      data: creatorData,
      source: creatorData.source,
      cached: creatorData.cached || false,
      lastUpdated: creatorData.lastUpdated,
    });
  } catch (error) {
    console.error("❌ Error fetching creator fees:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch creator fees",
      details: error.message,
    });
  }
});

// Creator fees endpoint (fresh)
router.get("/creator-fees/fresh", async (req, res) => {
  try {
    console.log("🔄 Admin requesting fresh creator fees data...");

    const creatorData = await pumpFunScraper.getCreatorRewards(true); // Force fresh

    console.log(`💰 Fresh creator fees: ${creatorData.totalFeesSOL} SOL`);

    res.json({
      success: true,
      data: creatorData,
      source: creatorData.source,
      forced: true,
      lastUpdated: creatorData.lastUpdated,
    });
  } catch (error) {
    console.error("❌ Error fetching fresh creator fees:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch fresh creator fees",
      details: error.message,
    });
  }
});

// Update creator wallet address
router.post("/creator-fees", async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (walletAddress) {
      // Update the wallet address
      pumpFunScraper.profileAddress = walletAddress;
      pumpFunScraper.lastScrapedData = null; // Clear cache

      // Also update the Playwright scraper if it exists
      if (pumpFunScraper.playwrightScraper) {
        pumpFunScraper.playwrightScraper.profileAddress = walletAddress;
        pumpFunScraper.playwrightScraper.profileUrl = `https://pump.fun/profile/${walletAddress}?tab=coins`;
      }

      console.log(`Updated creator wallet to: ${walletAddress}`);
    }

    // Get fresh data
    const data = await pumpFunScraper.getCreatorRewards(true);

    res.json({
      success: true,
      data: data,
      message: walletAddress ? "Wallet updated successfully" : "Data refreshed",
    });
  } catch (error) {
    console.error("Error updating creator wallet:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get token burn data
router.get("/token-burn", async (req, res) => {
  try {
    const { tokenAddress } = req.query;

    if (!tokenAddress) {
      return res.status(400).json({
        success: false,
        error: "Token address is required",
      });
    }

    const burnData = await tokenBurnTracker.getBurnData(tokenAddress);

    res.json({
      success: true,
      data: burnData,
    });
  } catch (error) {
    console.error("Error getting token burn data:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Update token burn configuration
router.post("/token-burn/config", async (req, res) => {
  try {
    const { tokenAddress, initialSupply } = req.body;

    if (!tokenAddress) {
      return res.status(400).json({
        success: false,
        error: "Token address is required",
      });
    }

    // Test the token address first
    const burnData = await tokenBurnTracker.getBurnData(tokenAddress, true);

    if (burnData.error) {
      return res.status(400).json({
        success: false,
        error: `Invalid token address: ${burnData.error}`,
      });
    }

    // Store the configuration (you might want to save this to a database)
    tokenBurnTracker.tokenAddress = tokenAddress;
    if (initialSupply) {
      tokenBurnTracker.initialSupply = initialSupply;
    }

    res.json({
      success: true,
      data: burnData,
      message: "Token burn tracking configured successfully",
    });
  } catch (error) {
    console.error("Error configuring token burn:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ✅ Helper function to check if game is paused (for other routes)
function checkGamePauseMiddleware(req, res, next) {
  if (isGamePaused) {
    return res.status(503).json({
      success: false,
      error: "Game is currently paused by administrator",
      isPaused: true,
      pausedBy: pausedBy,
      pausedAt: pausedAt,
    });
  }
  next();
}

/**
 * Update social links (X and Pump.fun)
 */
router.post("/update-social-links", authenticateAdmin, async (req, res) => {
  try {
    const { type, url } = req.body;
    const adminUsername = req.admin.username || "admin";

    if (!type || !url) {
      return res.status(400).json({
        success: false,
        error: "Missing type or URL",
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: "Invalid URL format",
      });
    }

    // Validate type
    if (!["x", "pf"].includes(type)) {
      return res.status(400).json({
        success: false,
        error: "Invalid link type. Must be 'x' or 'pf'",
      });
    }

    // Read the current frontend HTML file
    const fs = require("fs");
    const path = require("path");
    const frontendPath = path.join(__dirname, "../../frontend/index.html");

    if (!fs.existsSync(frontendPath)) {
      return res.status(500).json({
        success: false,
        error: "Frontend HTML file not found",
      });
    }

    let htmlContent = fs.readFileSync(frontendPath, "utf8");

    // Update the appropriate link based on type
    if (type === "x") {
      // Update X (Twitter) link
      const xLinkRegex = /href="https:\/\/x\.com[^"]*"/g;
      const newXLink = `href="${url}"`;

      if (xLinkRegex.test(htmlContent)) {
        htmlContent = htmlContent.replace(xLinkRegex, newXLink);
      } else {
        // If no existing X link found, look for the header-button-x pattern
        const xButtonRegex =
          /(class="header-left-button header-button-x"[^>]*\s+href=")[^"]*(")/g;
        if (xButtonRegex.test(htmlContent)) {
          htmlContent = htmlContent.replace(xButtonRegex, `$1${url}$2`);
        } else {
          return res.status(404).json({
            success: false,
            error: "X link element not found in HTML",
          });
        }
      }
    } else if (type === "pf") {
      // Update Pump.fun link
      const pfLinkRegex = /href="https:\/\/pump\.fun[^"]*"/g;
      const newPfLink = `href="${url}"`;

      if (pfLinkRegex.test(htmlContent)) {
        htmlContent = htmlContent.replace(pfLinkRegex, newPfLink);
      } else {
        // If no existing pump.fun link found, look for the header-button-pf pattern
        const pfButtonRegex =
          /(class="header-left-button header-button-pf"[^>]*\s+href=")[^"]*(")/g;
        if (pfButtonRegex.test(htmlContent)) {
          htmlContent = htmlContent.replace(pfButtonRegex, `$1${url}$2`);
        } else {
          return res.status(404).json({
            success: false,
            error: "Pump.fun link element not found in HTML",
          });
        }
      }
    }

    // Write the updated HTML back to file
    fs.writeFileSync(frontendPath, htmlContent, "utf8");

    // Log the change
    const linkType = type === "x" ? "X (Twitter)" : "Pump.fun";
    console.log(`🔗 ${linkType} link updated by ${adminUsername}: ${url}`);

    // Broadcast to admins if WebSocket is available
    if (global.broadcastToAdmins) {
      global.broadcastToAdmins("social-link-updated", {
        type,
        url,
        linkType,
        updatedBy: adminUsername,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      message: `${linkType} link updated successfully`,
      type,
      url,
      updatedBy: adminUsername,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating social links:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update social links",
      details: error.message,
    });
  }
});

// ✅ NEW: Cancel game endpoint - removes the finish modal from players
router.post("/game-cancel", authenticateAdmin, (req, res) => {
  try {
    console.log("🚫 CANCEL GAME ROUTE CALLED - req.body:", req.body);
    const { adminUsername } = req.body;
    const cancelledBy = adminUsername || req.admin.username || "admin";
    const cancelledAt = new Date().toISOString();

    console.log(`🚫 Game CANCELLED by ${cancelledBy}`);

    // Reset game finish state
    isGameFinished = false;
    finishedBy = null;
    finishedAt = null;
    finishLeaderboard = null;

    // Broadcast cancellation to all connected clients
    if (global.broadcastToAll) {
      global.broadcastToAll("game-cancelled", {
        cancelledBy: cancelledBy,
        cancelledAt: cancelledAt,
        message: "Game has been resumed.",
      });
    }

    if (io) {
      io.emit("game_cancelled", {
        cancelledBy: cancelledBy,
        cancelledAt: cancelledAt,
        message: "Game has been resumed.",
      });
    }

    console.log("🚫 Game cancelled successfully");
    res.json({
      success: true,
      message: `Game cancelled by ${cancelledBy}`,
      cancelledBy: cancelledBy,
      cancelledAt: cancelledAt,
    });
  } catch (error) {
    console.error("🚫 Error cancelling game:", error);
    res.status(500).json({
      success: false,
      error: "Failed to cancel game",
      details: error.message,
    });
  }
});

let io;

// Function to set the io instance
function setSocketIO(socketIO) {
  io = socketIO;
  console.log("✅ Socket.io instance set in admin routes");
}

// ✅ Export pause check functions for use in game routes
module.exports.checkGamePauseMiddleware = checkGamePauseMiddleware;
module.exports.isGameCurrentlyPaused = () => isGamePaused;
module.exports.getPauseInfo = () => ({
  isPaused: isGamePaused,
  pausedBy: pausedBy,
  pausedAt: pausedAt,
});

// ✅ Export finish status functions for use in game routes
module.exports.isGameCurrentlyFinished = () => isGameFinished;
module.exports.getFinishInfo = () => ({
  isFinished: isGameFinished,
  finishedBy: finishedBy,
  finishedAt: finishedAt,
  leaderboard: finishLeaderboard,
});

module.exports = router;
module.exports.setSocketIO = setSocketIO;
// Export your other existing functions too...
module.exports.isGameCurrentlyPaused = isGameCurrentlyPaused;
module.exports.getPauseInfo = getPauseInfo;
