// backend/routes/game.js - Add the missing pause status endpoint

const express = require("express");
const router = express.Router();
const GameEngine = require("../utils/gameEngine");
const CryptoUtils = require("../utils/crypto");
const storage = require("../data/storage");

const gameEngine = new GameEngine();

// ✅ FIXED: Import admin pause and finish functions and create fallbacks
let isGameCurrentlyPaused, getPauseInfo, isGameCurrentlyFinished, getFinishInfo;

try {
  const adminModule = require("./admin");
  isGameCurrentlyPaused = adminModule.isGameCurrentlyPaused || (() => false);
  getPauseInfo =
    adminModule.getPauseInfo ||
    (() => ({ isPaused: false, pausedBy: null, pausedAt: null }));
  isGameCurrentlyFinished = adminModule.isGameCurrentlyFinished || (() => false);
  getFinishInfo =
    adminModule.getFinishInfo ||
    (() => ({ isFinished: false, finishedBy: null, finishedAt: null, leaderboard: null }));
} catch (error) {
  console.warn("⚠️ Admin functions not available, creating fallbacks");
  isGameCurrentlyPaused = () => false;
  getPauseInfo = () => ({ isPaused: false, pausedBy: null, pausedAt: null });
  isGameCurrentlyFinished = () => false;
  getFinishInfo = () => ({ isFinished: false, finishedBy: null, finishedAt: null, leaderboard: null });
}

// ✅ NEW: Add the missing pause status endpoint that the frontend expects
router.get("/pause-status", (req, res) => {
  try {
    const pauseInfo = getPauseInfo();

    res.json({
      success: true,
      isPaused: pauseInfo.isPaused,
      pausedBy: pauseInfo.pausedBy,
      pausedAt: pauseInfo.pausedAt,
      message: pauseInfo.isPaused
        ? "Game is currently paused by administrator"
        : "Game is active",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting pause status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get pause status",
      isPaused: false, // Default to not paused on error
    });
  }
});

// ✅ NEW: Add the finish status endpoint that the frontend expects
router.get("/finish-status", (req, res) => {
  try {
    const finishInfo = getFinishInfo();

    res.json({
      success: true,
      isFinished: finishInfo.isFinished,
      finishedBy: finishInfo.finishedBy,
      finishedAt: finishInfo.finishedAt,
      leaderboard: finishInfo.leaderboard,
      message: finishInfo.isFinished
        ? "Game is finished - results available"
        : "Game is active",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting finish status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get finish status",
      isFinished: false, // Default to not finished on error
    });
  }
});

// ✅ FIXED: Apply pause middleware to all game endpoints
const checkGamePauseMiddleware = (req, res, next) => {
  if (isGameCurrentlyPaused()) {
    const pauseInfo = getPauseInfo();
    return res.status(503).json({
      success: false,
      error: "Game is currently paused by administrator",
      isPaused: true,
      pausedBy: pauseInfo.pausedBy,
      pausedAt: pauseInfo.pausedAt,
    });
  }
  next();
};



