// ============================== FIXED MAIN.JS WITH PROPER GAME STATE MANAGEMENT ==============================

// ✅ GLOBAL GAME VARIABLES
let guessedWords = [[]];
let availableSpace = 1;
let guessedWordCount = 0;
let gameId = null;
let gameComplete = false;
let gameEnabled = false;
let isPeriodTransition = false;

// Make variables globally accessible
window.gameId = gameId;
window.gameComplete = gameComplete;
window.gameEnabled = gameEnabled;

document.addEventListener("DOMContentLoaded", () => {
  createSquares();

  const keys = document.querySelectorAll(".keyboard-row button");
  const keyboardContainer = document.getElementById("keyboard-container");
  const API_BASE = "http://localhost:3000/api";

  // ✅ GAME STATE MANAGEMENT FUNCTIONS
  window.enableGame = () => {
    gameEnabled = true;
    window.gameEnabled = true;
  };

  window.disableGame = () => {
    gameEnabled = false;
    window.gameEnabled = false;
  };

  window.setPeriodTransition = function (state) {
    isPeriodTransition = state;

    // During period transition, disable game to prevent restoration
    if (state) {
      gameEnabled = false;
      window.gameEnabled = false;
    }
  };

  // ✅ COMPLETELY REWRITTEN: Reset game state with proper cleanup
  window.resetGameState = function (fromPeriodTransition = false) {
    console.log(
      `🔄 === RESETTING GAME STATE ${
        fromPeriodTransition ? "(PERIOD TRANSITION)" : "(NORMAL)"
      } ===`
    );

    // Reset all game variables
    guessedWords = [[]];
    availableSpace = 1;
    guessedWordCount = 0;
    gameId = null;
    gameComplete = false;
    gameEnabled = false;

    // Update global references
    window.gameId = null;
    window.gameComplete = false;
    window.gameEnabled = false;

    // ✅ Clear the game board during reset
    if (window.clearGameBoard) {
      window.clearGameBoard();
      console.log("🧹 Cleared game board during reset");
    }

    // ✅ IMPORTANT: During period transition, clear deposit status to require new deposit
    if (fromPeriodTransition) {
      console.log("🔄 Period transition reset - clearing deposit status");

      // Clear any localStorage related to current game
      if (window.isWalletConnected && window.isWalletConnected()) {
        const walletAddress = window.getWalletPublicKey()?.toString();
        if (walletAddress) {
          // Remove any game-related localStorage entries for current period
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('hasDepositedThisPeriod') || key.includes('gameActive'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log(`🗑️ Cleared: ${key}`);
          });
        }
      }
    }

    // ✅ Reset Play Game button to default state
    setTimeout(() => {
      const playButton = document.querySelector(".play-button");
      if (playButton) {
        const isConnected = window.isWalletConnected && window.isWalletConnected();
        if (isConnected) {
          playButton.textContent = "Play Game";
          playButton.style.opacity = "1";
          console.log("🔄 Reset Play button to 'Play Game'");
        } else {
          playButton.textContent = "Connect Wallet";
          playButton.style.opacity = "0.6";
        }
      }
    }, 100);
  };

  // ✅ UPDATED: Load existing game with better restoration logic
  async function loadExistingGame(walletAddress) {
    try {
      console.log("🔍 === LOAD EXISTING GAME DEBUG START ===");
      console.log(
        "🔄 Checking for existing game:",
        walletAddress.slice(0, 8) + "..."
      );
      console.log("🔄 Period transition state:", isPeriodTransition);
      console.log("🔄 Current window.gameId:", window.gameId);
      console.log("🔄 Current window.gameEnabled:", window.gameEnabled);
      console.log("🔄 Current window.gameComplete:", window.gameComplete);

      // ✅ UPDATED: Only block restoration during active period transitions (not just any truthy value)
      if (isPeriodTransition === true) {
        console.log("⏸️ Skipping game restoration - period transition in progress");
        return false;
      }

      console.log("🔍 Making API call to:", `${API_BASE}/current-game/${walletAddress}`);
      const response = await fetch(`${API_BASE}/current-game/${walletAddress}`);
      console.log("🔍 API response status:", response.status, response.statusText);

      const data = await response.json();
      console.log("🔍 API response data:", data);

      if (!response.ok) {
        console.error("❌ Error checking for existing game:", data.error);
        return false;
      }

      if (!data.hasActiveGame) {
        console.log("📭 No active game found - backend says no active game");
        console.log("🔍 Full backend response:", data);
        return false;
      }

      console.log("🎮 Active game found:", {
        gameId: data.gameState.gameId,
        isComplete: data.gameState.isComplete,
        guessCount: data.gameState.guesses.length,
        startTime: data.gameState.startTime,
        hasDepositedThisPeriod: data.hasDepositedThisPeriod
      });

      // ✅ CRITICAL FIX: Don't restore incomplete games without deposit for current period
      if (!data.gameState.isComplete && !data.hasDepositedThisPeriod) {
        console.log("⚠️ Found incomplete game but no deposit for current period - not restoring to active state");
        console.log("🔍 Game will remain inactive until player deposits");

        // ✅ NEW: Mark the incomplete game as processed to prevent "Game not found" errors
        if (data.gameState.gameId && !isPeriodTransition) {
          console.log("🔄 Submitting completion for abandoned incomplete game");
          try {
            await window.streakManager.submitGameCompletion(
              data.gameState.gameId,
              walletAddress,
              "abandoned_incomplete"
            );
          } catch (error) {
            console.log("⚠️ Could not submit completion for abandoned game (may already be processed):", error);
          }
        }

        // ✅ FIX: Refresh streak display since backend may have reset the streak
        if (window.streakManager && walletAddress) {
          console.log("🔄 Refreshing streak display due to potential streak reset");
          await window.streakManager.loadStreakData(walletAddress);
        }

        return false;
      }

      // ✅ UPDATED: More lenient game age check - use 6 minutes to handle period boundaries better
      const gameStartTime = new Date(data.gameState.startTime);
      const now = new Date();
      const gameAge = now - gameStartTime;
      const sixMinutes = 6 * 60 * 1000; // Give 1 extra minute buffer for period boundaries

      if (gameAge > sixMinutes) {
        console.log(`⏰ Game too old: ${Math.round(gameAge / 1000)}s (limit: 360s) - skipping restoration`);
        return false;
      }

      console.log(`✅ Game age acceptable: ${Math.round(gameAge / 1000)}s - proceeding with restoration`);

      // Restore the game state
      await restoreGameState(data.gameState);

      // ✅ Manually update play button after restoration
      setTimeout(() => {
        if (window.updatePlayButtonState) {
          window.updatePlayButtonState();
          console.log("🔄 Manually triggered play button update after restoration");
        }
      }, 500); // Increased delay to ensure restoration completes

      // ✅ IMPORTANT: Force button state update based on restoration result
      setTimeout(() => {
        const playButton = document.querySelector(".play-button");
        if (playButton) {
          if (gameComplete) {
            playButton.textContent = "Game Complete";
            playButton.style.opacity = "0.7";
            console.log("🔄 Set button to: Game Complete (after restoration)");
          } else if (gameEnabled && gameId) {
            playButton.textContent = "Game Active";
            playButton.style.opacity = "1";
            console.log("🔄 Set button to: Game Active (after restoration)");
          }
        }

        // Note: Difficulty is only applied after deposit confirmation, not on restoration
      }, 700);

      console.log("🔍 === LOAD EXISTING GAME DEBUG END ===");
      console.log("🔍 Final game state:", {
        gameId: window.gameId,
        gameEnabled: window.gameEnabled,
        gameComplete: window.gameComplete
      });
      console.log("🔍 Tiles on board:", document.querySelectorAll('.square:not(:empty)').length);

      return true;
    } catch (error) {
      console.error("❌ Error loading existing game:", error);
      console.log("🔍 === LOAD EXISTING GAME DEBUG END (ERROR) ===");
      return false;
    }
  }

  // ✅ UPDATED: Restore game state with improved handling
  async function restoreGameState(gameState) {
    // ✅ CRITICAL: Don't restore during period transitions
    if (isPeriodTransition === true) {
      console.log("⏸️ Skipping game state restoration - period transition in progress");
      return;
    }

    try {
      console.log("🔄 Restoring game state:", {
        gameId: gameState.gameId,
        guessCount: gameState.guesses.length,
        isComplete: gameState.isComplete,
        isWin: gameState.isWin,
      });

      // Set global game variables
      gameId = gameState.gameId;
      gameComplete = gameState.isComplete;
      gameEnabled = !gameState.isComplete; // Enable game only if not complete

      // Update global references
      window.gameId = gameId;
      window.gameComplete = gameComplete;
      window.gameEnabled = gameEnabled;

      console.log("🎮 Game state set:", {
        gameId: gameId,
        gameComplete: gameComplete,
        gameEnabled: gameEnabled
      });

      // ✅ IMPORTANT: Force enable the game UI if it's an incomplete game
      if (!gameState.isComplete) {
        console.log("🔧 Forcing game to be enabled for incomplete game restoration");
        if (window.enableGame) {
          window.enableGame();
          console.log("✅ enableGame() called");
        }

        // Remove any wallet-disconnected class that might disable the game
        const gameElement = document.getElementById("game");
        if (gameElement) {
          gameElement.classList.remove("wallet-disconnected");
          console.log("✅ Removed wallet-disconnected class from game element");
        }
      }

      // Always clear board for consistent restoration
      console.log("🧹 Clearing board for game restoration");
      clearGameBoard();

      // Reset arrays
      guessedWords = [];
      availableSpace = 1;
      guessedWordCount = 0;

      // Restore each guess
      console.log(`🔄 Restoring ${gameState.guesses.length} guesses...`);

      // Check if tiles exist before starting restoration
      const totalTiles = document.querySelectorAll('.square').length;
      console.log(`🔍 Found ${totalTiles} tiles on the board`);

      if (totalTiles === 0) {
        console.error("❌ No tiles found on the board! Cannot restore game state.");
        showToast("Error: Game board not ready. Please refresh and try again.", "error", 4000);
        return;
      }

      for (let i = 0; i < gameState.guesses.length; i++) {
        const guessData = gameState.guesses[i];
        const word = guessData.guess.split("");
        console.log(`  Restoring guess ${i + 1}: "${guessData.guess}" with result:`, guessData.result);

        // Add to guessed words array
        guessedWords.push(word);

        // Fill the board tiles with additional validation
        for (let j = 0; j < 5; j++) {
          const tileIndex = i * 5 + j + 1;
          const square = document.getElementById(String(tileIndex));

          if (square) {
            // Force set the content
            square.textContent = word[j].toUpperCase();
            square.innerHTML = word[j].toUpperCase(); // backup method

            // Apply the color based on result
            const result = guessData.result[j];
            const color = getTileColor(result);

            square.style.backgroundColor = color;
            square.style.borderColor = color;
            square.dataset.result = result;
            square.classList.add("guessed");

            console.log(`    ✅ Tile ${tileIndex}: "${word[j]}" -> ${result} (${color})`);

            // Update keyboard
            updateKeyboard(word[j], result);
          } else {
            console.error(`    ❌ CRITICAL: Tile ${tileIndex} not found! This will break restoration.`);
          }
        }

        guessedWordCount++;
        availableSpace = (i + 1) * 5 + 1;
      }

      // Final validation - check if tiles were actually filled
      setTimeout(() => {
        const filledTiles = document.querySelectorAll('.square:not(:empty)').length;
        console.log(`🔍 Restoration validation: ${filledTiles} tiles filled after restoration`);

        if (filledTiles === 0 && gameState.guesses.length > 0) {
          console.error("❌ RESTORATION FAILED: No tiles were filled despite having guesses!");
          showToast("⚠️ Game restoration failed. Tiles not filled correctly.", "error", 4000);
        } else if (filledTiles > 0) {
          console.log("✅ Tile restoration appears successful");
        }
      }, 100);

      console.log(`✅ Restoration complete: ${guessedWordCount} guesses restored, next available space: ${availableSpace}`);

      // Add empty array for next guess if game not complete
      if (!gameState.isComplete) {
        guessedWords.push([]);
      }

      // Note: Difficulty restrictions are only applied after deposit confirmation for new games
      // Completed games maintain their visual state as-is

      // Show appropriate message
      if (gameState.isComplete) {
        if (gameState.isWin) {
          setTimeout(() => {
            showToast("🎉 You already won this game! 🎉", "success", 4000);
          }, 1000);
        } else {
          setTimeout(() => {
            showToast(
              `💔 Game Over! The word was: ${gameState.answer}`,
              "error",
              4000
            );
          }, 1000);
        }

        // NOTE: Don't submit completion for restored games - they were already processed
        // The completion was already submitted when the game originally completed
        console.log("✅ Completed game restored - skipping duplicate completion submission");
      } else {
        const remaining = gameState.guessesRemaining;
        showToast(
          `🔄 Game restored! ${remaining} guesses remaining`,
          "info",
          3000
        );
      }
    } catch (error) {
      console.error("❌ Error restoring game state:", error);
      showToast("Error restoring game state", "error", 3000);

      // Clear corrupted state
      window.resetGameState();
      clearGameBoard();
    }
  }

  // ✅ UPDATED: Clear game board
  function clearGameBoard() {
    console.log("🧹 clearGameBoard() called - clearing all tiles");
    console.trace(); // Show call stack

    // Clear all tiles
    const squares = document.querySelectorAll(".square");
    squares.forEach((square) => {
      // Store whether this square was disabled before clearing
      const wasDisabled = square.classList.contains('disabled-square');

      square.textContent = "";
      square.style.backgroundColor = "";
      square.style.borderColor = "";
      square.style.transform = "";
      square.className = "square animate__animated";
      square.removeAttribute("data-result");

      // ✅ NEW: Restore disabled state if it was disabled before clearing
      if (wasDisabled) {
        square.classList.add('disabled-square');
        square.style.pointerEvents = 'none';

        // Restore invisible appearance
        const isLightMode = document.querySelector("html").classList.contains("switch");
        const backgroundColor = isLightMode ? 'white' : 'black';
        square.style.borderColor = backgroundColor;
        square.style.backgroundColor = backgroundColor;
        square.style.color = backgroundColor;

        console.log(`🎯 Preserved disabled state for square ${square.id}`);
      } else {
        // Reset theme-appropriate styling for enabled squares
        const isLightMode = document
          .querySelector("html")
          .classList.contains("switch");
        if (!isLightMode) {
          square.style.borderColor = "rgb(58, 58, 60)";
        } else {
          square.classList.add("switch");
          square.style.borderColor = "rgb(211, 214, 218)";
        }
      }
    });

    // Reset keyboard colors
    const keyboardButtons = document.querySelectorAll(".keyboard-row button");
    keyboardButtons.forEach((button) => {
      button.style.backgroundColor = "";
      button.style.color = "";
      button.removeAttribute("data-result");

      const isLightMode = document
        .querySelector("html")
        .classList.contains("switch");
      if (isLightMode && !button.classList.contains("switch")) {
        button.classList.add("switch");
      }
    });

    // Note: Difficulty restrictions will be applied when the next game starts
  }

  // ✅ UPDATED: Start new game with proper period transition handling
  async function startNewGame(isAutoStart = false, forceNew = false) {
    if (!window.isWalletConnected || !window.isWalletConnected()) {
      return;
    }

    try {
      const walletAddress = window.getWalletPublicKey().toString();
      console.log(
        `🚀 Starting ${forceNew ? "FORCE NEW" : "new"} game ${
          isAutoStart ? "(AUTO)" : "(MANUAL)"
        }`
      );

      // ✅ If forceNew, skip existing game check and reset everything
      if (forceNew) {
        window.resetGameState(true);
        clearGameBoard();
      } else {
        // Check for existing game only if not forcing new

        const hasExistingGame = await loadExistingGame(walletAddress);
        if (hasExistingGame) {
          return;
        }
      }

      // Show signing prompt for manual starts
      if (!isAutoStart) {
        CryptoUtils.showSigningPrompt("game start");
      }

      // Sign the start game action
      const signedData = await CryptoUtils.signStartGame(walletAddress);

      // Determine which endpoint to use
      const endpoint = forceNew ? "/force-start-game" : "/start-game";

      // Include difficulty information when starting game
      const maxGuesses = window.difficultyManager ? window.difficultyManager.getMaxGuesses() : 6;

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          signature: signedData.signature,
          timestamp: signedData.timestamp,
          maxGuesses: maxGuesses, // Send difficulty to server
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Set game state
        gameId = data.gameId;
        gameEnabled = true;
        gameComplete = false;

        // Update global references
        window.gameId = gameId;
        window.gameEnabled = true;
        window.gameComplete = false;


        // Reset game arrays
        guessedWords = [[]];
        availableSpace = 1;
        guessedWordCount = 0;

        // Clear board if forcing new or no existing state
        if (
          forceNew ||
          document.querySelectorAll(".square.guessed").length === 0
        ) {
          clearGameBoard();
        }

        // Note: Difficulty restrictions are applied via deposit system after deposit confirmation

        const message = forceNew ? "New game started!" : "Game started!";
        if (!isAutoStart) {
          showToast(message, "success", 2000);
        }

        console.log(
          `✅ ${forceNew ? "Force" : "Normal"} game started:`,
          gameId
        );
      } else {
        console.error("❌ Error starting game:", data.error);

        // Handle existing game error (but not during force new)
        if (response.status === 409 && !forceNew) {
          const hasExistingGame = await loadExistingGame(walletAddress);
          if (hasExistingGame) {
            showToast("Restored your existing game!", "info", 3000);
          } else {
            showToast(data.error, "warning", 4000);
          }
        } else if (!isAutoStart) {
          showToast(data.error, "error", 4000);
        }

        gameId = null;
        window.gameId = null;
      }
    } catch (error) {
      console.error("❌ Error starting game:", error);
      if (!isAutoStart) {
        CryptoUtils.handleSigningError(error, "game start");
      }
      gameId = null;
      window.gameId = null;
    }
  }

  // ✅ NEW: Force start new game (for period transitions and admin)
  async function forceStartNewGame(reason = "admin") {
    if (!window.isWalletConnected || !window.isWalletConnected()) {
      if (reason !== "period_transition") {
        showToast("Please connect your wallet first!", "warning");
      }
      return;
    }

    // Don't show confirmation for period transitions
    if (reason !== "period_transition") {
      const confirm = window.confirm(
        "This will abandon any existing game. Are you sure?"
      );
      if (!confirm) return;
    }

    console.log(`🚀 Force starting new game (${reason})`);

    // Use startNewGame with forceNew flag
    await startNewGame(reason === "period_transition", true); // auto-start if period transition, force new
  }

  // ✅ GAME INTERACTION FUNCTIONS
  function getCurrentWordArr() {
    return guessedWords[guessedWords.length - 1];
  }

  function updateGuessedWords(letter) {
    // Check wallet connection and game state
    if (!window.isWalletConnected || !window.isWalletConnected()) {
      return;
    }

    if (!gameEnabled || !gameId || gameComplete || isPeriodTransition) {
      return;
    }

    // ✅ NEW: Check if we're trying to use a disabled square
    if (window.difficultyManager && !window.difficultyManager.isSquareUsable(availableSpace)) {
      console.warn("🎯 Attempted to use disabled square:", availableSpace);
      return;
    }

    const currentWordArr = getCurrentWordArr();
    if (currentWordArr.length < 5) {
      currentWordArr.push(letter);
      const square = document.getElementById(String(availableSpace));

      if (square && !square.classList.contains('disabled-square')) {
        square.textContent = letter;

        // Theme-aware border color for typing
        const isLightMode = document
          .querySelector("html")
          .classList.contains("switch");
        const typingBorderColor = "rgb(135, 138, 140)";
        square.style.borderColor = typingBorderColor;

        square.style.transform = "scale(1.1)";
        setTimeout(() => (square.style.transform = "scale(1)"), 100);
        availableSpace++;
      }
    }
  }

  function deleteLetter() {
    // Check wallet connection and game state
    if (!window.isWalletConnected || !window.isWalletConnected()) {
      return;
    }

    if (gameComplete || !gameEnabled || !gameId || isPeriodTransition) {
      return;
    }

    const currentWordArr = getCurrentWordArr();
    if (currentWordArr.length > 0) {
      currentWordArr.pop();
      availableSpace--;
      const square = document.getElementById(String(availableSpace));

      if (square) {
        square.textContent = "";

        // Reset to theme-appropriate default border
        const isLightMode = document
          .querySelector("html")
          .classList.contains("switch");
        const defaultBorderColor = isLightMode
          ? "rgb(211, 214, 218)"
          : "rgb(58, 58, 60)";
        square.style.borderColor = defaultBorderColor;
      }
    }
  }

  function getTileColor(result) {
    const isLightMode = document
      .querySelector("html")
      .classList.contains("switch");

    switch (result) {
      case "correct":
        return isLightMode ? "rgb(106, 170, 100)" : "rgb(83, 141, 78)";
      case "present":
        return isLightMode ? "rgb(201, 180, 88)" : "rgb(181, 159, 59)";
      case "absent":
        return isLightMode ? "rgb(120, 124, 126)" : "rgb(58, 58, 60)";
      default:
        return isLightMode ? "rgb(120, 124, 126)" : "rgb(58, 58, 60)";
    }
  }

  // Make getTileColor globally accessible for theme switching
  window.getTileColor = getTileColor;

  function updateKeyboard(letter, result) {
    const keyButton = document.querySelector(`button[data-key="${letter}"]`);
    if (!keyButton) return;

    const currentColor = keyButton.style.backgroundColor;
    const newColor = getTileColor(result);

    // Don't downgrade from correct (green) to anything else
    if (
      currentColor === "rgb(83, 141, 78)" ||
      currentColor === "rgb(106, 170, 100)"
    )
      return;

    // Don't downgrade from present (yellow) to absent (gray)
    if (
      (currentColor === "rgb(181, 159, 59)" ||
        currentColor === "rgb(201, 180, 88)") &&
      result === "absent"
    )
      return;

    keyButton.style.backgroundColor = newColor;
    keyButton.style.color = "white";

    // Store the result for theme switching
    keyButton.dataset.result = result;

    keyButton.classList.add("animate__animated", "animate__pulse");
    setTimeout(
      () => keyButton.classList.remove("animate__animated", "animate__pulse"),
      500
    );
  }

  function shakeCurrentRow() {
    const currentRowStart = guessedWordCount * 5 + 1;
    const currentWordArr = getCurrentWordArr();

    // Shake each tile in the current row
    currentWordArr.forEach((_, index) => {
      const square = document.getElementById(currentRowStart + index);
      if (square) {
        square.classList.add("animate__animated", "animate__shakeX");

        // Remove animation classes after animation completes
        setTimeout(() => {
          square.classList.remove("animate__animated", "animate__shakeX");
        }, 600);
      }
    });
  }

  // ✅ UPDATED: Submit word with better error handling
  async function handleSubmitWord() {
    // ✅ NEW: Check if we're in the final 3 seconds before period reset
    if (window.isInSubmissionDangerWindow && window.isInSubmissionDangerWindow()) {
      showToast("⏰ Too close to reset! Wait for new word!", "warning", 3000);
      console.log("🚫 Submit blocked - too close to period reset (≤3 seconds)");
      return;
    }

    // Check wallet connection and game state
    if (!window.isWalletConnected || !window.isWalletConnected()) {
      showToast("Please connect your wallet to play!", "warning");
      return;
    }

    if (gameComplete || !gameEnabled || !gameId || isPeriodTransition) {
      console.log("Submit blocked - game state:", {
        gameComplete,
        gameEnabled,
        gameId: !!gameId,
        isPeriodTransition,
      });
      return;
    }

    const currentWordArr = getCurrentWordArr();
    if (currentWordArr.length !== 5) {
      shakeCurrentRow();
      setTimeout(() => showToast("Word must be 5 letters!", "error"), 650);
      return;
    }

    const currentWord = currentWordArr.join("");

    try {
      const walletAddress = window.getWalletPublicKey().toString();

      // Sign the guess

      const signedData = await CryptoUtils.signGuess(gameId, currentWord);

      const requestBody = {
        gameId,
        guess: currentWord,
        walletAddress,
        signature: signedData.signature,
        timestamp: signedData.timestamp,
      };

      const response = await fetch(`${API_BASE}/guess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("❌ Non-JSON response received");
        const textResponse = await response.text();
        console.error("❌ Response text:", textResponse);
        shakeCurrentRow();
        setTimeout(
          () => showToast("Server error - invalid response", "error"),
          650
        );
        return;
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error("❌ Failed to parse JSON response:", parseError);
        shakeCurrentRow();
        setTimeout(
          () => showToast("Server response parsing error", "error"),
          650
        );
        return;
      }

      if (!response.ok) {
        console.error("❌ API error:", data.error);
        shakeCurrentRow();
        setTimeout(
          () => showToast(data.error || "Invalid guess", "error"),
          650
        );
        return;
      }

      // ✅ Validate result data
      if (
        !data.result ||
        !Array.isArray(data.result) ||
        data.result.length !== 5
      ) {
        console.error("❌ Invalid result format:", data.result);
        shakeCurrentRow();
        setTimeout(
          () => showToast("Invalid server response format", "error"),
          650
        );
        return;
      }

      const validResults = ["correct", "present", "absent"];
      const invalidResults = data.result.filter(
        (item) => !validResults.includes(item)
      );
      if (invalidResults.length > 0) {
        console.error("❌ Invalid result values:", invalidResults);
        shakeCurrentRow();
        setTimeout(
          () =>
            showToast(
              `Invalid result values: ${invalidResults.join(", ")}`,
              "error"
            ),
          650
        );
        return;
      }

      // ✅ Process the valid result
      const firstLetterId = guessedWordCount * 5 + 1;
      const flipInterval = 200;

      // Animate tiles
      currentWordArr.forEach((letter, index) => {
        setTimeout(() => {
          const tileColor = getTileColor(data.result[index]);
          const square = document.getElementById(firstLetterId + index);

          if (square) {
            square.classList.add("animate__animated", "animate__flipInX");
            square.style.backgroundColor = tileColor;
            square.style.borderColor = tileColor;
            square.dataset.result = data.result[index];
            square.classList.add("guessed");
            updateKeyboard(letter, data.result[index]);
          }
        }, flipInterval * index);
      });

      guessedWordCount++;

      // Handle win condition
      if (data.isWin) {
        gameComplete = true;
        window.gameComplete = true;

        // ✅ NEW: Set pending delayed application for row reduction on next timer reset
        if (window.difficultyManager) {
          window.difficultyManager.pendingDelayedApplication = true;
          window.difficultyManager.saveDifficultyState();
          console.log("🎯 Win detected - marked for delayed row reduction on next timer reset");
        }

        // ✅ Submit game completion for manual wins (not timer expiration)
        if (gameId && walletAddress && window.streakManager && !isPeriodTransition) {
          console.log("🔍 STREAK RESET SOURCE 4: Win handler in main.js (manual win)");
          await window.streakManager.submitGameCompletion(
            gameId,
            walletAddress,
            "game_won" // Add context for server
          );
        }

        setTimeout(() => {
          // Victory animations
          currentWordArr.forEach((_, i) => {
            setTimeout(() => {
              const square = document.getElementById(firstLetterId + i);
              if (square) {
                square.classList.remove("animate__flipInX");
                square.classList.add("animate__animated", "animate__bounce");
                setTimeout(
                  () =>
                    square.classList.remove(
                      "animate__animated",
                      "animate__bounce"
                    ),
                  1000
                );
              }
            }, i * 100);
          });

          // Keyboard celebration
          const keyboardKeys = Array.from(keys);
          keyboardKeys.forEach((keyButton, index) => {
            setTimeout(() => {
              keyButton.classList.add("animate__animated", "animate__bounce");
              setTimeout(
                () =>
                  keyButton.classList.remove(
                    "animate__animated",
                    "animate__bounce"
                  ),
                500
              );
            }, 500 + index * 50);
          });

          setTimeout(() => {
            keyboardContainer.classList.add(
              "animate__animated",
              "animate__bounce"
            );
            setTimeout(
              () =>
                keyboardContainer.classList.remove(
                  "animate__animated",
                  "animate__bounce"
                ),
              1000
            );
          }, 500 + keyboardKeys.length * 50 + 200);

          setTimeout(
            () => showToast("🎉 Congratulations! You won! 🎉", "success", 4000),
            1200
          );
        }, flipInterval * 5 + 300);
        return;
      }

      // ✅ NEW: Check if we've reached the row limit based on difficulty
      const maxGuesses = window.difficultyManager ? window.difficultyManager.getMaxGuesses() : 6;
      if (guessedWordCount >= maxGuesses && !data.isWin) {
        gameComplete = true;
        window.gameComplete = true;

        // ✅ Clear pending delayed application flag so countdown knows this is a loss
        if (window.difficultyManager) {
          window.difficultyManager.pendingDelayedApplication = false;
          console.log("🎯 Cleared pendingDelayedApplication for row limit loss - countdown will reset to 6 rows");
        }

        // Note: Difficulty will be reset when countdown/clock resets, not immediately

        // ✅ IMMEDIATELY update streak counter in footer to 0
        const streakCounter = document.querySelector(".steak-counter");
        if (streakCounter) {
          streakCounter.textContent = "0";
          console.log("✅ Immediately updated footer streak counter to 0");
        }

        // Show immediate streak reset notification
        if (window.showToast) {
          setTimeout(() => {
            showToast("💔 Streak reset!", "warning", 4000);
            console.log("🎯 Immediate streak reset toast for row limit reached");
          }, 1700);
        }

        // Submit game completion for difficulty-based game over
        if (gameId && walletAddress && window.streakManager && !isPeriodTransition) {
          console.log("🔍 STREAK RESET SOURCE 6: Difficulty limit reached in main.js");

          // ✅ Prevent duplicate toast by marking that we already showed one
          window.lastStreakResetToastTime = Date.now();

          await window.streakManager.submitGameCompletion(
            gameId,
            walletAddress,
            "row_limit_reached" // Add context for server
          );
        }

        // Show game over toast - we need to get the word from somewhere
        setTimeout(
          () =>
            showToast(
              `Game over! The word was: ${data.answer ? data.answer.toUpperCase() : 'UNKNOWN'}`,
              "error",
              4000
            ),
          1700
        );
        return;
      }

      // Handle game over condition
      if (data.isGameOver) {
        gameComplete = true;
        window.gameComplete = true;

        // ✅ Clear pending delayed application flag so countdown knows this is a loss
        if (window.difficultyManager) {
          window.difficultyManager.pendingDelayedApplication = false;
          console.log("🎯 Cleared pendingDelayedApplication for loss - countdown will reset to 6 rows");
        }

        // Note: Difficulty will be reset when countdown/clock resets, not immediately

        // ✅ IMMEDIATELY update streak counter in footer to 0
        const streakCounter = document.querySelector(".steak-counter");
        if (streakCounter) {
          streakCounter.textContent = "0";
          console.log("✅ Immediately updated footer streak counter to 0 (regular game over)");
        }

        // ✅ Show immediate streak reset notification
        if (window.showToast) {
          setTimeout(() => {
            showToast("💔 Streak reset!", "warning", 4000);
            console.log("🎯 Immediate streak reset toast for regular game over");
          }, 1200); // Show before the game over message
        }

        // ✅ Submit game completion for manual losses (not timer expiration)
        if (gameId && walletAddress && window.streakManager && !isPeriodTransition) {
          console.log("🔍 STREAK RESET SOURCE 5: Game over handler in main.js (manual loss)");

          // ✅ Prevent duplicate toast by marking that we already showed one
          window.lastStreakResetToastTime = Date.now();

          await window.streakManager.submitGameCompletion(
            gameId,
            walletAddress,
            "incorrect_guess" // Add context for server
          );
        }

        setTimeout(
          () =>
            showToast(
              `Game over! The word was: ${data.answer.toUpperCase()}`,
              "error",
              4000
            ),
          1700
        );
        return;
      }

      // Continue to next guess
      guessedWords.push([]);
    } catch (error) {
      console.error("❌ Error submitting guess:", error);

      if (error.message && error.message.includes("User rejected")) {
        showToast("Guess cancelled by user", "warning", 3000);
      } else if (
        error.name === "TypeError" &&
        error.message.includes("fetch")
      ) {
        shakeCurrentRow();
        setTimeout(
          () => showToast("Network error. Check your connection.", "error"),
          650
        );
      } else if (error.name === "SyntaxError") {
        shakeCurrentRow();
        setTimeout(
          () => showToast("Server response error. Please try again.", "error"),
          650
        );
      } else {
        shakeCurrentRow();
        setTimeout(
          () => showToast("Could not submit guess. Please try again.", "error"),
          650
        );
      }
    }
  }

  // ✅ UPDATED: Handle key input with proper state checks
  function handleKeyInput(key) {
    // Use the helper function to check if we should accept input
    if (!shouldAcceptGameInput()) {
      return;
    }

    if (key === "enter") handleSubmitWord();
    else if (key === "del" || key === "backspace") deleteLetter();
    else if (key.match(/^[a-z]$/)) updateGuessedWords(key);
  }

  function createSquares() {
    const board = document.getElementById("board");
    for (let i = 0; i < 30; i++) {
      const square = document.createElement("div");
      square.classList.add("square", "animate__animated");
      square.setAttribute("id", i + 1);
      board.appendChild(square);
    }
  }

  // ✅ EVENT LISTENERS
  keys.forEach(
    (key) =>
      (key.onclick = ({ target }) => {
        if (!window.isWalletConnected || !window.isWalletConnected()) {
          return;
        }

        // Check if game is paused before processing input
        if (window.gamePauseHandler && window.gamePauseHandler.shouldBlockAction()) {
          window.gamePauseHandler.showPauseNotification("Game is paused - input blocked");
          return;
        }

        handleKeyInput(target.getAttribute("data-key"));
        target.blur();
      })
  );

  document.addEventListener("keydown", (event) => {
    // ✅ FIX: Don't capture keyboard input if user is typing in an input field
    const activeElement = document.activeElement;
    const isTypingInInput =
      activeElement &&
      (activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.contentEditable === "true" ||
        activeElement.isContentEditable);

    // ✅ FIX: Don't capture if modal or overlay is open
    const isModalOpen =
      document.querySelector(".leaderboard-modal.show") ||
      document.querySelector("#wallet-gate-overlay[style*='flex']") ||
      document.querySelector(".streak-modal") ||
      document.querySelector("#game-pause-overlay.active");

    // ✅ FIX: Skip game keyboard handling if typing in input or modal is open
    if (isTypingInInput || isModalOpen) {
      console.log(
        "⏭️ Skipping game keyboard - user typing in input or modal open"
      );
      return;
    }

    // ✅ Check wallet connection and game state
    if (!window.isWalletConnected || !window.isWalletConnected()) {
      return;
    }

    const key = event.key.toLowerCase();
    if (["enter", "backspace"].includes(key) || key.match(/^[a-z]$/)) {
      event.preventDefault();
    }

    if (key === "enter") handleKeyInput("enter");
    else if (key === "backspace") handleKeyInput("del");
    else if (key.match(/^[a-z]$/)) handleKeyInput(key);
  });

  function shouldAcceptGameInput() {
    // Check if user is typing in an input field
    const activeElement = document.activeElement;
    const isTypingInInput =
      activeElement &&
      (activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.contentEditable === "true" ||
        activeElement.isContentEditable);

    // Check if any modal is open
    const isModalOpen =
      document.querySelector(".leaderboard-modal.show") ||
      document.querySelector("#wallet-gate-overlay[style*='flex']") ||
      document.querySelector(".streak-modal") ||
      document.querySelector("#game-pause-overlay.active");

    // Check if game is paused via pause handler
    const isGamePaused = window.gamePauseHandler && window.gamePauseHandler.isGamePaused();

    // Check game state
    const gameReady =
      window.isWalletConnected &&
      window.isWalletConnected() &&
      window.gameEnabled &&
      window.gameId &&
      !window.gameComplete &&
      !window.isPeriodTransition;

    return gameReady && !isTypingInInput && !isModalOpen && !isGamePaused;
  }

  // ✅ MAKE FUNCTIONS GLOBALLY AVAILABLE
  window.startNewGame = startNewGame;
  window.loadExistingGame = loadExistingGame;
  window.restoreGameState = restoreGameState;
  window.clearGameBoard = clearGameBoard;
  window.forceStartNewGame = forceStartNewGame;

  // ✅ DEBUG FUNCTIONS
  window.debugGame = {
    getCurrentState() {
      return {
        gameId,
        gameComplete,
        gameEnabled,
        isPeriodTransition,
        guessedWordCount,
        currentGuesses: guessedWords,
        availableSpace,
        walletConnected: window.isWalletConnected
          ? window.isWalletConnected()
          : false,
      };
    },

    async testPeriodTransition() {
      // Set period transition flag
      window.setPeriodTransition(true);

      // Reset game state
      window.resetGameState(true);

      // Try to start new game
      if (window.isWalletConnected && window.isWalletConnected()) {
        await startNewGame(true, true); // auto-start + force new
      }

      // Clear flag after delay
      setTimeout(() => {
        window.setPeriodTransition(false);
      }, 3000);

      showToast("Period transition test completed", "success", 3000);
    },

    async forceReset() {
      window.resetGameState(true);
      clearGameBoard();
      showToast("Game force reset", "info", 2000);
    },

    async testRestoration() {
      if (!window.isWalletConnected || !window.isWalletConnected()) {
        console.error("❌ Wallet not connected");
        return;
      }

      const walletAddress = window.getWalletPublicKey().toString();

      // Clear period transition to allow restoration
      window.setPeriodTransition(false);

      const hasGame = await loadExistingGame(walletAddress);

      return hasGame;
    },
  };

  console.log("  window.debugGame.getCurrentState() - Check current state");
  console.log(
    "  window.debugGame.testPeriodTransition() - Test period transition"
  );
  console.log("  window.debugGame.forceReset() - Force reset everything");
  console.log("  window.debugGame.testRestoration() - Test game restoration");
});

// ✅ ANIMATION UTILITY
function animateCSS(element, animation, prefix = "animate__") {
  return new Promise((resolve, reject) => {
    const animationName = `${prefix}${animation}`;
    element.classList.add(`${prefix}animated`, animationName);

    function handleAnimationEnd(event) {
      event.stopPropagation();
      element.classList.remove(`${prefix}animated`, animationName);
      resolve("Animation ended");
    }

    element.addEventListener("animationend", handleAnimationEnd, {
      once: true,
    });
  });
}

// ✅ ADD THE BURN BUTTON INTEGRATION HERE (between animateCSS and console.log)
function setupBurnButtonIntegration() {
  // Find the burn button (targets the outer header-right-button div)
  const burnButton = document
    .querySelector(".header-right-burn")
    ?.closest(".header-right-button");

  if (!burnButton) {
    // Fallback: try finding by index (3rd button should be burn)
    const headerButtons = document.querySelectorAll(".header-right-button");
    if (headerButtons.length >= 3) {
      const foundButton = headerButtons[2]; // 0=rules, 1=leaderboard, 2=burn

      setupBurnButtonClick(foundButton);
      return;
    }
    console.error("❌ Could not find burn button for integration");
    return;
  }

  setupBurnButtonClick(burnButton);
}

function setupBurnButtonClick(burnButton) {
  // Remove any existing event listeners by cloning
  const newButton = burnButton.cloneNode(true);
  burnButton.parentNode.replaceChild(newButton, burnButton);

  // Add click event listener
  newButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (window.burnStatsManager) {
      window.burnStatsManager.open();
    } else if (window.openBurnModal) {
      window.openBurnModal();
    } else {
      console.warn("⚠️ Burn modal not available yet, trying again...");
      if (window.showToast) {
        showToast("Loading burn stats...", "info", 2000);
      }
      setTimeout(() => {
        if (window.burnStatsManager) {
          window.burnStatsManager.open();
        } else if (window.showToast) {
          showToast("Burn stats not available", "warning", 3000);
        }
      }, 1000);
    }
  });

  // Add visual feedback
  newButton.style.cursor = "pointer";
  newButton.title = "View Burn Statistics & Creator Fees";
}

// Call the setup function after other components load
document.addEventListener("DOMContentLoaded", () => {
  // Wait for the main game setup to complete
  setTimeout(() => {
    setupBurnButtonIntegration();
  }, 1500);
});
