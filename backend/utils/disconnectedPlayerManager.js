// ============================== STANDALONE DISCONNECTED PLAYER MANAGER ==============================
// File: backend/utils/disconnectedPlayerManager.js

const storage = require("../data/storage");

class DisconnectedPlayerManager {
  constructor() {
    this.checkInterval = null;
    this.lastCheckTime = null;
    this.totalChecks = 0;
    this.totalResets = 0;
    this.isRunning = false;
  }

  // ✅ Check if player won the current game period
  async checkPlayerWonCurrentPeriod(walletAddress) {
    try {
      const currentPeriod = storage.getCurrentPeriodString();
      const key = `${walletAddress}-${currentPeriod}`;

      // Check if player has played this period
      if (!storage.dailyGames.has(key)) {
        return false; // Hasn't played = hasn't won
      }

      const gameData = storage.dailyGames.get(key);

      // Check if they won their game this period
      if (gameData && gameData.isWin === true) {
        console.log(
          `🏆 Player ${walletAddress.slice(
            0,
            8
          )}... WON this period - preserving streak`
        );
        return true;
      }

      console.log(
        `💔 Player ${walletAddress.slice(0, 8)}... did not win this period`
      );
      return false;
    } catch (error) {
      console.error("Error checking if player won current period:", error);
      return false; // Default to false if we can't determine
    }
  }