// ✅ Get current active game state for a player (with pause info)
router.get("/current-game/:walletAddress", (req, res) => {
  const { walletAddress } = req.params;

  console.log("🔍 === CURRENT-GAME DEBUG START ===");
  console.log("📊 Getting current game for wallet:", walletAddress.slice(0, 8) + "...");

  try {
    // First, find active incomplete game for this wallet
    let activeGame = null;
    console.log("🔍 Searching active games. Total active games:", storage.activeGames.size);

    for (let [gameId, game] of storage.activeGames.entries()) {
      console.log("🔍 Checking game:", {
        gameId: gameId.slice(0, 8) + "...",
        wallet: game.walletAddress.slice(0, 8) + "...",
        isComplete: game.isComplete,
        matches: game.walletAddress === walletAddress && !game.isComplete
      });

      if (game.walletAddress === walletAddress && !game.isComplete) {
        activeGame = game;
        console.log("🔍 Found matching active game:", gameId.slice(0, 8) + "...");
        break;
      }
    }

    if (!activeGame) {
      console.log("🔍 No active incomplete game found for this wallet");
    }

    // ✅ FIXED: Check if active game is valid for current period
    if (activeGame) {
      const hasDepositedThisPeriod = storage.hasDepositedForCurrentPeriod(walletAddress);
      const isFromPreviousPeriod = storage.isGameFromPreviousPeriod(activeGame);

      console.log("🔍 Validating active game:", {
        hasDepositedThisPeriod,
        isFromPreviousPeriod,
        gameStartTime: activeGame.startTime,
        currentPeriod: storage.getCurrentPeriodString()
      });

      // ✅ FIX: Don't delete incomplete games on restoration
      // Only delete if from previous period, not for deposit validation
      if (isFromPreviousPeriod) {
        console.log("❌ Found active game from previous period - invalidating game");
        // Remove the invalid game from active games
        storage.deleteGame(activeGame.gameId);
        activeGame = null;
      } else if (!hasDepositedThisPeriod) {
        console.log("⚠️ Found active game but no deposit for current period - keeping game but marking issue");
        // Keep the game but log the issue for debugging
        console.log("🔍 Game details:", {
          gameId: activeGame.gameId,
          hasDepositedThisPeriod,
          gameStartTime: activeGame.startTime
        });
      } else {
        console.log("✅ Active game is valid - keeping it");
      }
    }

    // ✅ FIXED: If no active game, check for completed game in current period
    // BUT only if player has deposited for current period
    if (!activeGame) {
      const currentPeriodGameData = storage.getCurrentPeriodGameData(walletAddress);
      const hasDepositedThisPeriod = storage.hasDepositedForCurrentPeriod(walletAddress);

      if (currentPeriodGameData && hasDepositedThisPeriod) {
        console.log("📊 Found completed game in current period for:", walletAddress, "with valid deposit");

        // ✅ Get pause info
        const pauseInfo = getPauseInfo();

        // Return the completed game state
        const gameState = {
          gameId: currentPeriodGameData.gameId,
          guesses: currentPeriodGameData.guesses || [],
          isComplete: true,
          isWin: currentPeriodGameData.isWin,
          maxGuesses: currentPeriodGameData.maxGuesses || 6,
          guessesRemaining: 0,
          startTime: currentPeriodGameData.startTime,
          answer: currentPeriodGameData.answer ? currentPeriodGameData.answer.toUpperCase() : undefined,
          isPaused: pauseInfo.isPaused,
          pausedBy: pauseInfo.pausedBy,
          pausedAt: pauseInfo.pausedAt,
        };

        return res.json({
          success: true,
          hasActiveGame: true,
          gameState: gameState,
          pauseInfo: pauseInfo,
          fromCompletedPeriod: true,
        });
      } else if (currentPeriodGameData && !hasDepositedThisPeriod) {
        console.log("📊 Found completed game in current period for:", walletAddress, "but no deposit for current period - requiring new deposit");
      }
    }

    // ✅ Get pause info
    const pauseInfo = getPauseInfo();

    if (!activeGame) {
      console.log("🔍 No active game found - checking what happened:");
      console.log("🔍 Total active games in storage:", storage.activeGames.size);
      console.log("🔍 All active games:");
      for (let [gameId, game] of storage.activeGames.entries()) {
        console.log("  Game:", gameId.slice(0, 8) + "...", "Wallet:", game.walletAddress.slice(0, 8) + "...", "Complete:", game.isComplete);
      }

      console.log("📊 No active or completed game found for:", walletAddress.slice(0, 8) + "...");
      console.log("🔍 === CURRENT-GAME DEBUG END (NO ACTIVE GAME) ===");
      return res.json({
        success: true,
        hasActiveGame: false,
        gameState: null,
        pauseInfo: pauseInfo,
      });
    }

    console.log("📊 Found active game:", activeGame.gameId);

    // Return safe game state (without revealing answer)
    const gameState = {
      gameId: activeGame.gameId,
      guesses: activeGame.guesses.map((g) => ({
        guess: g.guess,
        result: g.result,
        timestamp: g.timestamp,
      })),
      isComplete: activeGame.isComplete,
      isWin: activeGame.isWin,
      maxGuesses: activeGame.maxGuesses,
      guessesRemaining: activeGame.maxGuesses - activeGame.guesses.length,
      startTime: activeGame.startTime,
      answer: activeGame.isComplete
        ? activeGame.answer.toUpperCase()
        : undefined,
      isPaused: pauseInfo.isPaused,
      pausedBy: pauseInfo.pausedBy,
      pausedAt: pauseInfo.pausedAt,
    };

    // ✅ FIX: Include deposit status so frontend knows if game should be playable
    const hasDepositedThisPeriod = storage.hasDepositedForCurrentPeriod(walletAddress);

    res.json({
      success: true,
      hasActiveGame: true,
      gameState: gameState,
      pauseInfo: pauseInfo,
      hasDepositedThisPeriod: hasDepositedThisPeriod,
    });
  } catch (error) {
    console.error("❌ Error getting current game:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get current game state",
    });
  }
});

