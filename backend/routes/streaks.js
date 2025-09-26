// ============================== ENHANCED STREAK ROUTES ==============================
// Updated backend/routes/streaks.js with game status awareness

const express = require("express");
const router = express.Router();
const storage = require("../data/storage");

// ✅ NEW: Helper function to check if player won current period
async function checkPlayerWonCurrentPeriod(walletAddress) {
  try {
    return storage.hasWonCurrentPeriod(walletAddress);
  } catch (error) {
    console.error("Error checking if player won current period:", error);
    return false;
  }
}

// ✅ NEW: Helper function to check for incomplete games
async function checkPlayerHasIncompleteGame(walletAddress) {
  try {
    for (let [gameId, game] of storage.activeGames.entries()) {
      if (game.walletAddress === walletAddress && !game.isComplete) {
        const gameAge = Date.now() - game.startTime;
        const fiveMinutes = 5 * 60 * 1000;

        if (gameAge <= fiveMinutes) {
          return { hasIncomplete: true, gameId, game };
        }
      }
    }

    return { hasIncomplete: false, gameId: null, game: null };
  } catch (error) {
    console.error("Error checking for incomplete games:", error);
    return { hasIncomplete: false, gameId: null, game: null };
  }
}

// GET /api/streak/:walletAddress - Get streak data
router.get("/streak/:walletAddress", (req, res) => {
  const { walletAddress } = req.params;

  try {
    const streakData = storage.getStreakData(walletAddress);
    res.json({
      success: true,
      data: streakData,
    });
  } catch (error) {
    console.error("Error getting streak data:", error);
    res.status(500).json({ error: "Failed to get streak data" });
  }
});