  // ✅ Check if player has an active incomplete game
  async checkPlayerHasIncompleteGame(walletAddress) {
    try {
      // Find active game for this wallet
      for (let [gameId, game] of storage.activeGames.entries()) {
        if (game.walletAddress === walletAddress && !game.isComplete) {
          const gameAge = Date.now() - game.startTime;
          const fiveMinutes = 1 * 60 * 1000;

          // Only consider games from current period (within 1 minute)
          if (gameAge <= fiveMinutes) {
            console.log(
              `🎮 Player ${walletAddress.slice(
                0,
                8
              )}... has incomplete game: ${gameId}`
            );
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

  // ✅ MAIN METHOD: Enhanced disconnected player check with game status awareness
  async checkDisconnectedPlayers(reason = "periodic_check") {
    if (this.isRunning) {
      console.log("⏭️ Disconnected player check already running, skipping...");
      return { skipped: true };
    }

    // ✅ NEW: Check if game is paused - skip all streak resets during pause
    const adminRoutes = require('../routes/admin');
    const isGamePaused = adminRoutes.isGameCurrentlyPaused();

    if (isGamePaused) {
      console.log(`⏸️ Game is paused - skipping disconnected player check (${reason})`);
      return {
        success: true,
        paused: true,
        message: "Disconnected player check skipped during pause",
        summary: { streaksIgnored: 0, streaksPreserved: 0, resetPlayers: [], preservedPlayers: [] }
      };
    }

    this.isRunning = true;
    this.lastCheckTime = new Date();
    this.totalChecks++;

    try {
      console.log(`🔍 Enhanced disconnected player check (${reason})...`);

      const allStreaks = storage.getAllStreaks();
      const resetPlayers = [];
      const preservedPlayers = [];
      const incompleteGamePlayers = [];

      for (const player of allStreaks) {
        const walletAddress = player.fullWallet;
        const currentStreak = player.currentStreak || 0;

        // Skip players with no streak to lose
        if (currentStreak === 0) {
          continue;
        }

        // Check if player has played this period
        const hasPlayedThisPeriod = storage.hasPlayedToday(walletAddress);

        if (hasPlayedThisPeriod) {
          // Player has played this period - no reset needed
          continue;
        }

        // ✅ KEY CHANGE: Check if player won the current period
        const wonCurrentPeriod = await this.checkPlayerWonCurrentPeriod(
          walletAddress
        );

        if (wonCurrentPeriod) {
          console.log(
            `🏆 Preserving streak for winner: ${walletAddress.slice(
              0,
              8
            )}... (streak: ${currentStreak})`
          );
          preservedPlayers.push({
            walletAddress,
            currentStreak,
            reason: "won_current_period",
          });
          continue; // ✅ Don't reset streak if they won this period
        }

        // ✅ Check for incomplete games
        const incompleteGameCheck = await this.checkPlayerHasIncompleteGame(
          walletAddress
        );

        if (incompleteGameCheck.hasIncomplete) {
          console.log(
            `🎮 Found incomplete game for ${walletAddress.slice(
              0,
              8
            )}... - will reset after cleanup`
          );

          // Mark incomplete game as abandoned and reset streak
          const game = incompleteGameCheck.game;
          game.isComplete = true;
          game.isWin = false;
          game.abandonedAt = Date.now();
          game.abandonReason = "disconnected_timeout";
          storage.saveGame(game);


          incompleteGamePlayers.push({
            walletAddress,
            gameId: incompleteGameCheck.gameId,
            oldStreak: currentStreak,
          });
        }

        // ✅ RESET LOGIC: Reset streak ONLY for players who:
        // 1. Have a streak > 0
        // 2. Haven't played this period
        // 3. DID NOT win the current period
        // 4. Either have no incomplete game OR we just handled their incomplete game

        console.log(
          `💔 Resetting streak for disconnected player: ${walletAddress.slice(
            0,
            8
          )}... (${currentStreak} -> 0) - did not win current period`
        );

        const streakData = storage.getStreakData(walletAddress);
        const oldStreak = streakData.currentStreak;

        streakData.currentStreak = 0;
        streakData.lastPlayedDate = storage.getTodayString();

        storage.markPlayedToday(walletAddress, {
          gameId: incompleteGameCheck.hasIncomplete
            ? incompleteGameCheck.gameId
            : "auto_disconnected_check",
          isWin: false,
          guesses: 0,
          reason: incompleteGameCheck.hasIncomplete
            ? "incomplete_game_timeout"
            : reason,
        });

        storage.saveStreakData(walletAddress, streakData);
        this.totalResets++;

        resetPlayers.push({
          walletAddress,
          oldStreak,
          newStreak: 0,
          reason: incompleteGameCheck.hasIncomplete
            ? "incomplete_game"
            : "disconnected_no_play",
        });

        // ✅ Broadcast to admins with enhanced context
        if (global.broadcastToAdmins) {
          global.broadcastToAdmins("streak-reset", {
            walletAddress,
            oldStreak,
            newStreak: 0,
            reason: incompleteGameCheck.hasIncomplete
              ? "incomplete_game_timeout"
              : "auto_disconnected_timeout",
            timestamp: new Date().toISOString(),
            wasDisconnected: true,
            hadIncompleteGame: incompleteGameCheck.hasIncomplete,
            gameId: incompleteGameCheck.gameId,
            didNotWinCurrentPeriod: true,
          });
        }
      }

      // ✅ ENHANCED REPORTING
      const summary = {
        totalPlayersChecked: allStreaks.length,
        playersWithStreaks: allStreaks.filter((p) => (p.currentStreak || 0) > 0)
          .length,
        streaksReset: resetPlayers.length,
        streaksPreserved: preservedPlayers.length,
        incompleteGamesFound: incompleteGamePlayers.length,
        resetPlayers,
        preservedPlayers,
        incompleteGamePlayers,
      };

      if (resetPlayers.length > 0) {
        console.log(
          `🔄 Enhanced auto-check complete: ${resetPlayers.length} streaks reset, ${preservedPlayers.length} preserved`
        );
        console.log(`📊 Reset breakdown:`, {
          disconnectedNoPlay: resetPlayers.filter(
            (p) => p.reason === "disconnected_no_play"
          ).length,
          incompleteGames: resetPlayers.filter(
            (p) => p.reason === "incomplete_game"
          ).length,
        });

        // Force admin dashboard refresh
        setTimeout(() => {
          if (global.broadcastToAdmins) {
            global.broadcastToAdmins("admin-should-refresh", {
              reason: "enhanced_auto_disconnected_check",
              summary,
              timestamp: new Date().toISOString(),
            });
          }
        }, 1000);
      } else if (preservedPlayers.length > 0) {
        console.log(
          `✅ Enhanced auto-check complete: No streaks reset, ${preservedPlayers.length} winners preserved`
        );
      } else {
        console.log(
          "✅ Enhanced auto-check complete: No disconnected players with streaks found"
        );
      }

      return {
        success: true,
        summary,
      };
    } catch (error) {
      console.error("❌ Error in enhanced disconnected player check:", error);
      return { success: false, error: error.message };
    } finally {
      this.isRunning = false;
    }
  }

  // ✅ Check specific player for disconnection (used by API endpoints)
  async checkSpecificPlayerDisconnection(
    walletAddress,
    reason = "manual_check"
  ) {
    try {
      const streakData = storage.getStreakData(walletAddress);
      const currentStreak = streakData.currentStreak || 0;

      if (currentStreak === 0) {
        return {
          success: true,
          action: "no_reset_needed",
          message: "Player has no streak to reset",
          oldStreak: 0,
          newStreak: 0,
        };
      }

      // Check if player has played this period
      if (storage.hasPlayedToday(walletAddress)) {
        return {
          success: true,
          action: "no_reset_needed",
          message: "Player already played this period",
          oldStreak: currentStreak,
          newStreak: currentStreak,
        };
      }

      // ✅ KEY CHECK: Did player win this period?
      const wonCurrentPeriod = await this.checkPlayerWonCurrentPeriod(
        walletAddress
      );

      if (wonCurrentPeriod) {
        return {
          success: true,
          action: "streak_preserved",
          message: "Player won current period - streak preserved",
          oldStreak: currentStreak,
          newStreak: currentStreak,
          wonCurrentPeriod: true,
        };
      }

      // Check for incomplete games
      const incompleteGameCheck = await this.checkPlayerHasIncompleteGame(
        walletAddress
      );

      if (incompleteGameCheck.hasIncomplete) {
        // Clean up incomplete game
        const game = incompleteGameCheck.game;
        game.isComplete = true;
        game.isWin = false;
        game.abandonedAt = Date.now();
        game.abandonReason = reason;
        storage.saveGame(game);

      }

      // Reset the streak (only if they didn't win this period)
      const oldStreak = streakData.currentStreak;
      streakData.currentStreak = 0;
      streakData.lastPlayedDate = storage.getTodayString();

      storage.markPlayedToday(walletAddress, {
        gameId: incompleteGameCheck.hasIncomplete
          ? incompleteGameCheck.gameId
          : "manual_disconnected_check",
        isWin: false,
        guesses: 0,
        reason: incompleteGameCheck.hasIncomplete
          ? "incomplete_game_manual"
          : reason,
      });

      storage.saveStreakData(walletAddress, streakData);

      // Broadcast reset
      if (global.broadcastToAdmins) {
        global.broadcastToAdmins("streak-reset", {
          walletAddress,
          oldStreak,
          newStreak: 0,
          reason: reason,
          timestamp: new Date().toISOString(),
          wasDisconnected: true,
          hadIncompleteGame: incompleteGameCheck.hasIncomplete,
          gameId: incompleteGameCheck.gameId,
          didNotWinCurrentPeriod: true,
        });
      }

      return {
        success: true,
        action: "streak_reset",
        message: `Streak reset from ${oldStreak} to 0 (did not win current period)${
          incompleteGameCheck.hasIncomplete ? " (had incomplete game)" : ""
        }`,
        oldStreak,
        newStreak: 0,
        hadIncompleteGame: incompleteGameCheck.hasIncomplete,
        gameId: incompleteGameCheck.gameId,
      };
    } catch (error) {
      console.error("Error checking specific player disconnection:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  startPeriodicChecks() {
    // Run disconnected player check every 1 minute
    this.checkInterval = setInterval(() => {
      this.checkDisconnectedPlayers("periodic");
    }, 1 * 60 * 1000); // 60,000 milliseconds = 1 minute

    console.log(
      "⏰ Enhanced disconnected player checks started (every 1 minute)"
    );
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log("🛑 Enhanced disconnected player checks stopped");
  }

  // ✅ Get detailed status for admin dashboard
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastCheckTime: this.lastCheckTime,
      totalChecks: this.totalChecks,
      totalResets: this.totalResets,
      intervalActive: !!this.checkInterval,
    };
  }
}

module.exports = DisconnectedPlayerManager;