// ✅ Start game route with pause protection
router.post("/start-game", checkGamePauseMiddleware, (req, res) => {
  const { walletAddress, signature, timestamp, maxGuesses } = req.body;

  console.log("🚀 Start game request received:");
  console.log("  Wallet:", walletAddress);
  console.log("  Timestamp:", timestamp);
  console.log("  Signature length:", signature?.length);

  if (!walletAddress || !signature || !timestamp) {
    console.error("❌ Missing required fields for start-game");
    return res.status(400).json({ error: "Missing required fields" });
  }

  // ✅ Check for existing active game first
  console.log("🔍 Checking for existing active game...");
  let existingGame = null;
  for (let [gameId, game] of storage.activeGames.entries()) {
    if (game.walletAddress === walletAddress && !game.isComplete) {
      existingGame = game;
      break;
    }
  }

  if (existingGame) {
    console.log("⚠️ Player already has active game:", existingGame.gameId);
    return res.status(409).json({
      error: "You already have an active game in progress",
      existingGameId: existingGame.gameId,
      guessCount: existingGame.guesses.length,
      maxGuesses: existingGame.maxGuesses,
    });
  }

  // ✅ Verify signature
  const validationParams = {
    walletAddress,
    action: "start",
    gameId: "new",
    data: walletAddress,
    timestamp,
    signature,
  };

  console.log("🔍 Validating start-game signature...");
  const isValid = CryptoUtils.validateGameAction(validationParams);

  if (!isValid) {
    console.error("❌ Start-game signature validation failed");
    return res.status(401).json({ error: "Invalid signature or timestamp" });
  }

  // Check if player has deposited for current period
  if (!storage.hasDepositedForCurrentPeriod(walletAddress)) {
    console.log("💰 Player has not deposited for current period:", walletAddress);
    return res.status(402).json({
      error: "Deposit required to play this period",
      needsDeposit: true,
      timeUntilReset: storage.getTimeUntilNextReset(),
    });
  }

  // Check daily limit
  if (storage.hasPlayedToday(walletAddress)) {
    console.log("⏰ Player has already played today:", walletAddress);
    return res.status(429).json({
      error: "You have already played today. Come back tomorrow!",
      timeUntilReset: storage.getTimeUntilNextReset(),
    });
  }

  try {
    // Use maxGuesses from client if provided, otherwise default to 6
    const gameMaxGuesses = (maxGuesses && maxGuesses >= 3 && maxGuesses <= 6) ? maxGuesses : 6;
    console.log("🎯 Creating game with maxGuesses:", gameMaxGuesses);

    const game = gameEngine.createGame(walletAddress, gameMaxGuesses);
    storage.saveGame(game);

    console.log("✅ Game created successfully:", game.gameId);

    res.json({
      gameId: game.gameId,
      maxGuesses: game.maxGuesses,
      startTime: game.startTime,
    });
  } catch (error) {
    console.error("❌ Error starting game:", error);
    res.status(500).json({ error: "Failed to start game" });
  }
});

