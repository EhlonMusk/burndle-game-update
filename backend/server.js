const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
const server = http.createServer(app);

// Configure Socket.io with CORS
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:8080"], // Your frontend URLs
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ✅ Make io available globally for treasury system
global.io = io;

// 🚨 ADD THIS RIGHT AFTER your existing io setup:
const adminRoutes = require("./routes/admin");
if (adminRoutes.setSocketIO) {
  adminRoutes.setSocketIO(io);
  console.log("✅ Socket.io connected to admin routes");
}

// Middleware
app.use(cors());
app.use(express.json());
app.use("/api/admin", require("./routes/admin"));

// ✅ Serve frontend files from the frontend directory
app.use(express.static(path.join(__dirname, "../frontend")));
// ✅ Also serve backend public files (for admin dashboard)
app.use(express.static(path.join(__dirname, "public")));

// Import routes
const gameRoutes = require("./routes/game");
const streaksRoutes = require("./routes/streaks");
const burnRoutes = require("./routes/burn"); // ✅ NEW: Import burn routes

// ✅ NEW: Import treasury system
const treasury = require("./treasury");

// Initialize treasury system
treasury.initializeTreasury().then((success) => {
  if (success) {
    console.log("✅ Automated treasury system initialized");
  } else {
    console.error("❌ Failed to initialize treasury system");
  }
});

// Make io available to routes
app.set("io", io);