// POST /api/game-complete - Called automatically when game completes
router.post("/game-complete", async (req, res) => {
  const { gameId, walletAddress } = req.body;
  console.log("🔧 STREAK API CALLED: game-complete", { gameId: gameId?.slice(0, 8), wallet: walletAddress?.slice(0, 8) });

  if (!gameId || !walletAddress) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Get and verify game
  const game = storage.getGame(gameId);
  if (!game) {
    console.log(`🔍 Game ${gameId.slice(0, 8)}... not found in active storage, checking period data...`);

    // ✅ FIX: Handle case where game was already processed (e.g., incomplete game during period transition)
    // Check if there's period data for this game
    const periodGameData = storage.getCurrentPeriodGameData(walletAddress);
    console.log(`🔍 Period data check for ${walletAddress.slice(0, 8)}...:`, periodGameData ? 'FOUND' : 'NOT FOUND');

    if (periodGameData) {
      console.log(`🔍 Period data details:`, {
        gameId: periodGameData.gameId,
        targetGameId: gameId,
        isWin: periodGameData.isWin,
        gameIdsMatch: periodGameData.gameId === gameId
      });
    }

    if (periodGameData && periodGameData.gameId === gameId) {
      console.log(`🔍 ✅ Game ${gameId.slice(0, 8)}... found in period data - returning processed result`);

      // Return current streak data since the game was already processed
      const streakData = storage.getStreakData(walletAddress);
      return res.json({
        success: true,
        data: streakData,
        message: periodGameData.isWin ?
          `Congratulations! Current streak: ${streakData.currentStreak}` :
          "Game over! Streak reset to 0",
        alreadyProcessed: true
      });
    }

    console.log(`🔍 ❌ Game ${gameId.slice(0, 8)}... not found in active storage OR period data`);
    return res.status(404).json({ error: "Game not found" });
  }

  if (game.walletAddress !== walletAddress) {
    return res.status(403).json({ error: "Not your game" });
  }

  if (!game.isComplete) {
    return res.status(400).json({ error: "Game not completed" });
  }

  // ✅ NEW: Save complete game data directly to period storage
  console.log("🔧 STREAK DEBUG: Saving complete game data to period storage");
  try {
    storage.markPlayedToday(walletAddress, {
      gameId: game.gameId,
      isWin: game.isWin,
      isComplete: true,
      answer: game.answer,
      guesses: game.guesses,
      maxGuesses: game.maxGuesses,
      startTime: game.startTime,
      completedAt: Date.now(),
    });
    console.log("🔧 STREAK DEBUG: Game data saved to period storage successfully");
  } catch (error) {
    console.error("🔧 STREAK DEBUG: Error saving game data to period storage:", error);
  }

  // ✅ FIXED: Streaks are now calculated in game engine automatically
  // Just return the current streak data and clean up the game
  try {
    const streakData = storage.getStreakData(walletAddress);
    const isWin = game.isWin;

    console.log(`🔧 STREAK API: Returning streak data for ${walletAddress.slice(0, 8)}... (streak: ${streakData.currentStreak})`);

    // Clean up the completed game from active games
    storage.deleteGame(gameId);

    // ✅ NEW: Process treasury transaction (burn or return tokens) - ASYNC, NON-BLOCKING
    setImmediate(async () => {
      try {
        const treasury = require("../treasury");
        const depositAmount = 100000; // Updated deposit amount

        if (isWin) {
          console.log(`🎉 Processing token return for winner: ${walletAddress.slice(0, 8)}...`);
          const returnResult = await treasury.returnTokensToWinner(walletAddress, depositAmount);

          if (returnResult.success) {
            console.log(`✅ Successfully returned ${depositAmount.toLocaleString()} BURN to winner`);

            // Notify frontend that tokens were returned
            console.log(`📡 Attempting to emit tokenReturned WebSocket event...`);
            if (global.io) {
              console.log(`📡 Emitting tokenReturned for ${walletAddress.slice(0, 8)}... (${depositAmount.toLocaleString()} BURN)`);
              global.io.emit('tokenReturned', {
                walletAddress: walletAddress,
                amount: depositAmount
              });
              console.log(`✅ WebSocket tokenReturned event emitted successfully`);
            } else {
              console.error(`❌ global.io is not available - cannot emit WebSocket event`);
            }
          } else {
            console.error(`❌ Failed to return tokens to winner: ${returnResult.error}`);
          }
        } else {
          console.log(`🔥 Processing token burn for game loss`);
          const burnResult = await treasury.burnTokens(depositAmount);

          if (burnResult.success) {
            console.log(`✅ Successfully burned ${depositAmount.toLocaleString()} BURN tokens`);

            // Notify frontend that tokens were burned
            console.log(`📡 Attempting to emit tokenBurned WebSocket event...`);
            if (global.io) {
              console.log(`📡 Emitting tokenBurned for ${walletAddress.slice(0, 8)}... (${depositAmount.toLocaleString()} BURN)`);
              global.io.emit('tokenBurned', {
                walletAddress: walletAddress,
                amount: depositAmount
              });
              console.log(`✅ WebSocket tokenBurned event emitted successfully`);
            } else {
              console.error(`❌ global.io is not available - cannot emit WebSocket event`);
            }
          } else {
            console.error(`❌ Failed to burn tokens: ${burnResult.error}`);
          }
        }
      } catch (error) {
        console.error("❌ Error processing treasury transaction:", error);
        // Don't fail the game completion if treasury fails - log and continue
      }
    });

    // ✅ WEBSOCKET: Broadcast leaderboard update to all
    if (global.broadcastToAll) {
      const leaderboard = storage
        .getAllStreaks()
        .sort((a, b) => b.currentStreak - a.currentStreak)
        .slice(0, 10);

      global.broadcastToAll("leaderboard-updated", {
        leaderboard,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(
      `✅ Game complete processed for ${walletAddress.slice(0, 8)}...: ${
        isWin ? "WIN" : "LOSS"
      } (current streak: ${streakData.currentStreak})`
    );

    res.json({
      success: true,
      data: streakData,
      message: isWin
        ? `Congratulations! Current streak: ${streakData.currentStreak}`
        : "Game over! Streak reset to 0",
    });
  } catch (error) {
    console.error("Error updating streak:", error);
    res.status(500).json({ error: "Failed to update streak" });
  }
});

// ✅ ENHANCED: Handle incomplete games with game status checking
router.post("/handle-incomplete-game", async (req, res) => {
  const { walletAddress, gameId, reason, broadcastToAdmins } = req.body;

  if (!walletAddress) {
    return res.status(400).json({ error: "Missing wallet address" });
  }

  try {
    const streakData = storage.getStreakData(walletAddress);
    const oldStreak = streakData.currentStreak;
    const today = storage.getTodayString(); // Current period

    // ✅ CRITICAL FIX: Check if player won current period before resetting
    const wonCurrentPeriod = await checkPlayerWonCurrentPeriod(walletAddress);

    if (wonCurrentPeriod) {
      console.log(
        `🏆 Player ${walletAddress.slice(
          0,
          8
        )}... won current period - preserving streak despite incomplete game`
      );

      res.json({
        success: true,
        data: streakData,
        message:
          "Game was incomplete but you won this period - streak preserved",
        oldStreak,
        newStreak: oldStreak,
        streakPreserved: true,
        reason: "won_current_period",
      });

      return;
    }

    // Only reset if they had a streak and didn't win this period
    if (oldStreak > 0) {
      streakData.currentStreak = 0;
      streakData.lastPlayedDate = today;

      // ✅ CRITICAL FIX: Mark as played this period (not daily)
      storage.markPlayedToday(walletAddress, {
        gameId: gameId || "incomplete",
        isWin: false,
        guesses: 0,
        reason: reason,
      });

      storage.saveStreakData(walletAddress, streakData);

      if (gameId && storage.getGame(gameId)) {
        storage.deleteGame(gameId);
      }

      // ✅ Broadcast incomplete game streak resets to admins
      if (global.broadcastToAdmins) {
        global.broadcastToAdmins("streak-reset", {
          walletAddress,
          oldStreak,
          newStreak: 0,
          reason: "incomplete_game",
          timestamp: new Date().toISOString(),
          wasIncomplete: true,
          period: today,
        });
        console.log("📡 Broadcasted incomplete game streak reset to admins");
      }


      console.log(
        `⏰ Incomplete game handled for ${walletAddress.slice(
          0,
          8
        )}...: ${reason} (streak: ${oldStreak} → 0)`
      );

      res.json({
        success: true,
        data: streakData,
        message: "Incomplete game processed - streak reset to 0",
        oldStreak,
        newStreak: 0,
      });
    } else {
      // No streak to reset
      res.json({
        success: true,
        data: streakData,
        message: "Incomplete game processed - no streak to reset",
        oldStreak: 0,
        newStreak: 0,
      });
    }
  } catch (error) {
    console.error("Error handling incomplete game:", error);
    res.status(500).json({ error: "Failed to handle incomplete game" });
  }
});

// ✅ ENHANCED: Handle disconnected players with enhanced game status checking
router.post("/handle-disconnected-player", async (req, res) => {
  const { walletAddress, reason, broadcastToAdmins } = req.body;

  if (!walletAddress) {
    return res.status(400).json({ error: "Missing wallet address" });
  }

  try {
    const streakData = storage.getStreakData(walletAddress);
    const oldStreak = streakData.currentStreak;
    const today = storage.getTodayString(); // Current period

    // Skip if no streak to lose
    if (oldStreak === 0) {
      return res.json({
        success: true,
        data: streakData,
        message: "No streak to reset for disconnected player",
        oldStreak: 0,
        newStreak: 0,
        wasReset: false,
      });
    }

    // ✅ CRITICAL FIX: Skip if already played this period (not daily)
    if (storage.hasPlayedToday(walletAddress)) {
      return res.json({
        success: true,
        data: streakData,
        message: "Player already played this period - no streak reset needed",
        oldStreak,
        newStreak: streakData.currentStreak,
        wasReset: false,
      });
    }

    // ✅ CRITICAL FIX: Check if player won current period
    const wonCurrentPeriod = await checkPlayerWonCurrentPeriod(walletAddress);

    if (wonCurrentPeriod) {
      console.log(
        `🏆 Player ${walletAddress.slice(
          0,
          8
        )}... won current period - preserving streak despite disconnection`
      );

      if (global.broadcastToAdmins) {
        global.broadcastToAdmins("streak-preserved", {
          walletAddress,
          currentStreak: oldStreak,
          reason: "won_current_period_while_disconnected",
          timestamp: new Date().toISOString(),
          period: today,
        });
      }

      return res.json({
        success: true,
        data: streakData,
        message: `Player won current period - streak of ${oldStreak} preserved despite disconnection`,
        oldStreak,
        newStreak: oldStreak,
        wasReset: false,
        streakPreserved: true,
        reason: "won_current_period",
      });
    }

    // ✅ Check for incomplete games and clean them up
    const incompleteGameCheck = await checkPlayerHasIncompleteGame(
      walletAddress
    );

    if (incompleteGameCheck.hasIncomplete) {
      console.log(
        `🎮 Cleaning up incomplete game for disconnected player: ${walletAddress.slice(
          0,
          8
        )}...`
      );

      const game = incompleteGameCheck.game;
      game.isComplete = true;
      game.isWin = false;
      game.abandonedAt = Date.now();
      game.abandonReason = "disconnected_timeout";
      storage.saveGame(game);
    }

    // Reset streak for disconnected player who didn't win
    console.log(
      `💔 Resetting streak for disconnected player ${walletAddress.slice(
        0,
        8
      )}...: ${oldStreak} -> 0 (didn't win current period)`
    );

    streakData.currentStreak = 0;
    streakData.lastPlayedDate = today;

    // ✅ CRITICAL FIX: Mark as played this period (not daily)
    storage.markPlayedToday(walletAddress, {
      gameId: incompleteGameCheck.hasIncomplete
        ? incompleteGameCheck.gameId
        : "disconnected_timeout",
      isWin: false,
      guesses: 0,
      reason: reason,
    });

    storage.saveStreakData(walletAddress, streakData);

    // ✅ Enhanced broadcast with game context
    if (global.broadcastToAdmins) {
      const broadcastData = {
        walletAddress,
        oldStreak,
        newStreak: 0,
        reason: reason || "disconnected_timeout",
        timestamp: new Date().toISOString(),
        wasDisconnected: true,
        hadIncompleteGame: incompleteGameCheck.hasIncomplete,
        gameId: incompleteGameCheck.gameId,
        period: today,
      };

      global.broadcastToAdmins("streak-reset", broadcastData);
      console.log(
        "📡 Broadcasted enhanced disconnected player streak reset to admins"
      );
    }

    res.json({
      success: true,
      data: streakData,
      message: `Disconnected player streak reset from ${oldStreak} to 0 (didn't win current period)`,
      oldStreak,
      newStreak: 0,
      wasReset: true,
      hadIncompleteGame: incompleteGameCheck.hasIncomplete,
    });
  } catch (error) {
    console.error("Error handling disconnected player:", error);
    res.status(500).json({ error: "Failed to handle disconnected player" });
  }
});

// ✅ NEW: Test endpoint for game status checking (FIXED)
router.post("/test-game-status-check", async (req, res) => {
  const { walletAddress } = req.body;

  if (!walletAddress) {
    return res.status(400).json({ error: "Missing wallet address" });
  }

  try {
    const wonCurrentPeriod = await checkPlayerWonCurrentPeriod(walletAddress);
    const incompleteGameCheck = await checkPlayerHasIncompleteGame(
      walletAddress
    );
    const hasPlayedToday = storage.hasPlayedToday(walletAddress); // Current period
    const streakData = storage.getStreakData(walletAddress);
    const currentPeriodGameData =
      storage.getCurrentPeriodGameData(walletAddress);

    const result = {
      walletAddress: walletAddress.slice(0, 8) + "...",
      currentStreak: streakData.currentStreak || 0,
      hasPlayedToday, // Current period
      wonCurrentPeriod,
      hasIncompleteGame: incompleteGameCheck.hasIncomplete,
      incompleteGameId: incompleteGameCheck.gameId,
      shouldResetStreak:
        (streakData.currentStreak || 0) > 0 &&
        !hasPlayedToday &&
        !wonCurrentPeriod,
      currentPeriod: storage.getCurrentPeriodString(),
      currentPeriodGameData,
      debugInfo: storage.getDebugInfo(),
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error testing game status check:", error);
    res.status(500).json({ error: "Failed to test game status check" });
  }
});

// ✅ ENHANCED: Bulk check with game status awareness
router.post("/check-all-disconnected-players", async (req, res) => {
  try {
    const allStreaks = storage.getAllStreaks();
    const currentPeriod = storage.getCurrentPeriodString();
    const resetPlayers = [];
    const preservedPlayers = [];
    const checkedPlayers = [];

    console.log(
      `🔍 Enhanced bulk check: Examining ${allStreaks.length} players for disconnected streaks...`
    );

    for (const player of allStreaks) {
      const walletAddress = player.fullWallet;
      const currentStreak = player.currentStreak || 0;

      checkedPlayers.push({
        walletAddress: walletAddress.slice(0, 8) + "...",
        fullWallet: walletAddress,
        currentStreak,
        hasPlayedToday: storage.hasPlayedToday(walletAddress),
      });

      // Skip players with no streak
      if (currentStreak === 0) {
        continue;
      }

      // Skip players who already played this period
      if (storage.hasPlayedToday(walletAddress)) {
        continue;
      }

      // ✅ NEW: Check if player won current period
      const wonCurrentPeriod = await checkPlayerWonCurrentPeriod(walletAddress);

      if (wonCurrentPeriod) {
        console.log(
          `🏆 Preserving streak for winner: ${walletAddress.slice(
            0,
            8
          )}... (streak: ${currentStreak})`
        );

        preservedPlayers.push({
          walletAddress: walletAddress.slice(0, 8) + "...",
          fullWallet: walletAddress,
          oldStreak: currentStreak,
          newStreak: currentStreak,
          reason: "won_current_period",
        });

        continue;
      }

      // ✅ NEW: Check for incomplete games and clean them up
      const incompleteGameCheck = await checkPlayerHasIncompleteGame(
        walletAddress
      );

      if (incompleteGameCheck.hasIncomplete) {
        console.log(
          `🎮 Found incomplete game for ${walletAddress.slice(
            0,
            8
          )}... - cleaning up`
        );

        const game = incompleteGameCheck.game;
        game.isComplete = true;
        game.isWin = false;
        game.abandonedAt = Date.now();
        game.abandonReason = "bulk_disconnected_check";
        storage.saveGame(game);
      }

      // Reset streak for disconnected player who didn't win
      console.log(
        `💔 Found disconnected player with streak: ${walletAddress.slice(
          0,
          8
        )}... (streak: ${currentStreak}) - did not win current period`
      );

      const streakData = storage.getStreakData(walletAddress);
      const oldStreak = streakData.currentStreak;

      streakData.currentStreak = 0;
      streakData.lastPlayedDate = storage.getTodayString();

      storage.markPlayedToday(walletAddress, {
        gameId: incompleteGameCheck.hasIncomplete
          ? incompleteGameCheck.gameId
          : "bulk_disconnected_check",
        isWin: false,
        guesses: 0,
        reason: "bulk_disconnected_check",
      });

      storage.saveStreakData(walletAddress, streakData);

      resetPlayers.push({
        walletAddress: walletAddress.slice(0, 8) + "...",
        fullWallet: walletAddress,
        oldStreak,
        newStreak: 0,
        hadIncompleteGame: incompleteGameCheck.hasIncomplete,
        gameId: incompleteGameCheck.gameId,
      });

      // Broadcast each reset with enhanced context
      if (global.broadcastToAdmins) {
        global.broadcastToAdmins("streak-reset", {
          walletAddress,
          oldStreak,
          newStreak: 0,
          reason: "bulk_disconnected_check",
          timestamp: new Date().toISOString(),
          wasDisconnected: true,
          wasBulkCheck: true,
          hadIncompleteGame: incompleteGameCheck.hasIncomplete,
          gameId: incompleteGameCheck.gameId,
        });
      }
    }

    // ✅ Enhanced reporting with preservation info
    const summary = {
      totalPlayersChecked: allStreaks.length,
      playersWithStreaks: allStreaks.filter((p) => (p.currentStreak || 0) > 0)
        .length,
      streaksReset: resetPlayers.length,
      streaksPreserved: preservedPlayers.length,
      resetPlayers,
      preservedPlayers,
      checkedPlayers,
      currentPeriod,
    };

    // Force admin refresh with enhanced summary
    if (
      (resetPlayers.length > 0 || preservedPlayers.length > 0) &&
      global.broadcastToAdmins
    ) {
      setTimeout(() => {
        global.broadcastToAdmins("admin-should-refresh", {
          reason: "enhanced_bulk_disconnected_check",
          summary,
          timestamp: new Date().toISOString(),
        });
      }, 1500);
    }

    if (resetPlayers.length > 0) {
      console.log(
        `🔄 Enhanced bulk check complete: ${resetPlayers.length} streaks reset, ${preservedPlayers.length} winners preserved`
      );
    } else if (preservedPlayers.length > 0) {
      console.log(
        `✅ Enhanced bulk check complete: No resets needed, ${preservedPlayers.length} winners preserved`
      );
    } else {
      console.log(
        "✅ Enhanced bulk check complete: No disconnected players with streaks found"
      );
    }

    res.json({
      success: true,
      message: `Enhanced check: ${allStreaks.length} players examined, ${resetPlayers.length} streaks reset, ${preservedPlayers.length} winners preserved`,
      summary,
    });
  } catch (error) {
    console.error("Error in enhanced bulk disconnected check:", error);
    res.status(500).json({ error: "Failed to check disconnected players" });
  }
});

// ✅ ENHANCED: Get detailed player activity status with game completion info
router.get("/player-activity-status", async (req, res) => {
  try {
    const allStreaks = storage.getAllStreaks();
    const currentPeriod = storage.getCurrentPeriodString();
    const playerStatus = [];

    for (const player of allStreaks) {
      const walletAddress = player.fullWallet;
      const hasPlayedToday = storage.hasPlayedToday(walletAddress);
      const streakData = storage.getStreakData(walletAddress);
      const currentStreak = streakData.currentStreak || 0;

      // ✅ NEW: Check if player won current period
      const wonCurrentPeriod = await checkPlayerWonCurrentPeriod(walletAddress);

      // ✅ NEW: Check for incomplete games
      const incompleteGameCheck = await checkPlayerHasIncompleteGame(
        walletAddress
      );

      let status, riskLevel;
      if (hasPlayedToday) {
        status = wonCurrentPeriod ? "Active Winner" : "Active";
        riskLevel = "safe";
      } else if (currentStreak > 0) {
        if (wonCurrentPeriod) {
          status = "Winner (Disconnected but Safe)";
          riskLevel = "safe";
        } else {
          status = incompleteGameCheck.hasIncomplete
            ? "At Risk (Incomplete Game)"
            : "At Risk";
          riskLevel = "danger";
        }
      } else {
        status = "Inactive";
        riskLevel = "neutral";
      }

      playerStatus.push({
        walletAddress: walletAddress.slice(0, 8) + "...",
        fullWallet: walletAddress,
        currentStreak,
        maxStreak: streakData.maxStreak || 0,
        gamesPlayed: streakData.gamesPlayed || 0,
        gamesWon: streakData.gamesWon || 0,
        lastPlayedDate: streakData.lastPlayedDate || "Never",
        hasPlayedThisPeriod: hasPlayedToday,
        wonCurrentPeriod,
        hasIncompleteGame: incompleteGameCheck.hasIncomplete,
        incompleteGameId: incompleteGameCheck.gameId,
        status,
        riskLevel,
        isAtRisk: currentStreak > 0 && !hasPlayedToday && !wonCurrentPeriod,
        isSafeWinner: wonCurrentPeriod,
      });
    }

    // Sort by risk level, then by streak
    playerStatus.sort((a, b) => {
      // Prioritize at-risk players
      if (a.isAtRisk && !b.isAtRisk) return -1;
      if (!a.isAtRisk && b.isAtRisk) return 1;

      // Then by current streak (descending)
      return b.currentStreak - a.currentStreak;
    });

    const summary = {
      totalPlayers: playerStatus.length,
      activePlayers: playerStatus.filter((p) => p.hasPlayedThisPeriod).length,
      activeWinners: playerStatus.filter(
        (p) => p.hasPlayedThisPeriod && p.wonCurrentPeriod
      ).length,
      atRiskPlayers: playerStatus.filter((p) => p.isAtRisk).length,
      safeWinners: playerStatus.filter(
        (p) => p.isSafeWinner && !p.hasPlayedThisPeriod
      ).length,
      incompleteGames: playerStatus.filter((p) => p.hasIncompleteGame).length,
      inactivePlayers: playerStatus.filter((p) => p.status === "Inactive")
        .length,
      currentPeriod,
    };

    res.json({
      success: true,
      data: {
        summary,
        players: playerStatus,
      },
    });
  } catch (error) {
    console.error("Error getting enhanced player activity status:", error);
    res.status(500).json({ error: "Failed to get player activity status" });
  }
});

// ✅ REMOVED: Old admin reset endpoint - now handled by admin.js with dual-streak reset

// GET /api/leaderboard - Get leaderboard
router.get("/leaderboard", (req, res) => {
  try {
    const leaderboard = storage
      .getAllStreaks()
      .sort((a, b) => (b.maxStreak || 0) - (a.maxStreak || 0))
      .slice(0, 10);

    res.json({
      success: true,
      data: leaderboard,
    });
  } catch (error) {
    console.error("Error getting leaderboard:", error);
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
});

// ✅ ENHANCED: Get detailed streak statistics with game status info
router.get("/admin-streak-stats", async (req, res) => {
  try {
    const allStreaks = storage.getAllStreaks();
    const currentPeriod = storage.getCurrentPeriodString();

    let activeWinners = 0;
    let safeDisconnectedWinners = 0;
    let atRiskPlayers = 0;
    let incompleteGames = 0;

    // Enhanced analysis
    for (const player of allStreaks) {
      const walletAddress = player.fullWallet;
      const currentStreak = player.currentStreak || 0;
      const hasPlayedToday = storage.hasPlayedToday(walletAddress);

      if (currentStreak > 0) {
        const wonCurrentPeriod = await checkPlayerWonCurrentPeriod(
          walletAddress
        );
        const incompleteGameCheck = await checkPlayerHasIncompleteGame(
          walletAddress
        );

        if (incompleteGameCheck.hasIncomplete) {
          incompleteGames++;
        }

        if (hasPlayedToday && wonCurrentPeriod) {
          activeWinners++;
        } else if (!hasPlayedToday && wonCurrentPeriod) {
          safeDisconnectedWinners++;
        } else if (!hasPlayedToday && !wonCurrentPeriod) {
          atRiskPlayers++;
        }
      }
    }

    const stats = {
      totalPlayers: allStreaks.length,
      activeStreaks: allStreaks.filter((p) => (p.currentStreak || 0) > 0)
        .length,
      activeWinners,
      safeDisconnectedWinners,
      playersAtRisk: atRiskPlayers,
      incompleteGames,
      playedThisPeriod: allStreaks.filter((p) =>
        storage.hasPlayedToday(p.fullWallet)
      ).length,
      longestCurrentStreak: Math.max(
        ...allStreaks.map((p) => p.currentStreak || 0),
        0
      ),
      longestEverStreak: Math.max(
        ...allStreaks.map((p) => p.maxStreak || 0),
        0
      ),
      totalGamesPlayed: allStreaks.reduce(
        (sum, p) => sum + (p.gamesPlayed || 0),
        0
      ),
      totalGamesWon: allStreaks.reduce((sum, p) => sum + (p.gamesWon || 0), 0),
      currentPeriod,
      lastUpdated: new Date().toISOString(),
    };

    stats.averageWinRate =
      stats.totalGamesPlayed > 0
        ? ((stats.totalGamesWon / stats.totalGamesPlayed) * 100).toFixed(1) +
          "%"
        : "0%";

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error getting enhanced admin streak stats:", error);
    res.status(500).json({ error: "Failed to get streak statistics" });
  }
});

// ✅ NEW: Test endpoint for game status checking
router.post("/test-game-status-check", async (req, res) => {
  const { walletAddress } = req.body;

  if (!walletAddress) {
    return res.status(400).json({ error: "Missing wallet address" });
  }

  try {
    const wonCurrentPeriod = await checkPlayerWonCurrentPeriod(walletAddress);
    const incompleteGameCheck = await checkPlayerHasIncompleteGame(
      walletAddress
    );
    const hasPlayedToday = storage.hasPlayedToday(walletAddress);
    const streakData = storage.getStreakData(walletAddress);

    const result = {
      walletAddress: walletAddress.slice(0, 8) + "...",
      currentStreak: streakData.currentStreak || 0,
      hasPlayedToday,
      wonCurrentPeriod,
      hasIncompleteGame: incompleteGameCheck.hasIncomplete,
      incompleteGameId: incompleteGameCheck.gameId,
      shouldResetStreak:
        (streakData.currentStreak || 0) > 0 &&
        !hasPlayedToday &&
        !wonCurrentPeriod,
      currentPeriod: storage.getCurrentPeriodString(),
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error testing game status check:", error);
    res.status(500).json({ error: "Failed to test game status check" });
  }
});

module.exports = router;