// ✅ Guess route with pause protection
router.post("/guess", checkGamePauseMiddleware, async (req, res) => {
  console.log(
    "📝 Guess endpoint called with body:",
    JSON.stringify(req.body, null, 2)
  );

  const { gameId, guess, walletAddress, signature, timestamp } = req.body;

  // Validate required fields
  if (!gameId || !guess || !walletAddress || !signature || !timestamp) {
    console.error("❌ Missing required fields:", {
      gameId: !!gameId,
      guess: !!guess,
      walletAddress: !!walletAddress,
      signature: !!signature,
      timestamp: !!timestamp,
    });
    return res.status(400).json({ error: "Missing required fields" });
  }

  console.log("🔍 Looking for game:", gameId);
  const game = storage.getGame(gameId);
  if (!game) {
    console.error("❌ Game not found:", gameId);
    return res.status(404).json({ error: "Game not found" });
  }

  console.log("🎮 Found game:", {
    gameId: game.gameId,
    walletAddress: game.walletAddress,
    isComplete: game.isComplete,
    currentGuesses: game.guesses?.length || 0,
    answer: game.answer, // For debugging - remove in production
  });

  // Validate game ownership
  if (game.walletAddress !== walletAddress) {
    console.error("❌ Wallet address mismatch:", {
      gameWallet: game.walletAddress,
      requestWallet: walletAddress,
    });
    return res.status(403).json({ error: "Not your game" });
  }

  // Check if game is already complete
  if (game.isComplete) {
    console.error("❌ Game already complete");
    return res.status(400).json({ error: "Game already completed" });
  }

  // ✅ Verify signature with lowercase data to match frontend
  console.log("🔐 Verifying signature...");
  const isValid = CryptoUtils.validateGameAction({
    walletAddress,
    action: "guess",
    gameId,
    data: guess.toLowerCase().trim(),
    timestamp,
    signature,
  });

  if (!isValid) {
    console.error("❌ Invalid signature or timestamp");
    return res.status(401).json({ error: "Invalid signature or timestamp" });
  }

  console.log("✅ Signature valid");

  // Validate game sequence
  console.log("🕒 Validating game sequence...");
  if (!gameEngine.validateGameSequence(game, guess)) {
    console.error("❌ Invalid game sequence");
    return res.status(400).json({ error: "Invalid game sequence" });
  }

  console.log("✅ Game sequence valid");

  try {
    console.log("🎯 Processing guess:", guess);

    // ✅ Process the guess and get the result
    const gameResult = await gameEngine.processGuess(game, guess);
    console.log(
      "📊 Raw game engine result:",
      JSON.stringify(gameResult, null, 2)
    );

    // ✅ Validate result exists and is proper format
    if (
      !gameResult ||
      !gameResult.result ||
      !Array.isArray(gameResult.result) ||
      gameResult.result.length !== 5
    ) {
      console.error("❌ CRITICAL: Invalid game engine result format");
      return res.status(500).json({
        error: "Game processing failed - invalid result format",
      });
    }

    // Save the updated game state
    storage.saveGame(game);
    console.log("💾 Game saved successfully");

    // ✅ Construct safe response
    const response = {
      result: gameResult.result,
      isWin: Boolean(gameResult.isWin),
      isGameOver: Boolean(gameResult.isGameOver),
      answer: gameResult.answer || undefined,
      guessesRemaining: parseInt(gameResult.guessesRemaining) || 0,
      guessCount: parseInt(gameResult.guessCount) || 0,
    };

    console.log(
      "📤 Sending validated response:",
      JSON.stringify(response, null, 2)
    );

    // Send the response
    res.json(response);
  } catch (error) {
    console.error("❌ CRITICAL ERROR in guess processing:", error);
    res.status(500).json({
      error: error.message || "Failed to process guess",
    });
  }
});