// Routes
app.use("/api", gameRoutes);
app.use("/api", streaksRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/burn", burnRoutes); // ✅ NEW: Add burn routes

// ✅ NEW: Treasury transparency routes
app.get("/api/treasury/stats", async (req, res) => {
  try {
    const stats = await treasury.getTreasuryStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("❌ Error getting treasury stats:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/treasury/transactions", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const transactions = treasury.getTransactionLog(limit);
    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error("❌ Error getting treasury transactions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/treasury/balances", async (req, res) => {
  try {
    await treasury.checkTreasuryBalances();
    res.json({ success: true, message: "Balances checked - see server console" });
  } catch (error) {
    console.error("❌ Error checking treasury balances:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// WebSocket Connection Management
const connectedAdmins = new Set();
const connectedPlayers = new Map(); // walletAddress -> socketId

io.on("connection", (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Handle admin connection
  socket.on("admin-connect", (data) => {
    if (data.token) {
      // Verify admin token here if needed
      connectedAdmins.add(socket.id);
      socket.join("admins");
      console.log(`👑 Admin connected: ${socket.id}`);

      socket.emit("admin-connected", {
        success: true,
        message: "Admin connected to live updates",
      });
    }
  });

  // Handle player connection
  socket.on("player-connect", (data) => {
    if (data.walletAddress) {
      connectedPlayers.set(data.walletAddress, socket.id);
      socket.join(`player-${data.walletAddress}`);
      console.log(`🎮 Player connected: ${data.walletAddress} (${socket.id})`);

      socket.emit("player-connected", {
        success: true,
        message: "Connected to live updates",
      });
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);

    // Remove from admin set
    connectedAdmins.delete(socket.id);

    // Remove from player map
    for (let [walletAddress, socketId] of connectedPlayers.entries()) {
      if (socketId === socket.id) {
        connectedPlayers.delete(walletAddress);
        console.log(`🎮 Player disconnected: ${walletAddress}`);
        break;
      }
    }
  });

  // Handle manual admin refresh request
  socket.on("admin-refresh-request", () => {
    if (connectedAdmins.has(socket.id)) {
      socket.emit("admin-should-refresh");
    }
  });

  // Handle admin start game broadcast
  socket.on("admin-start-game", (data) => {
    console.log('📥 Received admin-start-game event from socket:', socket.id);
    console.log('📊 Data received:', data);
    console.log('👑 Is admin?', connectedAdmins.has(socket.id));
    console.log('📈 Connected admins:', Array.from(connectedAdmins));

    if (connectedAdmins.has(socket.id)) {
      console.log('🚀 Admin triggered start game modal broadcast');

      // Calculate 5 minutes from now
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + (5 * 60 * 1000)); // 5 minutes in milliseconds

      // Broadcast to all connected clients (players) - same pattern as game_paused
      const broadcastData = {
        isStarted: true,
        startedBy: 'admin',
        startedAt: startTime.toISOString(),
        gameEndTime: endTime.toISOString(),
        gameEndTimestamp: endTime.getTime(),
        message: 'Game Started! 🎮'
      };

      io.emit("game_started", broadcastData);
      console.log('📡 Broadcasted game_started to all clients (same pattern as game_paused)');
      console.log('📡 Broadcast data:', broadcastData);
      console.log(`⏰ Game period: ${startTime.toISOString()} → ${endTime.toISOString()}`);
    } else {
      console.warn('⚠️ Non-admin tried to trigger start game modal');
    }
  });

  // Handle automatic finish game when countdown expires
  socket.on("auto-finish-game", async (data) => {
    console.log('⏰ Received auto-finish-game event from socket:', socket.id);
    console.log('⏰ Event data:', data);
    console.log('⏰ Connected clients count:', io.engine.clientsCount);

    try {
      // Get real leaderboard data (same logic as manual finish game)
      console.log("⏰ About to call storage.getAllStreaks() for auto-finish");
      const allStreaks = storage.getAllStreaks();
      console.log("⏰ Got streaks:", allStreaks ? allStreaks.length : "null", "items");

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

      console.log("⏰ Generated leaderboard for auto-finish:", leaderboard);

      // Set temporary auto-finish state (20 seconds from now)
      const autoFinishEndTime = new Date(Date.now() + 20 * 1000);
      global.autoFinishState = {
        isActive: true,
        startedAt: new Date().toISOString(),
        endTime: autoFinishEndTime.toISOString(),
        endTimestamp: autoFinishEndTime.getTime(),
        leaderboard: leaderboard
      };

      console.log("⏰ Set auto-finish state until:", autoFinishEndTime.toISOString());

      const broadcastData = {
        reason: data.reason || 'countdown-expired',
        timestamp: data.timestamp || new Date().toISOString(),
        message: 'Game period has ended! Time to see the results!',
        leaderboard: leaderboard,
        autoFinishEndTime: autoFinishEndTime.toISOString(),
        autoFinishEndTimestamp: autoFinishEndTime.getTime()
      };

      // Broadcast to all clients to show the finish game modal
      io.emit("game_auto_finished", broadcastData);

      console.log('⏰ Broadcasted game_auto_finished to all clients');
      console.log('⏰ Broadcast data:', broadcastData);
    } catch (error) {
      console.error('⏰ Error in auto-finish-game:', error);
    }
  });

  // Handle automatic start game after finish countdown expires (no admin auth required)
  socket.on("auto-start-game", (data) => {
    console.log('🔄 Received auto-start-game event from socket:', socket.id);
    console.log('🔄 Event data:', data);
    console.log('🔄 Reason:', data.reason);

    if (data.reason === 'finish-countdown-expired') {
      console.log('🚀 Auto-starting new game after finish countdown expired');

      // Clear auto-finish state since we're starting a new game
      if (global.autoFinishState) {
        console.log('🔄 Clearing auto-finish state');
        global.autoFinishState = null;
      }

      // ✅ RESET ALL PLAYER DATA: Same logic as "reset everything" button
      console.log('🗑️ AUTO-RESTART: Resetting all player data for new game period');

      // Debug: Log what will be cleared
      const allStreaks = storage.getAllStreaks();
      const streaksWithMax = allStreaks.filter(p => (p.maxStreak || 0) > 0);
      console.log(`🔍 AUTO-RESTART - Will clear data for ${allStreaks.length} players, ${streaksWithMax.length} have max streaks > 0`);
      if (streaksWithMax.length > 0) {
        console.log(`🔍 AUTO-RESTART - Players with max streaks:`,
          streaksWithMax.map(p => `${(p.fullWallet || p.wallet).slice(0, 8)}: Max=${p.maxStreak}`).join(', ')
        );
      }

      // Complete wipe of all player data
      console.log(`🗑️ AUTO-RESTART - Removing ${storage.walletStreaks.size} players completely`);
      const removedPlayers = Array.from(storage.walletStreaks.keys()).map(w => w.slice(0, 8) + '...');
      if (removedPlayers.length > 0) {
        console.log(`🗑️ PLAYERS REMOVED:`, removedPlayers.join(', '));
      }

      storage.activeGames.clear();
      storage.walletStreaks.clear(); // Complete removal of all player data
      storage.dailyGames.clear();
      storage.assignedWords = {};

      // Auto-assign random words to all players after reset
      console.log("🎲 AUTO-RESTART - Auto-assigning random words after data reset");
      storage.autoAssignRandomWordsToAllPlayers(true); // Force assignment after reset

      // Save the cleared data to persistent files
      storage.saveStreaksToFile();
      storage.saveDailyGamesToFile();
      storage.saveAssignedWords(storage.assignedWords);

      console.log(`💾 AUTO-RESTART - Persisted all cleared data to files`);
      console.log(`✅ Auto-restart data reset completed`);

      // Broadcast data reset to all players
      io.emit("game_reset", {
        resetBy: 'auto-system',
        resetAt: new Date().toISOString(),
        message: "New game period has begun - all player data reset",
        reason: 'auto-restart'
      });
      console.log('📡 Broadcasted game_reset event to all clients');

      // Calculate 5 minutes from now
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + (5 * 60 * 1000)); // 5 minutes in milliseconds

      // Broadcast to all connected clients (players) - same pattern as admin start
      const broadcastData = {
        isStarted: true,
        startedBy: 'auto-system',
        startedAt: startTime.toISOString(),
        gameEndTime: endTime.toISOString(),
        gameEndTimestamp: endTime.getTime(),
        message: 'New Game Started Automatically! 🎮'
      };

      io.emit("game_started", broadcastData);
      console.log('📡 Auto-broadcasted game_started to all clients');
      console.log('📡 Broadcast data:', broadcastData);
      console.log(`⏰ Auto game period: ${startTime.toISOString()} → ${endTime.toISOString()}`);
    } else {
      console.warn('⚠️ Auto-start-game called with invalid reason:', data.reason);
    }
  });
});

// Global functions for broadcasting updates
global.broadcastToAdmins = (eventName, data) => {
  io.to("admins").emit(eventName, data);
  console.log(`📡 Broadcast to admins: ${eventName}`, data);
};

global.broadcastToPlayer = (walletAddress, eventName, data) => {
  io.to(`player-${walletAddress}`).emit(eventName, data);
  console.log(`📡 Broadcast to player ${walletAddress}: ${eventName}`, data);
};

global.broadcastToAll = (eventName, data) => {
  io.emit(eventName, data);
  console.log(`📡 Broadcast to all: ${eventName}`, data);
};

// Routes for serving HTML files
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend", "index.html"));
});

// Serve admin page
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// ✅ NEW: Serve burn statistics page (optional)
app.get("/burn", (req, res) => {
  // You can create a dedicated burn stats page if needed
  res.sendFile(path.join(__dirname, "../frontend", "index.html"));
});

// ✅ ============================ ENHANCED DISCONNECTED PLAYER MANAGEMENT ============================

// Import storage after it's available
const storage = require("./data/storage");

// ✅ FIXED ENHANCED DISCONNECTED PLAYER MANAGEMENT CLASS
class EnhancedDisconnectedPlayerManager {
  constructor() {
    this.checkInterval = null;
    this.lastCheckTime = null;
    this.totalChecks = 0;
    this.totalResets = 0;
    this.totalPreserved = 0;
    this.isRunning = false;
  }

  // ✅ FIXED: Check if player won the current game period using storage methods
  async checkPlayerWonCurrentPeriod(walletAddress) {
    try {
      return storage.hasWonCurrentPeriod(walletAddress);
    } catch (error) {
      console.error("Error checking if player won current period:", error);
      return false;
    }
  }

  // ✅ Check if player has an active incomplete game
  async checkPlayerHasIncompleteGame(walletAddress) {
    try {
      for (let [gameId, game] of storage.activeGames.entries()) {
        if (game.walletAddress === walletAddress && !game.isComplete) {
          const gameAge = Date.now() - game.startTime;
          const fiveMinutes = 5 * 60 * 1000;

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

  // ✅ FIXED: Enhanced disconnected player check that only runs during period transitions
  async checkDisconnectedPlayersForPeriodTransition(
    reason = "period_transition"
  ) {
    if (this.isRunning) {
      console.log(
        "⏭️ Enhanced disconnected player check already running, skipping..."
      );
      return { skipped: true };
    }

    this.isRunning = true;
    this.lastCheckTime = new Date();
    this.totalChecks++;

    try {
      // ✅ CHECK: If game is paused, queue streak resets instead of executing them
      const adminRoutes = require('./routes/admin');
      const isPaused = adminRoutes.isGameCurrentlyPaused();

      if (isPaused) {
        console.log("⏸️ Game is paused - completely ignoring streak resets for incomplete words");
        this.isRunning = false;
        return {
          success: true,
          paused: true,
          message: "Streak resets ignored during pause - players keep their streaks",
          summary: {
            streaksIgnored: 0,
            streaksPreserved: 0,
            resetPlayers: [],
            preservedPlayers: [],
            pauseMessage: "All streak resets skipped during pause mode"
          }
        };
      }

      console.log(
        `🔄 Period transition disconnected player check (${reason})...`
      );

      const allStreaks = storage.getAllStreaks();
      const resetPlayers = [];
      const preservedPlayers = [];
      const currentPeriod = storage.getCurrentPeriodString();
      const previousPeriod = storage.getPreviousPeriodString();

      console.log(
        `📊 Checking ${allStreaks.length} players for period transition`
      );
      console.log(
        `📅 Previous period: ${previousPeriod} -> Current period: ${currentPeriod}`
      );

      for (const player of allStreaks) {
        const walletAddress = player.fullWallet;
        const currentStreak = player.currentStreak || 0;

        // Skip players with no streak to lose
        if (currentStreak === 0) {
          continue;
        }

        // ✅ CRITICAL: During period transition, check previous period results
        // Since we're transitioning to a new period, we need to check if they played/won the period that just ended
        const previousPeriodKey = `${walletAddress}-${previousPeriod}`;
        const playedPreviousPeriod = storage.dailyGames.has(previousPeriodKey);
        const wonPreviousPeriod = playedPreviousPeriod
          ? storage.dailyGames.get(previousPeriodKey)?.isWin === true
          : false;

        console.log(
          `🔍 ${walletAddress.slice(
            0,
            8
          )}...: streak=${currentStreak}, played_prev=${playedPreviousPeriod}, won_prev=${wonPreviousPeriod}`
        );

        if (wonPreviousPeriod) {
          console.log(
            `🏆 Preserving streak for previous period winner: ${walletAddress.slice(
              0,
              8
            )}... (streak: ${currentStreak})`
          );
          preservedPlayers.push({
            walletAddress,
            currentStreak,
            reason: "won_previous_period",
          });
          this.totalPreserved++;

          // Broadcast preservation to admins
          if (global.broadcastToAdmins) {
            global.broadcastToAdmins("streak-preserved", {
              walletAddress,
              currentStreak,
              reason: "won_previous_period_during_transition",
              timestamp: new Date().toISOString(),
              previousPeriod,
              currentPeriod,
            });
          }

          continue; // Don't reset streak if they won previous period
        }

        // ✅ Check for incomplete games from previous period and clean them up
        const incompleteGameCheck = await this.checkPlayerHasIncompleteGame(
          walletAddress
        );

        if (incompleteGameCheck.hasIncomplete) {
          console.log(
            `🎮 Found incomplete game for ${walletAddress.slice(
              0,
              8
            )}... - cleaning up for period transition`
          );

          const game = incompleteGameCheck.game;
          game.isComplete = true;
          game.isWin = false;
          game.abandonedAt = Date.now();
          game.abandonReason = "period_transition_timeout";
          storage.saveGame(game);
        }

        // ✅ RESET LOGIC: Reset streak ONLY for players who:
        // 1. Have a streak > 0
        // 2. DID NOT win the previous period (that just ended)

        console.log(
          `💔 Resetting streak for player who didn't win previous period: ${walletAddress.slice(
            0,
            8
          )}... (${currentStreak} -> 0)`
        );

        const streakData = storage.getStreakData(walletAddress);
        const oldStreak = streakData.currentStreak;

        streakData.currentStreak = 0;
        streakData.lastPlayedDate = previousPeriod; // Mark with previous period

        // ✅ CRITICAL: DON'T mark as played in current period - let them play the new period

        storage.saveStreakData(walletAddress, streakData);
        this.totalResets++;

        resetPlayers.push({
          walletAddress,
          oldStreak,
          newStreak: 0,
          reason: "didnt_win_previous_period",
        });

        // Broadcast to admins
        if (global.broadcastToAdmins) {
          global.broadcastToAdmins("streak-reset", {
            walletAddress,
            oldStreak,
            newStreak: 0,
            reason: "period_transition_no_win",
            timestamp: new Date().toISOString(),
            wasDisconnected: !playedPreviousPeriod,
            didNotWinPreviousPeriod: true,
            previousPeriod,
            currentPeriod,
          });
        }

        // ✅ NEW: Broadcast streak reset notification to the player if they're connected
        if (global.broadcastToPlayer) {
          console.log(`📡 INACTIVE PLAYER - Broadcasting streak reset to ${walletAddress.slice(0, 8)}...`);
          global.broadcastToPlayer(walletAddress, "streak-reset-notification", {
            oldStreak,
            newStreak: 0,
            reason: "inactive_player_streak_reset",
            message: "You didn't complete a word in the previous period",
            timestamp: new Date().toISOString(),
          });
        } else {
          console.log("❌ INACTIVE PLAYER - broadcastToPlayer not available");
        }

        // ✅ NEW: Broadcast updated leaderboard data to all clients for instant updates
        if (global.io) {
          setTimeout(() => {
            global.io.emit("leaderboard-update", {
              reason: "inactive_player_streak_reset",
              affectedPlayer: walletAddress,
              timestamp: new Date().toISOString(),
            });
          }, 100); // Small delay to ensure streak data is saved
        }
      }

      const summary = {
        totalPlayersChecked: allStreaks.length,
        playersWithStreaks: allStreaks.filter((p) => (p.currentStreak || 0) > 0)
          .length,
        streaksReset: resetPlayers.length,
        streaksPreserved: preservedPlayers.length,
        resetPlayers,
        preservedPlayers,
        currentPeriod,
        previousPeriod,
      };

      if (resetPlayers.length > 0 || preservedPlayers.length > 0) {
        console.log(
          `🔄 Period transition check complete: ${resetPlayers.length} streaks reset, ${preservedPlayers.length} preserved`
        );

        // Force admin dashboard refresh
        setTimeout(() => {
          if (global.broadcastToAdmins) {
            global.broadcastToAdmins("admin-should-refresh", {
              reason: "period_transition_disconnected_check",
              summary,
              timestamp: new Date().toISOString(),
            });
          }
        }, 1000);
      } else {
        console.log("✅ Period transition check complete: No streaks affected");
      }

      return {
        success: true,
        summary,
      };
    } catch (error) {
      console.error(
        "❌ Error in period transition disconnected player check:",
        error
      );
      return { success: false, error: error.message };
    } finally {
      this.isRunning = false;
    }
  }

  // ✅ NEW: Manual check for specific player (used by admin)
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

      // Check if player won this period
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
        const game = incompleteGameCheck.game;
        game.isComplete = true;
        game.isWin = false;
        game.abandonedAt = Date.now();
        game.abandonReason = reason;
        storage.saveGame(game);
      }

      // Reset the streak
      const oldStreak = streakData.currentStreak;
      streakData.currentStreak = 0;
      streakData.lastPlayedDate = storage.getTodayString();

      storage.markPlayedToday(walletAddress, {
        gameId: incompleteGameCheck.hasIncomplete
          ? incompleteGameCheck.gameId
          : "manual_disconnected_check",
        isWin: false,
        guesses: 0,
        reason: reason,
      });

      storage.saveStreakData(walletAddress, streakData);

      if (global.broadcastToAdmins) {
        global.broadcastToAdmins("streak-reset", {
          walletAddress,
          oldStreak,
          newStreak: 0,
          reason: reason,
          timestamp: new Date().toISOString(),
          wasManualReset: true,
        });
      }

      return {
        success: true,
        action: "streak_reset",
        message: `Streak reset from ${oldStreak} to 0 (manual check)`,
        oldStreak,
        newStreak: 0,
        hadIncompleteGame: incompleteGameCheck.hasIncomplete,
      };
    } catch (error) {
      console.error("Error checking specific player disconnection:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ✅ NEW: Queue streak resets to execute when game is resumed
  async queueStreakResetsForResume(reason = "period_transition") {
    try {
      console.log("📋 Queueing streak resets for when game resumes...");

      const allStreaks = storage.getAllStreaks();
      const currentPeriod = storage.getCurrentPeriodString();
      const previousPeriod = storage.getPreviousPeriodString();
      let queuedResets = [];

      for (const player of allStreaks) {
        const walletAddress = player.fullWallet;
        const currentStreak = player.currentStreak || 0;

        // Skip players with no streak to lose
        if (currentStreak === 0) {
          continue;
        }

        // Check if they played and won the previous period
        const playedPreviousPeriod = storage.hasPlayedInPeriod(walletAddress, previousPeriod);
        const wonPreviousPeriod = storage.hasWonInPeriod(walletAddress, previousPeriod);

        if (wonPreviousPeriod) {
          console.log(`✅ Player ${walletAddress.slice(0,8)}... won previous period - will preserve streak`);
          continue;
        }

        // This player should have their streak reset when game resumes
        queuedResets.push({
          walletAddress,
          currentStreak,
          reason: "period_transition_while_paused",
          queuedAt: new Date().toISOString(),
          currentPeriod,
          previousPeriod
        });

        console.log(`📋 Queued streak reset for ${walletAddress.slice(0,8)}... (streak: ${currentStreak})`);
      }

      // Store queued resets for when game resumes
      if (!global.queuedStreakResets) {
        global.queuedStreakResets = [];
      }
      global.queuedStreakResets = queuedResets;

      console.log(`📋 Queued ${queuedResets.length} streak resets for when game resumes`);

      return {
        success: true,
        queuedCount: queuedResets.length,
        queuedResets: queuedResets.map(r => ({
          wallet: r.walletAddress.slice(0,8) + "...",
          streak: r.currentStreak
        }))
      };

    } catch (error) {
      console.error("Error queueing streak resets:", error);
      return { success: false, error: error.message };
    }
  }

  // ✅ NEW: Execute queued streak resets (called when game resumes)
  async executeQueuedStreakResets() {
    try {
      if (!global.queuedStreakResets || global.queuedStreakResets.length === 0) {
        console.log("📋 No queued streak resets to execute");
        return { success: true, executedCount: 0 };
      }

      console.log(`📋 Executing ${global.queuedStreakResets.length} queued streak resets...`);

      const resetPlayers = [];
      const gameEngine = require('./utils/gameEngine');

      for (const queuedReset of global.queuedStreakResets) {
        const { walletAddress, currentStreak } = queuedReset;

        // Reset the streak
        const streakData = storage.getStreakData(walletAddress);
        const oldStreak = streakData.currentStreak || 0;
        streakData.currentStreak = 0;
        streakData.lastPlayedDate = storage.getCurrentPeriodString();
        storage.saveStreakData(walletAddress, streakData);

        resetPlayers.push({
          walletAddress: walletAddress.slice(0,8) + "...",
          oldStreak,
          newStreak: 0
        });

        console.log(`📋 Executed queued streak reset for ${walletAddress.slice(0,8)}... (${oldStreak} → 0)`);

        // Broadcast reset to admins
        if (global.broadcastToAdmins) {
          global.broadcastToAdmins("streak-reset", {
            walletAddress,
            oldStreak,
            newStreak: 0,
            reason: "queued_period_transition_reset",
            timestamp: new Date().toISOString(),
            wasQueued: true
          });
        }

        // Broadcast to player if connected
        if (global.broadcastToPlayer) {
          global.broadcastToPlayer(walletAddress, "streak-reset-notification", {
            oldStreak,
            newStreak: 0,
            reason: "queued_period_transition_reset"
          });
        }
      }

      // Clear the queue
      global.queuedStreakResets = [];

      console.log(`📋 Successfully executed ${resetPlayers.length} queued streak resets`);

      return {
        success: true,
        executedCount: resetPlayers.length,
        resetPlayers
      };

    } catch (error) {
      console.error("Error executing queued streak resets:", error);
      return { success: false, error: error.message };
    }
  }

  // ✅ FIXED: Start periodic checks (but much less frequent since we're using period transitions)
  startPeriodicChecks() {
    // ✅ IMPORTANT: Don't run automatic checks every 1 minute
    // Instead, only run during actual period transitions
    console.log(
      "⏰ Enhanced disconnected player manager ready (period-transition-based)"
    );

    // Optional: Run a very infrequent check for cleanup (every 30 minutes)
    this.checkInterval = setInterval(() => {
      console.log("🧹 Periodic cleanup check...");
      storage.cleanup();
    }, 30 * 60 * 1000); // 30 minutes
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log("🛑 Enhanced disconnected player checks stopped");
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastCheckTime: this.lastCheckTime,
      totalChecks: this.totalChecks,
      totalResets: this.totalResets,
      totalPreserved: this.totalPreserved,
      intervalActive: !!this.checkInterval,
      mode: "period_transition_based",
      currentPeriod: storage.getCurrentPeriodString(),
      storageDebug: storage.getDebugInfo(),
    };
  }

  // ✅ NEW: Get detailed statistics
  async getDetailedStats() {
    try {
      const allStreaks = storage.getAllStreaks();
      const currentPeriod = storage.getCurrentPeriodString();
      const stats = {
        totalPlayers: allStreaks.length,
        playersWithStreaks: 0,
        winnersThisPeriod: 0,
        playersAtRisk: 0,
        safeWinners: 0,
        playersWithIncompleteGames: 0,
      };

      for (const player of allStreaks) {
        const walletAddress = player.fullWallet;
        const currentStreak = player.currentStreak || 0;

        if (currentStreak > 0) {
          stats.playersWithStreaks++;

          const hasPlayedToday = storage.hasPlayedToday(walletAddress);
          const wonCurrentPeriod = await this.checkPlayerWonCurrentPeriod(
            walletAddress
          );
          const incompleteGameCheck = await this.checkPlayerHasIncompleteGame(
            walletAddress
          );

          if (incompleteGameCheck.hasIncomplete) {
            stats.playersWithIncompleteGames++;
          }

          if (wonCurrentPeriod) {
            stats.winnersThisPeriod++;
            if (!hasPlayedToday) {
              stats.safeWinners++;
            }
          } else if (!hasPlayedToday) {
            stats.playersAtRisk++;
          }
        }
      }

      return {
        ...stats,
        currentPeriod,
        managerStatus: this.getStatus(),
      };
    } catch (error) {
      console.error("Error getting detailed stats:", error);
      return { error: error.message };
    }
  }
}

// ✅ Create the enhanced manager
const enhancedDisconnectedPlayerManager =
  new EnhancedDisconnectedPlayerManager();

// ✅ Make enhanced manager available globally for admin routes
global.enhancedDisconnectedPlayerManager = enhancedDisconnectedPlayerManager;

// ✅ Make functions available globally
global.checkDisconnectedPlayersForPeriodTransition = (reason) =>
  enhancedDisconnectedPlayerManager.checkDisconnectedPlayersForPeriodTransition(
    reason
  );

global.checkSpecificPlayerDisconnection = (walletAddress, reason) =>
  enhancedDisconnectedPlayerManager.checkSpecificPlayerDisconnection(
    walletAddress,
    reason
  );

// ✅ PERIOD TRANSITION HANDLER
// This should be called by the countdown timer when a new period starts
global.handlePeriodTransition = async () => {
  console.log("🔄 Server handling period transition...");

  try {
    // ✅ STEP 1: Handle incomplete games BEFORE clearing them
    console.log("🔍 Processing incomplete games before period transition...");
    let incompleteGamesProcessed = 0;

    for (let [gameId, game] of storage.activeGames.entries()) {
      if (!game.isComplete) {
        console.log(`📝 Processing incomplete game: ${gameId.slice(0, 8)}... for ${game.walletAddress.slice(0, 8)}...`);

        // Mark game as complete with loss
        game.isComplete = true;
        game.isWin = false;
        game.abandonedAt = Date.now();
        game.abandonReason = "period_transition_timeout";
        storage.saveGame(game);

        // Reset player's streak
        const streakData = storage.getStreakData(game.walletAddress);
        const oldStreak = streakData.currentStreak;

        if (oldStreak > 0) {
          streakData.currentStreak = 0;
          streakData.lastPlayedDate = storage.getCurrentPeriodString();
          storage.saveStreakData(game.walletAddress, streakData);

          console.log(`💔 Streak reset for ${game.walletAddress.slice(0, 8)}...: ${oldStreak} -> 0`);

          // Broadcast streak reset to client if connected
          if (global.broadcastToPlayer) {
            global.broadcastToPlayer(game.walletAddress, "streak-reset", {
              oldStreak,
              newStreak: 0,
              reason: "incomplete_game_period_transition",
              word: game.answer || "UNKNOWN"
            });
          }
        }


        incompleteGamesProcessed++;
      }
    }

    console.log(`✅ Processed ${incompleteGamesProcessed} incomplete games`);

    // ✅ STEP 2: Now clear all active games (forces fresh start)
    const activeGameCount = storage.activeGames.size;
    console.log(`🧹 Clearing ${activeGameCount} active games for period transition`);
    storage.activeGames.clear();

    // ✅ STEP 3: Check and reset disconnected players who didn't win
    const result =
      await enhancedDisconnectedPlayerManager.checkDisconnectedPlayersForPeriodTransition(
        "period_transition"
      );

    // ✅ STEP 4: Clear old period data
    storage.cleanup();

    // ✅ NEW: Refresh words for all players for new period
    console.log("🎲 Refreshing words for all players due to period transition...");
    const wordsRefreshed = storage.refreshAllPlayerWords();
    console.log(`✅ Refreshed ${wordsRefreshed} player words for new period`);

    // ✅ STEP 5: Broadcast period transition to all clients
    if (global.io) {
      console.log("📡 Broadcasting period transition to all clients");
      global.io.emit('period-transition', {
        message: 'New period started - all games reset',
        newPeriod: storage.getCurrentPeriodString(),
        timestamp: new Date().toISOString(),
        requiresNewDeposit: true
      });
    }

    console.log("✅ Period transition complete on server");
    return {
      ...result,
      incompleteGamesProcessed,
      activeGamesCleared: activeGameCount,
      newPeriod: storage.getCurrentPeriodString()
    };
  } catch (error) {
    console.error("❌ Error handling period transition:", error);
    return { success: false, error: error.message };
  }
};

// ✅ ============================ ENHANCED API ROUTES ============================

// Test game status endpoint (FIXED)
app.post("/api/test-game-status-check", async (req, res) => {
  const { walletAddress } = req.body;

  if (!walletAddress) {
    return res.status(400).json({ error: "Missing wallet address" });
  }

  try {
    const wonCurrentPeriod = storage.hasWonCurrentPeriod(walletAddress);
    const incompleteGameCheck =
      await enhancedDisconnectedPlayerManager.checkPlayerHasIncompleteGame(
        walletAddress
      );
    const hasPlayedToday = storage.hasPlayedToday(walletAddress);
    const streakData = storage.getStreakData(walletAddress);
    const currentPeriodGameData =
      storage.getCurrentPeriodGameData(walletAddress);
    const debugInfo = storage.getDebugInfo();

    const result = {
      walletAddress: walletAddress.slice(0, 8) + "...",
      fullWalletAddress: walletAddress,
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
      currentPeriodGameData,
      debugInfo,
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

// Manual period transition trigger (for testing)
app.post("/api/trigger-period-transition", async (req, res) => {
  try {
    console.log("🔄 Manual period transition triggered via API");
    const result = await global.handlePeriodTransition();

    res.json({
      success: true,
      message: "Period transition completed",
      data: result,
    });
  } catch (error) {
    console.error("Error triggering period transition:", error);
    res.status(500).json({ error: "Failed to trigger period transition" });
  }
});

// Get enhanced manager status
app.get("/api/disconnected-manager-status", async (req, res) => {
  try {
    const status = enhancedDisconnectedPlayerManager.getStatus();
    const detailedStats =
      await enhancedDisconnectedPlayerManager.getDetailedStats();

    res.json({
      success: true,
      data: {
        manager: status,
        stats: detailedStats,
      },
    });
  } catch (error) {
    console.error("Error getting status:", error);
    res.status(500).json({ error: "Failed to get status" });
  }
});

// Enhanced admin route for manual disconnected player check
app.post("/api/admin/check-disconnected-players", async (req, res) => {
  try {
    const { reason = "manual_admin_check" } = req.body;

    console.log(
      `👨‍💼 Admin triggered enhanced disconnected player check: ${reason}`
    );

    const result =
      await enhancedDisconnectedPlayerManager.checkDisconnectedPlayersForPeriodTransition(
        reason
      );

    if (result.success) {
      const summary = result.summary;
      console.log(
        `✅ Enhanced admin check complete: ${summary.streaksReset} reset, ${summary.streaksPreserved} preserved`
      );

      res.json({
        success: true,
        message: `Enhanced check complete: ${summary.streaksReset} streaks reset, ${summary.streaksPreserved} winners preserved`,
        data: summary,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error("Error in enhanced admin disconnected player check:", error);
    res.status(500).json({ error: "Failed to check disconnected players" });
  }
});

// Enhanced route for checking all disconnected players (public endpoint for manual use)
app.post("/api/check-all-disconnected-players", async (req, res) => {
  try {
    const { reason = "manual_check" } = req.body;

    console.log(
      `🔍 Manual enhanced disconnected player check triggered: ${reason}`
    );

    const result =
      await enhancedDisconnectedPlayerManager.checkDisconnectedPlayersForPeriodTransition(
        reason
      );

    if (result.success) {
      const summary = result.summary;

      res.json({
        success: true,
        message: `Enhanced check: ${summary.totalPlayersChecked} players examined, ${summary.streaksReset} streaks reset, ${summary.streaksPreserved} winners preserved`,
        summary,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error("Error in manual enhanced disconnected check:", error);
    res.status(500).json({ error: "Failed to check disconnected players" });
  }
});

// Get current period information
app.get("/api/current-period-info", (req, res) => {
  try {
    const debugInfo = storage.getDebugInfo();
    const currentPeriod = storage.getCurrentPeriodString();
    const previousPeriod = storage.getPreviousPeriodString();
    const timeUntilReset = storage.getTimeUntilNextReset();

    res.json({
      success: true,
      data: {
        currentPeriod,
        previousPeriod,
        timeUntilReset,
        ...debugInfo,
      },
    });
  } catch (error) {
    console.error("Error getting current period info:", error);
    res.status(500).json({ error: "Failed to get period info" });
  }
});

// Check if player won in the previous period
app.get("/api/check-previous-period-win/:walletAddress", async (req, res) => {
  try {
    const { walletAddress } = req.params;
    if (!walletAddress) {
      return res.status(400).json({ error: "Wallet address required" });
    }

    console.log(`🔍 Checking previous period win for: ${walletAddress.slice(0, 8)}...`);

    const previousPeriod = storage.getPreviousPeriodString();
    console.log(`🔍 Previous period: ${previousPeriod}`);

    // Check if player won in the previous period
    const previousKey = `${walletAddress}-${previousPeriod}`;
    const previousGameData = storage.dailyGames.get(previousKey);
    const wonPreviousPeriod = previousGameData && previousGameData.isWin === true;

    console.log(`🔍 Player ${walletAddress.slice(0, 8)}... won previous period (${previousPeriod}):`, wonPreviousPeriod);

    res.json({
      success: true,
      wonPreviousPeriod,
      previousPeriod,
      walletAddress: walletAddress.slice(0, 8) + "..."
    });
  } catch (error) {
    console.error("Error checking previous period win:", error);
    res.status(500).json({ error: "Failed to check previous period win" });
  }
});

// Debug endpoint for all players
app.get("/api/debug-all-players", async (req, res) => {
  try {
    const allStreaks = storage.getAllStreaks();
    const currentPeriod = storage.getCurrentPeriodString();
    const playerDebugInfo = [];

    for (const player of allStreaks) {
      const walletAddress = player.fullWallet;
      const streakData = storage.getStreakData(walletAddress);
      const hasPlayedToday = storage.hasPlayedToday(walletAddress);
      const wonCurrentPeriod = storage.hasWonCurrentPeriod(walletAddress);
      const currentPeriodGameData =
        storage.getCurrentPeriodGameData(walletAddress);
      const incompleteGameCheck =
        await enhancedDisconnectedPlayerManager.checkPlayerHasIncompleteGame(
          walletAddress
        );

      playerDebugInfo.push({
        walletAddress: walletAddress.slice(0, 8) + "...",
        fullWallet: walletAddress,
        currentStreak: streakData.currentStreak || 0,
        hasPlayedToday,
        wonCurrentPeriod,
        hasIncompleteGame: incompleteGameCheck.hasIncomplete,
        currentPeriodGameData,
        shouldResetStreak:
          (streakData.currentStreak || 0) > 0 &&
          !hasPlayedToday &&
          !wonCurrentPeriod,
        status: hasPlayedToday
          ? wonCurrentPeriod
            ? "Active Winner"
            : "Active"
          : (streakData.currentStreak || 0) > 0
          ? wonCurrentPeriod
            ? "Safe Winner"
            : "At Risk"
          : "Inactive",
      });
    }

    // Sort by streak descending
    playerDebugInfo.sort((a, b) => b.currentStreak - a.currentStreak);

    res.json({
      success: true,
      data: {
        currentPeriod,
        totalPlayers: playerDebugInfo.length,
        players: playerDebugInfo,
        summary: {
          activeWinners: playerDebugInfo.filter(
            (p) => p.status === "Active Winner"
          ).length,
          active: playerDebugInfo.filter((p) => p.status === "Active").length,
          safeWinners: playerDebugInfo.filter((p) => p.status === "Safe Winner")
            .length,
          atRisk: playerDebugInfo.filter((p) => p.status === "At Risk").length,
          inactive: playerDebugInfo.filter((p) => p.status === "Inactive")
            .length,
          incompleteGames: playerDebugInfo.filter((p) => p.hasIncompleteGame)
            .length,
        },
      },
    });
  } catch (error) {
    console.error("Error getting debug info for all players:", error);
    res.status(500).json({ error: "Failed to get debug info" });
  }
});

// ✅ Start the server FIRST, then initialize enhanced disconnected player monitoring
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for real-time updates`);
  console.log(`🔍 Enhanced disconnected player management system loaded`);
  console.log(`🔥 Burn statistics API available at /api/burn/*`); // ✅ NEW

  // ✅ Start enhanced disconnected player monitoring AFTER server is running
  setTimeout(() => {
    console.log("🔍 Starting enhanced disconnected player monitoring...");
    enhancedDisconnectedPlayerManager.startPeriodicChecks();

    // ✅ NEW: Initialize random word assignments for new players only
    setTimeout(() => {
      console.log("🎲 Initializing random word assignments for new players...");
      storage.autoAssignRandomWordsToAllPlayers(false); // Don't force - only assign to truly new players
    }, 2000);

    // Run initial cleanup
    setTimeout(() => {
      console.log("🧹 Running initial cleanup...");
      storage.cleanup();
    }, 5000);
  }, 2000);
});

// ✅ Enhanced cleanup on server shutdown
process.on("SIGINT", () => {
  console.log("🛑 Shutting down server...");
  enhancedDisconnectedPlayerManager.stop();
  server.close(() => {
    console.log("✅ Server shut down gracefully");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("🛑 Shutting down server...");
  enhancedDisconnectedPlayerManager.stop();
  server.close(() => {
    console.log("✅ Server shut down gracefully");
    process.exit(0);
  });
});