// ✅ Force start new game with pause protection
router.post("/force-start-game", checkGamePauseMiddleware, (req, res) => {
  const { walletAddress, signature, timestamp, maxGuesses } = req.body;

  console.log("🚀 Force start game request received:");
  console.log("  Wallet:", walletAddress);

  if (!walletAddress || !signature || !timestamp) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Verify signature
  const validationParams = {
    walletAddress,
    action: "start",
    gameId: "new",
    data: walletAddress,
    timestamp,
    signature,
  };

  const isValid = CryptoUtils.validateGameAction(validationParams);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid signature or timestamp" });
  }

  try {
    // Remove any existing active games for this wallet
    for (let [gameId, game] of storage.activeGames.entries()) {
      if (game.walletAddress === walletAddress && !game.isComplete) {
        console.log("🗑️ Removing existing active game:", gameId);
        storage.deleteGame(gameId);
      }
    }

    // Create new game with difficulty
    const gameMaxGuesses = (maxGuesses && maxGuesses >= 3 && maxGuesses <= 6) ? maxGuesses : 6;
    console.log("🎯 Force creating game with maxGuesses:", gameMaxGuesses);

    const game = gameEngine.createGame(walletAddress, gameMaxGuesses);
    storage.saveGame(game);

    console.log("✅ Force created game successfully:", game.gameId);

    res.json({
      gameId: game.gameId,
      maxGuesses: game.maxGuesses,
      startTime: game.startTime,
      forced: true,
    });
  } catch (error) {
    console.error("❌ Error force starting game:", error);
    res.status(500).json({ error: "Failed to force start game" });
  }
});

// ✅ Abandon current game (no pause protection needed - admin cleanup)
router.post("/abandon-game", (req, res) => {
  const { walletAddress, gameId, signature, timestamp } = req.body;

  if (!walletAddress || !gameId || !signature || !timestamp) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Verify signature
  const isValid = CryptoUtils.validateGameAction({
    walletAddress,
    action: "abandon",
    gameId,
    data: "abandon",
    timestamp,
    signature,
  });

  if (!isValid) {
    return res.status(401).json({ error: "Invalid signature or timestamp" });
  }

  try {
    const game = storage.getGame(gameId);
    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }

    if (game.walletAddress !== walletAddress) {
      return res.status(403).json({ error: "Not your game" });
    }

    // Mark game as abandoned
    game.isComplete = true;
    game.isWin = false;
    game.abandonedAt = Date.now();
    storage.saveGame(game);

    console.log("🗑️ Game abandoned:", gameId);

    res.json({
      success: true,
      message: "Game abandoned successfully",
    });
  } catch (error) {
    console.error("❌ Error abandoning game:", error);
    res.status(500).json({ error: "Failed to abandon game" });
  }
});

// ✅ Get game state (for debugging) - no pause protection needed
router.get("/game/:gameId", (req, res) => {
  const { gameId } = req.params;
  console.log("📊 Game state request for:", gameId);

  const game = storage.getGame(gameId);

  if (!game) {
    console.error("❌ Game not found for state request:", gameId);
    return res.status(404).json({ error: "Game not found" });
  }

  // Don't reveal the answer unless game is complete
  const safeGame = {
    gameId: game.gameId,
    guesses: game.guesses,
    isComplete: game.isComplete,
    isWin: game.isWin,
    guessesRemaining: game.maxGuesses - (game.guesses?.length || 0),
    answer: game.isComplete ? game.answer : undefined,
    pauseInfo: getPauseInfo(),
    debug: {
      hasAnswer: !!game.answer,
      answerLength: game.answer?.length,
      guessCount: game.guesses?.length || 0,
    },
  };

  console.log("✅ Game state retrieved successfully");
  res.json(safeGame);
});

// ✅ Enhanced pause-aware game status check
router.get("/game-status/:walletAddress", (req, res) => {
  const { walletAddress } = req.params;

  try {
    // Find active game
    let activeGame = null;
    for (let [gameId, game] of storage.activeGames.entries()) {
      if (game.walletAddress === walletAddress && !game.isComplete) {
        activeGame = game;
        break;
      }
    }

    const pauseInfo = getPauseInfo();
    const hasPlayedToday = storage.hasPlayedToday(walletAddress);
    const hasDepositedThisPeriod = storage.hasDepositedForCurrentPeriod(walletAddress);
    const streakData = storage.getStreakData(walletAddress);

    const status = {
      hasActiveGame: !!activeGame,
      gameId: activeGame?.gameId || null,
      isComplete: activeGame?.isComplete || false,
      isPaused: pauseInfo.isPaused,
      pausedBy: pauseInfo.pausedBy,
      pausedAt: pauseInfo.pausedAt,
      hasPlayedToday: hasPlayedToday,
      hasDepositedThisPeriod: hasDepositedThisPeriod,
      currentStreak: streakData.currentStreak || 0,
      canPlay: !pauseInfo.isPaused && !hasPlayedToday && hasDepositedThisPeriod,
      needsDeposit: !hasDepositedThisPeriod,
      timeUntilReset: storage.getTimeUntilNextReset(),
      message: pauseInfo.isPaused
        ? "Game is paused by administrator"
        : !hasDepositedThisPeriod
        ? "Deposit required to play"
        : hasPlayedToday
        ? "You have already played today"
        : "Ready to play",
    };

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("Error getting game status:", error);
    res.status(500).json({ error: "Failed to get game status" });
  }
});

// ✅ Record deposit for current period (simplified - no additional signature required)
router.post("/record-deposit", (req, res) => {
  const { walletAddress, transactionSignature, amount } = req.body;

  if (!walletAddress || !transactionSignature) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Check if already deposited for this period
    if (storage.hasDepositedForCurrentPeriod(walletAddress)) {
      return res.status(409).json({
        error: "Already deposited for this period",
        hasDeposited: true,
      });
    }

    // Record the deposit (no additional signature verification needed - transaction signature is proof enough)
    storage.markDepositForCurrentPeriod(walletAddress, {
      transactionSignature,
      amount: amount || 0.01,
      timestamp: new Date(),
    });

    console.log(`✅ Deposit recorded for ${walletAddress.slice(0, 8)}... with tx: ${transactionSignature.slice(0, 8)}...`);

    res.json({
      success: true,
      message: "Deposit recorded successfully",
      canStartGame: true,
    });
  } catch (error) {
    console.error("❌ Error recording deposit:", error);
    res.status(500).json({ error: "Failed to record deposit" });
  }
});

// ✅ DEBUG ENDPOINTS (no pause protection needed)
router.post("/debug-game-engine", (req, res) => {
  try {
    console.log("🧪 Debug game engine endpoint called");

    const testGuess = "hello";
    const testAnswer = "world";
    const result = gameEngine.checkGuess(testGuess, testAnswer);

    const isValid =
      Array.isArray(result) &&
      result.length === 5 &&
      result.every((item) => ["correct", "present", "absent"].includes(item));

    const response = {
      success: true,
      testGuess,
      testAnswer,
      result,
      resultLength: result?.length,
      resultValid: isValid,
      resultType: typeof result,
      isArray: Array.isArray(result),
      gameEngineLoaded: !!gameEngine,
      checkGuessFunctionExists: typeof gameEngine.checkGuess === "function",
      pauseInfo: getPauseInfo(),
    };

    console.log("🧪 Debug response:", response);
    res.json(response);
  } catch (error) {
    console.error("❌ Debug game engine error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      gameEngineLoaded: !!gameEngine,
    });
  }
});

router.post("/debug-signature", (req, res) => {
  const { walletAddress, message, signature } = req.body;

  console.log("🧪 Debug signature test:");
  console.log("  Wallet:", walletAddress);
  console.log("  Message:", message);
  console.log("  Signature:", signature);

  try {
    const isValid = CryptoUtils.testSignatureValidation(
      walletAddress,
      message,
      signature
    );

    res.json({
      success: true,
      valid: isValid,
      message: isValid ? "Signature is valid" : "Signature is invalid",
      pauseInfo: getPauseInfo(),
    });
  } catch (error) {
    console.error("❌ Debug signature error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/debug-status", (req, res) => {
  try {
    const pauseInfo = getPauseInfo();

    const status = {
      success: true,
      server: "BURNdle Game Server",
      timestamp: new Date().toISOString(),
      gameControl: {
        isPaused: pauseInfo.isPaused,
        pausedBy: pauseInfo.pausedBy,
        pausedAt: pauseInfo.pausedAt,
        canAcceptNewGames: !pauseInfo.isPaused,
        canProcessGuesses: !pauseInfo.isPaused,
      },
      endpoints: {
        startGame: "/api/start-game",
        guess: "/api/guess",
        gameState: "/api/game/:gameId",
        currentGame: "/api/current-game/:walletAddress",
        gameStatus: "/api/game-status/:walletAddress",
        pauseStatus: "/api/pause-status",
        forceStartGame: "/api/force-start-game",
        abandonGame: "/api/abandon-game",
        recordDeposit: "/api/record-deposit",
      },
      gameEngine: {
        loaded: !!gameEngine,
        hasCheckGuess: typeof gameEngine.checkGuess === "function",
        hasProcessGuess: typeof gameEngine.processGuess === "function",
        hasCreateGame: typeof gameEngine.createGame === "function",
      },
      storage: {
        loaded: !!storage,
        hasGetGame: typeof storage.getGame === "function",
        hasSaveGame: typeof storage.saveGame === "function",
        activeGamesCount: storage.activeGames ? storage.activeGames.size : 0,
        hasDepositMethods: typeof storage.hasDepositedForCurrentPeriod === "function",
      },
      crypto: {
        loaded: !!CryptoUtils,
        hasValidateGameAction:
          typeof CryptoUtils.validateGameAction === "function",
      },
      storageDebug: storage.getDebugInfo(),
    };

    console.log("🔍 Debug status check:", status);
    res.json(status);
  } catch (error) {
    console.error("❌ Debug status error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

// ✅ TEST ENDPOINT: Simulate deposit for testing
router.post("/test-deposit", (req, res) => {
  const { walletAddress } = req.body;

  if (!walletAddress) {
    return res.status(400).json({ error: "Missing walletAddress" });
  }

  try {
    // Simulate a deposit
    storage.markDepositForCurrentPeriod(walletAddress, {
      transactionSignature: `test-${Date.now()}`,
      amount: 0.01,
      timestamp: new Date(),
      isTest: true,
    });

    res.json({
      success: true,
      message: "Test deposit recorded",
      walletAddress,
      period: storage.getCurrentPeriodString(),
    });
  } catch (error) {
    console.error("❌ Error creating test deposit:", error);
    res.status(500).json({ error: "Failed to create test deposit" });
  }
});

// ✅ TEST ENDPOINT: Create game from previous period
router.post("/test-create-old-game", (req, res) => {
  const { walletAddress } = req.body;

  if (!walletAddress) {
    return res.status(400).json({ error: "Missing walletAddress" });
  }

  try {
    const game = storage.createTestGameFromPreviousPeriod(walletAddress);

    res.json({
      success: true,
      message: "Test game from previous period created",
      gameId: game.gameId,
      walletAddress,
      startTime: game.startTime,
      period: game.period,
      currentPeriod: storage.getCurrentPeriodString(),
    });
  } catch (error) {
    console.error("❌ Error creating test game:", error);
    res.status(500).json({ error: "Failed to create test game" });
  }
});

// ✅ NEW: Create test game in current period to test restoration fix
router.post("/test-create-current-game", (req, res) => {
  const { walletAddress } = req.body;

  if (!walletAddress) {
    return res.status(400).json({ error: "Missing walletAddress" });
  }

  try {
    // Create an incomplete game in the current period
    const gameId = `test-current-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const currentTime = Date.now();

    const game = {
      gameId,
      walletAddress,
      startTime: currentTime,
      guesses: ["HELLO", "WORLD"], // Some test guesses
      isComplete: false,
      isWin: false,
      maxGuesses: 6,
      guessesRemaining: 4,
      answer: "TESTS",
      targetWord: "TESTS"
    };

    // Add to active games
    storage.saveGame(game);

    console.log(`🧪 Created test current game ${gameId} for ${walletAddress}`);

    res.json({
      success: true,
      message: "Test game in current period created",
      gameId: game.gameId,
      walletAddress,
      startTime: game.startTime,
      guesses: game.guesses,
      period: storage.getCurrentPeriodString(),
    });
  } catch (error) {
    console.error("❌ Error creating current test game:", error);
    res.status(500).json({ error: "Failed to create current test game" });
  }
});

// ✅ NEW: Handle incomplete game detection and streak reset
router.post("/handle-incomplete-game", async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: "Wallet address required" });
    }

    console.log(`💔 Handling incomplete game for ${walletAddress.slice(0, 8)}...`);

    // Debug: Check all active games
    console.log(`🔍 Total active games in storage: ${storage.activeGames.size}`);
    for (let [gameId, game] of storage.activeGames.entries()) {
      console.log(`🔍 Active game: ${gameId.slice(0, 8)}... - wallet: ${game.walletAddress.slice(0, 8)}... - complete: ${game.isComplete}`);
    }

    // Check if player has an active incomplete game
    const activeGame = storage.getActiveGame(walletAddress);
    console.log(`🔍 getActiveGame result for ${walletAddress.slice(0, 8)}...:`, activeGame ? 'FOUND' : 'NOT FOUND');

    if (!activeGame || activeGame.isComplete) {
      // ✅ FIX: Check if there was a game in current period that might have been cleared
      // This handles the race condition where period transition cleared the game before frontend could process it
      const currentPeriodGameData = storage.getCurrentPeriodGameData(walletAddress);
      if (currentPeriodGameData && !currentPeriodGameData.isWin) {
        console.log(`🔍 Found incomplete game data in current period for ${walletAddress.slice(0, 8)}...`);

        // Reset streak for the incomplete game
        const streakResetResult = await gameEngine.handleIncompleteGameStreakReset(walletAddress);

        return res.json({
          success: true,
          hasIncompleteGame: true,
          gameId: currentPeriodGameData.gameId,
          guessCount: currentPeriodGameData.guesses ? currentPeriodGameData.guesses.length : 0,
          answer: currentPeriodGameData.answer ? currentPeriodGameData.answer.toUpperCase() : "UNKNOWN",
          streakReset: streakResetResult,
          message: "Incomplete game handled from period data"
        });
      }

      return res.json({
        success: true,
        hasIncompleteGame: false,
        message: "No incomplete game found"
      });
    }

    console.log(`💔 Found incomplete game ${activeGame.gameId} with ${activeGame.guesses.length} guesses`);

    // Reset streak for incomplete game
    const streakResetResult = await gameEngine.handleIncompleteGameStreakReset(walletAddress);

    // Remove the incomplete game
    storage.deleteGame(activeGame.gameId);
    console.log(`🗑️ Deleted incomplete game ${activeGame.gameId}`);

    res.json({
      success: true,
      hasIncompleteGame: true,
      gameId: activeGame.gameId,
      guessCount: activeGame.guesses.length,
      answer: activeGame.answer.toUpperCase(), // Include answer for frontend display
      streakReset: streakResetResult,
      message: "Incomplete game handled and streak reset"
    });

  } catch (error) {
    console.error("❌ Error handling incomplete game:", error);
    res.status(500).json({
      error: "Failed to handle incomplete game",
      details: error.message
    });
  }
});

module.exports = router;
