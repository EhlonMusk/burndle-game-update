// ============================== FIXED WALLET.JS WITH PROPER GAME INTEGRATION ==============================

let isWalletConnected = false;
let walletPublicKey = null;
let playerSocket = null;

document.addEventListener("DOMContentLoaded", () => {
  console.log(
    "🚀 Wallet.js loaded - initializing with proper game integration"
  );

  // Add some debugging
  console.log("🔍 Looking for connect button...");
  const connectButton = setupConnectButton();
  if (connectButton) {
    console.log("✅ Connect button found and set up");
    initializeWallet();
  } else {
    console.error("❌ Connect button not found! Available buttons:",
      Array.from(document.querySelectorAll('button')).map(b => ({
        class: b.className,
        text: b.textContent.trim()
      }))
    );
  }

  createWalletGate();
  updateGameState();

  // ✅ Initialize WebSocket after short delay (non-blocking)
  setTimeout(() => {
    initializePlayerWebSocket();
  }, 1000);

  // ✅ Check wallet state periodically in case we missed the connection
  setInterval(() => {
    if (!isWalletConnected && window.solana && window.solana.isConnected && window.solana.publicKey) {
      console.log("🔧 Detected wallet connection that wasn't registered, fixing...");
      handleWalletConnected(window.solana.publicKey);
    }
  }, 2000);
});

// ✅ WEBSOCKET INITIALIZATION (Optional, non-blocking)
function initializePlayerWebSocket() {
  try {
    if (typeof io !== "undefined") {
      connectPlayerWebSocket();
    } else {
      console.log(
        "📡 Socket.io not available - game will work without WebSocket"
      );
    }
  } catch (error) {
    console.warn(
      "⚠️ WebSocket initialization failed (game continues to work):",
      error
    );
  }
}

function connectPlayerWebSocket() {
  try {
    if (typeof io === "undefined") {
      console.warn("⚠️ Socket.io not available");
      return;
    }

    // 🚨 IMPORTANT: Make playerSocket global
    window.playerSocket = io('http://localhost:3000');
    window.socket = window.playerSocket; // Alias for compatibility

    window.playerSocket.on("connect", () => {
      console.log("✅ Socket.io connected");

      // 🚨 IMPORTANT: Notify pause handler
      if (window.gamePauseHandler) {
        setTimeout(() => {
          window.gamePauseHandler.findWebSocketConnection();
        }, 100);
      }

      if (window.updateWebSocketStatus) {
        window.updateWebSocketStatus("connected", "🟢 Connected");
      }
      if (isWalletConnected && walletPublicKey) {
        window.playerSocket.emit("player-connect", {
          walletAddress: walletPublicKey.toString(),
        });
      }
    });

    window.playerSocket.on("disconnect", () => {
      if (window.updateWebSocketStatus) {
        window.updateWebSocketStatus("disconnected", "🔴 Disconnected");
      }
    });

    window.playerSocket.on("connect_error", (error) => {
      console.warn("⚠️ Socket.io connection error (game continues):", error);
      if (window.updateWebSocketStatus) {
        window.updateWebSocketStatus("disconnected", "🔴 Error");
      }
    });

    // ✅ NEW: Handle period transition events
    window.playerSocket.on("period-transition", (data) => {
      console.log("🔄 WEBSOCKET: Received period transition event:", data);
      console.log("🔍 WEBSOCKET: period-transition handler is executing");

      // ✅ ENHANCED: Force streak update and check for inactive reset
      if (window.isWalletConnected && window.isWalletConnected() && window.streakManager) {
        const walletAddress = window.getWalletPublicKey()?.toString();
        if (walletAddress) {
          console.log("🔍 PERIOD TRANSITION - Wallet connected, checking streak status");
          console.log("🔍 PERIOD TRANSITION - Wallet address:", walletAddress.slice(0, 8) + "...");

          // Store current streak before reload
          const previousStreak = window.currentStreakData?.currentStreak || 0;
          console.log("🔍 PERIOD TRANSITION - Previous streak was:", previousStreak);

          // Force reload streak data with multiple attempts
          const checkStreakReset = async () => {
            try {
              console.log("🔍 PERIOD TRANSITION - Calling loadStreakData...");
              await window.streakManager.loadStreakData(walletAddress);

              const newStreak = window.currentStreakData?.currentStreak || 0;
              console.log("🔍 PERIOD TRANSITION - New streak is:", newStreak);

              // Check if streak was reset from >0 to 0
              if (previousStreak > 0 && newStreak === 0) {
                console.log("🔍 PERIOD TRANSITION - DETECTED STREAK RESET! Previous:", previousStreak, "New:", newStreak);

                const now = Date.now();
                const lastNotification = window.lastStreakResetToastTime || 0;
                const timeSinceLastNotification = now - lastNotification;

                console.log("🔍 PERIOD TRANSITION - Time since last notification:", timeSinceLastNotification);

                // ✅ FIXED: Check if the player actually didn't complete the word before showing negative message
                if (timeSinceLastNotification > 10000) { // Reduced to 10 seconds
                  console.log("🔍 PERIOD TRANSITION - CHECKING INCOMPLETE STREAK RESET NOTIFICATIONS");

                  // Check if player won in the previous period
                  try {
                    const walletAddress = window.getWalletPublicKey()?.toString();
                    if (walletAddress) {
                      const response = await fetch(`/api/check-previous-period-win/${walletAddress}`);
                      if (response.ok) {
                        const winData = await response.json();

                        if (winData.wonPreviousPeriod) {
                          console.log("🔍 PERIOD TRANSITION - Player won previous period, showing neutral streak reset only");

                          if (window.showToast) {
                            setTimeout(() => {
                              showToast("💔 Streak reset!", "warning", 4000);
                            }, 1200);
                            // Skip the "didn't complete" message for winners
                          }
                          window.lastStreakResetToastTime = now;
                          return;
                        }
                      }
                    }
                  } catch (error) {
                    console.log("🔍 PERIOD TRANSITION - Could not check win status:", error);
                  }

                  console.log("🔍 PERIOD TRANSITION - SHOWING INACTIVE STREAK RESET NOTIFICATIONS");

                  if (window.showToast) {
                    // Show "💔 Streak reset!" at 1.2s
                    setTimeout(() => {
                      console.log("🔍 PERIOD TRANSITION - SHOWING STREAK RESET TOAST NOW");
                      showToast("💔 Streak reset!", "warning", 4000);
                    }, 1200);

                    // ✅ FIXED: Only show "didn't complete" for actual incomplete games
                    setTimeout(() => {
                      console.log("🔍 PERIOD TRANSITION - SHOWING INCOMPLETE WORD TOAST NOW");
                      showToast("You didn't complete the word!", "error", 4000);
                    }, 1700);

                    window.lastStreakResetToastTime = now;
                  } else {
                    console.log("❌ PERIOD TRANSITION - window.showToast not available");
                  }
                } else {
                  console.log("🔍 PERIOD TRANSITION - Skipping notifications due to recent display");
                }
              } else {
                console.log("🔍 PERIOD TRANSITION - No streak reset detected");
              }

            } catch (error) {
              console.error("❌ PERIOD TRANSITION - Error checking streak:", error);
            }
          };

          // Try multiple times with delays
          setTimeout(checkStreakReset, 500);
          setTimeout(checkStreakReset, 1500);
          setTimeout(checkStreakReset, 3000);
        } else {
          console.log("❌ PERIOD TRANSITION - No wallet address available");
        }
      } else {
        console.log("❌ PERIOD TRANSITION - Wallet not connected or streak manager not available");
      }

      // Reset game state
      if (window.resetGameState) {
        window.resetGameState(true); // true = fromPeriodTransition
      }

      // Update play button state immediately
      if (window.updatePlayButtonState) {
        setTimeout(() => {
          window.updatePlayButtonState();
        }, 100);
      }

      // ✅ IMMEDIATE: Force refresh streak display regardless
      if (window.streakManager && window.isWalletConnected && window.isWalletConnected()) {
        const walletAddress = window.getWalletPublicKey()?.toString();
        if (walletAddress) {
          console.log("🔄 PERIOD TRANSITION - IMMEDIATE STREAK REFRESH");
          window.streakManager.loadStreakData(walletAddress);
        }
      }

      // Toast notification removed per user request

      console.log("✅ Period transition handled on frontend");
    });

    // 🚨 ADD: Listen for pause events
    window.playerSocket.on("game_paused", (data) => {
      if (window.gamePauseHandler) {
        window.gamePauseHandler.handleGamePaused(data);
      }
    });

    window.playerSocket.on("game_resumed", (data) => {
      if (window.gamePauseHandler) {
        window.gamePauseHandler.handleGameResumed(data);
      }
    });

    window.playerSocket.on("game_reset", (data) => {
      if (window.gamePauseHandler) {
        window.gamePauseHandler.handleGameReset(data);
      }

      // ✅ NEW: Instantly update footer streaks after game reset
      if (window.streakManager && window.isWalletConnected && window.isWalletConnected()) {
        const walletAddress = window.getWalletPublicKey()?.toString();
        if (walletAddress) {
          console.log("🔄 GAME RESET - Instantly refreshing footer streaks");
          setTimeout(() => {
            window.streakManager.loadStreakData(walletAddress);
          }, 1000); // Small delay to let backend complete reset
        }
      }
    });

    // ✅ NEW: Listen for difficulty reset events
    window.playerSocket.on("difficulty-reset", (data) => {
      console.log("🎯 Received difficulty-reset event:", data);

      if (window.difficultyManager) {
        window.difficultyManager.resetDifficulty();
        console.log("🎯 Difficulty reset to 6 rows via WebSocket");
      }

      // ✅ NEW: Instantly update footer streaks after reset
      if (window.streakManager && window.isWalletConnected && window.isWalletConnected()) {
        const walletAddress = window.getWalletPublicKey()?.toString();
        if (walletAddress) {
          console.log("🔄 DIFFICULTY RESET - Instantly refreshing footer streaks");
          window.streakManager.loadStreakData(walletAddress);
        }
      }
    });

    // Optional: Handle real-time notifications
    window.playerSocket.on("streak-reset-notification", (data) => {
      console.log("🔍 STREAK RESET SOURCE 3: Websocket streak-reset-notification", data);
      console.log("🔍 DEBUGGING INACTIVE PLAYER - Event received with reason:", data.reason);
      console.log("🔍 DEBUGGING INACTIVE PLAYER - Full data object:", JSON.stringify(data, null, 2));

      if (data.reason === "inactive_player_streak_reset") {
        console.log("🔍 INACTIVE PLAYER - Processing inactive player streak reset");

        // ✅ FIXED: Check if player actually completed the word before showing negative message
        if (window.showToast) {
          console.log("🔍 INACTIVE PLAYER - showToast available, checking win status");

          // Check if player won in the previous period
          (async () => {
            try {
              const walletAddress = window.getWalletPublicKey()?.toString();
              if (walletAddress) {
                const response = await fetch(`/api/check-previous-period-win/${walletAddress}`);
                if (response.ok) {
                  const winData = await response.json();

                  if (winData.wonPreviousPeriod) {
                    console.log("🔍 INACTIVE PLAYER - Player won previous period, showing neutral message only");

                    // Show only streak reset message for winners
                    setTimeout(() => {
                      showToast("💔 Streak reset!", "warning", 4000);
                    }, 1200);

                    window.lastStreakResetToastTime = Date.now();
                    return;
                  }
                }
              }
            } catch (error) {
              console.log("🔍 INACTIVE PLAYER - Could not check win status:", error);
            }

            // Show full notifications for actual non-completers
            console.log("🔍 INACTIVE PLAYER - Setting up timers for incomplete game notifications");

            // Show "💔 Streak reset!" at 1.2s
            setTimeout(() => {
              console.log("🔍 INACTIVE PLAYER - EXECUTING STREAK RESET TOAST NOW");
              showToast("💔 Streak reset!", "warning", 4000);
            }, 1200);

            // ✅ FIXED: Only show "didn't complete" for actual incomplete games
            setTimeout(() => {
              console.log("🔍 INACTIVE PLAYER - EXECUTING INCOMPLETE WORD TOAST NOW");
              showToast("You didn't complete the word!", "error", 4000);
            }, 1700);

            window.lastStreakResetToastTime = Date.now();
          })();
        } else {
          console.log("❌ INACTIVE PLAYER - showToast not available");
        }

        // Update streak display immediately to 0
        if (window.streakManager) {
          console.log("🔍 INACTIVE PLAYER - Updating streak display");

          // Force reload streak data from backend to ensure accuracy
          const walletAddress = window.getWalletPublicKey()?.toString();
          if (walletAddress) {
            console.log("🔄 INACTIVE PLAYER - Reloading streak data from backend");
            window.streakManager.loadStreakData(walletAddress);
          }

          // Also update local cache immediately as fallback
          if (window.currentStreakData) {
            console.log("🔍 INACTIVE PLAYER - Updating local currentStreakData to 0");
            window.currentStreakData.currentStreak = 0;
          }
          window.streakManager.updateStreakDisplay();
        } else {
          console.log("❌ INACTIVE PLAYER - streakManager not available");
        }
      } else {
        console.log("🔍 INACTIVE PLAYER - Different reason, using default handler");
        // Handle other types of streak reset notifications
        if (window.showToast) {
          showToast(`💔 ${data.message}`, "warning", 6000);
          window.lastStreakResetToastTime = Date.now();
        }
      }
    });

    // ✅ NEW: Handle leaderboard updates
    window.playerSocket.on("leaderboard-update", (data) => {
      console.log("📊 Received leaderboard update:", data);

      // Refresh leaderboard data if it's currently open
      if (window.leaderboardManager && window.leaderboardManager.isOpen) {
        console.log("🔄 Refreshing leaderboard due to update");
        window.leaderboardManager.loadLeaderboard();
      }
    });

    // ✅ FIX: Handle admin streak reset leaderboard updates
    window.playerSocket.on("leaderboard-updated", (data) => {
      console.log("📊 Received leaderboard updated (admin reset):", data);

      // Refresh leaderboard data if it's currently open
      if (window.leaderboardManager && window.leaderboardManager.isOpen) {
        console.log("🔄 Refreshing leaderboard due to admin reset");
        window.leaderboardManager.loadLeaderboard();
      }

      // ✅ Also refresh if leaderboard manager exists (for cached data)
      if (window.leaderboardManager) {
        window.leaderboardManager.loadLeaderboardData();
      }
    });

    // ✅ NEW: Handle streak reset from period transition
    window.playerSocket.on("streak-reset", (data) => {
      console.log("💔 Received streak reset:", data);

      if (data.reason === "incomplete_game_period_transition") {
        // Update streak display immediately
        if (window.streakManager) {
          // Set streak to 0 immediately
          if (window.currentStreakData) {
            window.currentStreakData.currentStreak = 0;
          }
          window.streakManager.updateStreakDisplay();
        }

        // ✅ REMOVED: Streak reset toast - streak manager handles this for all players consistently
        // ✅ REMOVED: Don't set lastStreakResetToastTime here - let countdown timer handle it

        // ✅ REMOVED: Game over toast - countdown timer handles this for all players consistently

        // Update play button state
        if (window.updatePlayButtonState) {
          setTimeout(() => {
            window.updatePlayButtonState();
          }, 500);
        }
      }
    });

    // ✅ NEW: Listen for token return notifications
    window.playerSocket.on("tokenReturned", (data) => {
      console.log("🎉 Received tokenReturned event:", data);

      // Check if this return is for the current player
      if (window.isWalletConnected && window.isWalletConnected()) {
        const currentWallet = window.getWalletPublicKey();
        if (currentWallet && currentWallet.toString() === data.walletAddress) {
          console.log("✅ Tokens returned for current player, showing success modal");

          // Show the return success modal
          if (window.showReturnSuccessModal) {
            window.showReturnSuccessModal();
          }

          // Refresh BURN token balance after successful return
          if (window.updateSOLBalance) {
            console.log("🔄 Refreshing BURN token balance after return");
            setTimeout(() => {
              window.updateSOLBalance();
            }, 1000); // 1 second delay to allow blockchain to update
          }
        }
      }
    });

    // ✅ NEW: Listen for token burn notifications
    window.playerSocket.on("tokenBurned", (data) => {
      console.log("🔥 Received tokenBurned event:", data);
      // Check if this burn is for the current player
      if (window.isWalletConnected && window.isWalletConnected()) {
        const currentWallet = window.getWalletPublicKey();
        if (currentWallet && currentWallet.toString() === data.walletAddress) {
          console.log("✅ Tokens burned for current player, showing burn modal");
          // Show the burn success modal
          if (window.showBurnSuccessModal) {
            window.showBurnSuccessModal();
          }

          // Refresh BURN token balance after successful burn
          if (window.updateSOLBalance) {
            console.log("🔄 Refreshing BURN token balance after burn");
            setTimeout(() => {
              window.updateSOLBalance();
            }, 1000); // 1 second delay to allow blockchain to update
          }
        }
      }
    });

  } catch (error) {
    console.warn(
      "⚠️ Socket.io setup failed (game will work without it):",
      error
    );
  }
}

// ✅ WALLET GATE UI
function createWalletGate() {
  const overlay = document.createElement("div");
  overlay.className = "wallet-gate-overlay";
  overlay.id = "wallet-gate-overlay";

  overlay.innerHTML = `
    <div class="nyt-modal">
      <div class="nyt-modal-header">
        <div class="burndle-logo"></div>
        <h2 class="nyt-modal-title">BURNdle</h2>
        <p class="nyt-modal-subtitle">Guess 5-letter words and win Creator Fees.</p>
      </div>
      <div class="nyt-modal-content">
        <div class="nyt-button-container">
          <button class="nyt-button nyt-button-primary" onclick="handleConnectClick()">
            Connect
          </button>
          <button class="nyt-button nyt-button-secondary" onclick="hideWalletGate()">
            Close
          </button>
        </div>
        <p class="nyt-modal-text">Connect your wallet and deposit 0.01 SOL to play.</p>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
}

// ✅ GAME STATE UPDATE (Core functionality)
function updateGameState() {
  const gameElement = document.getElementById("game");
  const overlay = document.getElementById("wallet-gate-overlay");

  console.log(
    `🎮 Updating game state - Wallet connected: ${isWalletConnected}`,
    `Game element:`, !!gameElement,
    `Overlay element:`, !!overlay
  );

  if (isWalletConnected) {
    // Remove disabled styling
    gameElement.classList.remove("wallet-disconnected");
    if (overlay) overlay.style.display = "none";

    // Enable game
    if (window.enableGame) {
      window.enableGame();
    }
  } else {
    gameElement.classList.add("wallet-disconnected");
    if (overlay) overlay.style.display = "flex";

    if (window.disableGame) {
      window.disableGame();
    }
  }
}

// ✅ BUTTON SETUP
function setupConnectButton() {
  const connectButton =
    document.querySelector(".connect-button") ||
    document.querySelector("button.connect-wallet") ||
    document.querySelector(".connect-wallet") ||
    document.querySelector(".connect-btn") ||
    document.querySelector("header button");

  if (!connectButton) {
    console.error("❌ Connect button not found");
    return null;
  }

  connectButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    handleConnectClick();
  });

  return connectButton;
}

// ✅ WALLET INITIALIZATION
async function initializeWallet() {
  const isDisconnected = localStorage.getItem("walletDisconnected") === "true";

  if (isDisconnected) {
    console.log("🚫 Wallet previously disconnected, skipping auto-connect");
    return;
  }

  if (!window.solana || !window.solana.isPhantom) {
    updateConnectButton("Install Phantom");
    return;
  }

  try {
    console.log("🔄 Attempting trusted wallet connection...");
    const response = await window.solana.connect({ onlyIfTrusted: true });
    if (response.publicKey) {
      console.log("🎯 Trusted connection successful:", response.publicKey.toString());
      handleWalletConnected(response.publicKey);
    } else {
      console.log("ℹ️ No trusted connection available");
    }
  } catch (error) {
    console.log("ℹ️ No trusted connection:", error.message);
  }

  // Also check if wallet is already connected
  if (window.solana.isConnected && window.solana.publicKey) {
    console.log("🔍 Wallet already connected:", window.solana.publicKey.toString());
    handleWalletConnected(window.solana.publicKey);
  }
}

// ✅ CONNECT/DISCONNECT HANDLERS
async function handleConnectClick() {
  if (!isWalletConnected) {
    await connectWallet();
    if (isWalletConnected) {
      const overlay = document.getElementById("wallet-gate-overlay");
      if (overlay) overlay.style.display = "none";
      updateGameState();
    }
  } else {
    const shouldDisconnect = confirm("Disconnect wallet?");
    if (shouldDisconnect) {
      await disconnectWallet();
    }
  }
}

async function connectWallet() {
  try {
    if (!window.solana || !window.solana.isPhantom) {
      showToast(
        "Phantom wallet not detected. Please install Phantom wallet.",
        "error",
        3000
      );
      window.open("https://phantom.app/", "_blank");
      return;
    }

    const response = await window.solana.connect();

    handleWalletConnected(response.publicKey);
  } catch (error) {
    if (error.code === 4001) {
    } else {
      console.error("❌ Error connecting to wallet:", error);
      showToast("Failed to connect wallet. Please try again.", "error");
    }
  }
}

async function disconnectWallet() {
  try {
    await window.solana.disconnect();
    handleWalletDisconnected();
  } catch (error) {
    console.error("❌ Error disconnecting wallet:", error);
  }
}

// ✅ ENHANCED: Wallet connected handler with proper game integration
async function handleWalletConnected(publicKey) {
  const walletAddress = publicKey.toString();
  console.log("🔗 handleWalletConnected called with:", walletAddress);

  // Prevent duplicate calls
  console.log("🔍 Checking for duplicates - isWalletConnected:", isWalletConnected, "walletPublicKey:", walletPublicKey?.toString());
  if (isWalletConnected && walletPublicKey && walletPublicKey.toString() === walletAddress) {
    console.log("ℹ️ Wallet already connected with this address, skipping");
    return;
  }
  console.log("✅ No duplicate detected, proceeding with connection...");

  // Update connection state
  console.log("📝 Setting isWalletConnected = true...");
  isWalletConnected = true;
  walletPublicKey = publicKey;
  console.log("✅ Wallet state updated - isConnected:", isWalletConnected);
  console.log("✅ Wallet publicKey:", walletPublicKey?.toString());

  // Store wallet info
  console.log("💾 Storing wallet info in localStorage...");
  localStorage.setItem("lastWalletAddress", walletAddress);
  localStorage.removeItem("walletDisconnected");
  localStorage.setItem(`wasConnected_${walletAddress}`, "true");

  // Update UI
  console.log("🔄 Updating UI...");
  const truncatedKey = `${walletAddress.slice(0, 4)}...${walletAddress.slice(
    -4
  )}`;
  updateConnectButton(truncatedKey);

  // Show toast if function exists
  if (typeof showToast === 'function') {
    showToast("Wallet connected successfully!", "success");
  } else {
    console.warn("⚠️ showToast function not available");
  }

  // Update game state immediately
  console.log("🎮 Calling updateGameState...");
  updateGameState();

  // ✅ Update SOL balance
  console.log("💰 Updating SOL balance...");
  updateSOLBalance();

  // ✅ IMPORTANT: Dispatch wallet-connected event for other components
  console.log("📡 Dispatching wallet-connected event...");
  window.dispatchEvent(new CustomEvent('wallet-connected', {
    detail: {
      publicKey: walletAddress,
      walletPublicKey: publicKey
    }
  }));

  // ✅ WAIT FOR MAIN.JS TO BE READY, THEN HANDLE GAME STATE
  setTimeout(async () => {
    await handleGameStateAfterConnect(walletAddress);
  }, 1500); // Give main.js time to load

  // ✅ Optional: Register with WebSocket (non-blocking)
  if (playerSocket && playerSocket.connected) {
    playerSocket.emit("player-connect", { walletAddress });
  }

  // ✅ IMMEDIATE: Load streak data right away (no delay) to prevent display reset on hard refresh
  setTimeout(async () => {
    await loadStreakDataSafely(walletAddress);
  }, 100); // Changed from 2000ms to 100ms
}

// ✅ NEW: Handle game state after wallet connection
async function handleGameStateAfterConnect(walletAddress) {
  try {
    console.log("🔍 === WALLET RESTORATION DEBUG START ===");
    console.log("🔍 Wallet address:", walletAddress.slice(0, 8) + "...");
    console.log("🔍 Current game state before restoration:", {
      gameId: window.gameId,
      gameEnabled: window.gameEnabled,
      gameComplete: window.gameComplete
    });

    // ✅ NEW: Don't restore games immediately after period transitions
    if (window.isPeriodTransition) {
      console.log("🔄 Period transition in progress - skipping game restoration to prevent incomplete game reactivation");
      // Period transition toast removed per user request
      return;
    }

    // Wait for main.js functions to be available
    let attempts = 0;
    while (!window.loadExistingGame && attempts < 30) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    if (!window.loadExistingGame) {
      console.warn("⚠️ Main.js functions not available, using fallback");
      showToast("🎮 Click 'Play Game' to start! 👆", "info", 4000);
      return;
    }

    console.log("🔍 About to call window.loadExistingGame...");
    const hasExistingGame = await window.loadExistingGame(walletAddress);
    console.log("🔍 loadExistingGame returned:", hasExistingGame);
    console.log("🔍 Game state immediately after loadExistingGame:", {
      gameId: window.gameId,
      gameEnabled: window.gameEnabled,
      gameComplete: window.gameComplete
    });

    if (!hasExistingGame) {
      // Don't auto-start games anymore - require deposit via Play button
      console.log("🎮 No existing game, user needs to click Play and deposit");
      showToast("🎮 Click 'Play Game' to deposit and start! 👆", "info", 4000);
    } else {
      console.log("🎮 Existing game found and restored");

      // Check the restored game state
      setTimeout(() => {
        console.log("🔍 After restoration - Game state:", {
          gameId: window.gameId,
          gameComplete: window.gameComplete,
          gameEnabled: window.gameEnabled
        });

        // Check if tiles were actually filled
        const filledTiles = document.querySelectorAll('.square:not(:empty)');
        console.log("🔍 Filled tiles after restoration:", filledTiles.length);

        if (filledTiles.length === 0 && !window.gameComplete) {
          console.warn("⚠️ No tiles were filled during restoration - this is the reported issue!");
          console.log("🔧 Attempting to manually trigger restoration again...");

          // Try to force restoration again
          setTimeout(async () => {
            try {
              await window.loadExistingGame(walletAddress);
              console.log("🔄 Second restoration attempt completed");
            } catch (error) {
              console.error("❌ Second restoration attempt failed:", error);
            }
          }, 1000);
        }
      }, 500);

      if (window.gameComplete) {
        showToast("Game completed! Your results are displayed.", "success", 4000);
      } else {
        showToast("Game restored!", "info", 3000);
      }
    }
  } catch (error) {
    console.error("❌ Error handling game state after connect:", error);
    showToast("🎮 Click 'Play Game' to start! 👆", "info", 4000);
  }
}

// ✅ NEW: Safely load streak data without blocking game
async function loadStreakDataSafely(walletAddress) {
  try {
    if (!window.streakManager) {
      return;
    }

    await window.streakManager.loadStreakData(walletAddress);

    // Handle streak notifications
    const lastKnownStreak =
      parseInt(localStorage.getItem(`lastKnownStreak_${walletAddress}`)) || 0;
    const wasConnectedBefore =
      localStorage.getItem(`wasConnected_${walletAddress}`) === "true";
    const currentStreak = window.currentStreakData
      ? window.currentStreakData.currentStreak
      : 0;

    if (
      wasConnectedBefore &&
      lastKnownStreak > 0 &&
      currentStreak < lastKnownStreak
    ) {
      setTimeout(() => {
        if (currentStreak === 0) {
          showToast(
            `💔 Your ${lastKnownStreak}-game streak was reset while you were away!`,
            "warning",
            5000
          );
        } else {
          showToast(
            `⚠️ Your streak decreased from ${lastKnownStreak} to ${currentStreak} while away!`,
            "warning",
            4000
          );
        }
      }, 3000); // Delay to avoid conflicts with game messages
    } else if (
      wasConnectedBefore &&
      currentStreak > 0 &&
      currentStreak === lastKnownStreak
    ) {
      setTimeout(() => {
        showToast(
          `🔥 Welcome back! Your ${currentStreak}-game streak is still active!`,
          "success",
          3000
        );
      }, 3000);
    }

    localStorage.setItem(
      `lastKnownStreak_${walletAddress}`,
      currentStreak.toString()
    );
  } catch (error) {
    console.warn("⚠️ Error loading streak data (game continues):", error);
  }
}

// ✅ WALLET DISCONNECTED HANDLER
function handleWalletDisconnected() {
  // Save current streak if available
  if (walletPublicKey && window.currentStreakData) {
    const walletAddress = walletPublicKey.toString();
    const currentStreak = window.currentStreakData.currentStreak;
    localStorage.setItem(
      `lastKnownStreak_${walletAddress}`,
      currentStreak.toString()
    );
  }

  // Clear wallet state
  isWalletConnected = false;
  walletPublicKey = null;
  updateConnectButton("Connect");

  // Clear BURN token balance
  updateSOLBalanceDisplay("0");

  showToast("Wallet disconnected", "warning");
  localStorage.setItem("walletDisconnected", "true");

  // Optional: Disconnect WebSocket
  if (playerSocket && playerSocket.connected) {
    try {
      playerSocket.emit("player-disconnect");
    } catch (error) {
      console.warn("WebSocket disconnect failed:", error);
    }
  }

  // ✅ IMPORTANT: Dispatch wallet-disconnected event for other components
  console.log("📡 Dispatching wallet-disconnected event...");
  window.dispatchEvent(new CustomEvent('wallet-disconnected', {
    detail: {
      previousPublicKey: walletPublicKey?.toString() || null
    }
  }));

  // Update game state
  updateGameState();
}

// ✅ UI HELPER FUNCTIONS
function updateConnectButton(text) {
  const connectButton =
    document.querySelector(".connect-button") ||
    document.querySelector("button.connect-wallet") ||
    document.querySelector(".connect-wallet") ||
    document.querySelector(".connect-btn") ||
    document.querySelector("header button");

  if (connectButton) {
    connectButton.textContent = text;
  }
}

// ✅ WALLET EVENT LISTENERS
if (window.solana) {
  window.solana.on("connect", (publicKey) => {
    console.log("📡 Wallet connected event:", publicKey.toString());
    handleWalletConnected(publicKey);
  });

  window.solana.on("disconnect", () => {
    handleWalletDisconnected();
  });
}

// ✅ CLEANUP ON PAGE UNLOAD
window.addEventListener("beforeunload", () => {
  if (playerSocket && playerSocket.connected) {
    try {
      playerSocket.disconnect();
    } catch (error) {
      // Silent fail
    }
  }
});

// ✅ GLOBAL FUNCTIONS
window.getWalletInfo = () => ({
  isConnected: isWalletConnected,
  publicKey: walletPublicKey?.toString() || null,
});

window.isWalletConnected = () => isWalletConnected;
window.getWalletPublicKey = () => walletPublicKey;
window.handleConnectClick = handleConnectClick;
window.handleWalletConnected = handleWalletConnected;

// Debug function to test handleWalletConnected
window.testHandleWalletConnected = () => {
  console.log("🧪 Testing handleWalletConnected function...");
  console.log("Function exists:", typeof handleWalletConnected);
  console.log("Function content:", handleWalletConnected.toString().substring(0, 100));

  if (window.solana && window.solana.publicKey) {
    console.log("🧪 Calling handleWalletConnected directly...");
    try {
      handleWalletConnected(window.solana.publicKey);
      console.log("🧪 Function call completed");
    } catch (error) {
      console.error("🧪 Error calling function:", error);
    }
  }
};

// Debug function to clear all game state
window.clearGameState = () => {
  console.log("🧹 Clearing all game state...");

  // Clear localStorage game data
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('game') || key.includes('Game') || key.includes('streak'))) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => {
    console.log("🗑️ Removing:", key);
    localStorage.removeItem(key);
  });

  // Reset game state if functions available
  if (window.resetGameState) {
    console.log("🔄 Calling resetGameState...");
    window.resetGameState();
  }

  if (window.disableGame) {
    console.log("🚫 Calling disableGame...");
    window.disableGame();
  }

  console.log("✅ Game state cleared, refresh page to test");
};

// Debug function to force clear game from backend
window.forceEndGame = async () => {
  if (!window.isWalletConnected()) {
    console.log("❌ Wallet not connected");
    return;
  }

  const walletAddress = window.getWalletPublicKey().toString();
  console.log("🔚 Force ending game for wallet:", walletAddress);

  try {
    // Try to end/reset the game via backend
    const response = await fetch('http://localhost:3000/api/admin/force-end-game', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress: walletAddress
      })
    });

    if (response.ok) {
      console.log("✅ Game ended via backend");
    } else {
      console.log("⚠️ Backend endpoint not available, trying local reset...");
    }
  } catch (error) {
    console.log("⚠️ Could not reach backend, trying local reset...");
  }

  // Also try local game reset functions
  if (window.forceEndCurrentGame) {
    console.log("🔚 Calling forceEndCurrentGame...");
    await window.forceEndCurrentGame();
  }

  if (window.resetGameState) {
    console.log("🔄 Calling resetGameState...");
    window.resetGameState();
  }

  console.log("✅ Game force ended, refresh to test");
};

// Debug function to manually sync wallet state
window.forceWalletSync = () => {
  console.log("🔍 Checking wallet connection state...");
  console.log("window.solana exists:", !!window.solana);
  console.log("window.solana.isConnected:", window.solana?.isConnected);
  console.log("window.solana.publicKey:", window.solana?.publicKey?.toString());
  console.log("handleWalletConnected function:", typeof handleWalletConnected);

  if (window.solana && window.solana.isConnected && window.solana.publicKey) {
    console.log("🔧 Force syncing wallet state...");
    try {
      handleWalletConnected(window.solana.publicKey);
      console.log("🔧 handleWalletConnected call completed");
      return true;
    } catch (error) {
      console.error("🔧 Error in handleWalletConnected:", error);
      return false;
    }
  } else {
    console.log("❌ No wallet connection found to sync");
    return false;
  }
};

window.hideWalletGate = () => {
  const overlay = document.getElementById("wallet-gate-overlay");
  if (overlay) overlay.style.display = "none";

  if (!isWalletConnected) {
    const gameElement = document.getElementById("game");
    if (gameElement) gameElement.classList.add("wallet-disconnected");
    if (window.disableGame) window.disableGame();
  }
};

// ✅ DEBUG FUNCTIONS
window.debugWallet = {
  getConnectionInfo() {
    return {
      isWalletConnected,
      walletPublicKey: walletPublicKey?.toString(),
      hasSocket: !!playerSocket,
      socketConnected: playerSocket?.connected || false,
      gameEnabled: window.gameEnabled || false,
      gameId: window.gameId || null,
      localStorage: {
        lastWalletAddress: localStorage.getItem("lastWalletAddress"),
        walletDisconnected: localStorage.getItem("walletDisconnected"),
      },
    };
  },

  async testGameIntegration() {
    if (!isWalletConnected) {
      console.error("❌ Wallet not connected");
      return false;
    }

    const walletAddress = walletPublicKey.toString();

    try {
      // Test main.js functions availability
      const functions = {
        loadExistingGame: !!window.loadExistingGame,
        startNewGame: !!window.startNewGame,
        resetGameState: !!window.resetGameState,
        enableGame: !!window.enableGame,
        disableGame: !!window.disableGame,
      };

      // Test game state
      const gameState = window.debugGame
        ? window.debugGame.getCurrentState()
        : null;

      // Test restoration
      if (window.loadExistingGame) {
        const hasGame = await window.loadExistingGame(walletAddress);
        console.log(
          `${hasGame ? "✅" : "ℹ️"} Game restoration result:`,
          hasGame
        );
      }

      return {
        success: true,
        functions,
        gameState,
        walletAddress,
      };
    } catch (error) {
      console.error("❌ Integration test failed:", error);
      return { success: false, error: error.message };
    }
  },

  async forceNewGame() {
    if (!isWalletConnected) {
      console.error("❌ Wallet not connected");
      return;
    }

    try {
      if (window.forceStartNewGame) {
        await window.forceStartNewGame("debug");
        showToast("Force new game started!", "success", 3000);
      } else if (window.startNewGame) {
        await window.startNewGame(false, true); // manual, force new
        showToast("New game started!", "success", 3000);
      } else {
        console.error("❌ No game start functions available");
        showToast("Game functions not available", "error", 3000);
      }
    } catch (error) {
      console.error("❌ Force new game failed:", error);
      showToast("Failed to start new game", "error", 3000);
    }
  },

  simulateDisconnect() {
    handleWalletDisconnected();
  },

  async simulateReconnect() {
    if (isWalletConnected) {
      return;
    }

    try {
      await connectWallet();
    } catch (error) {
      console.error("❌ Simulated reconnect failed:", error);
    }
  },
};

console.log("  window.debugWallet.getConnectionInfo() - Check wallet state");
console.log(
  "  window.debugWallet.testGameIntegration() - Test wallet-game integration"
);
console.log("  window.debugWallet.forceNewGame() - Force start new game");
console.log("  window.debugWallet.simulateDisconnect() - Test disconnect");
console.log("  window.debugWallet.simulateReconnect() - Test reconnect");

// ✅ BURN TOKEN BALANCE FUNCTIONALITY
const BURN_TOKEN_ADDRESS = "D1jpDVeZSbAKKfscWZfE5FVrpfyrCGk3aPDz9Jdsm1r4";
let solBalanceInterval = null;

/**
 * Update SOL balance display
 */
function updateSOLBalanceDisplay(balance) {
  const balanceElement = document.getElementById("sol-balance-display");
  if (balanceElement) {
    // Format BURN tokens with commas for readability
    const formattedBalance = parseInt(balance).toLocaleString();
    balanceElement.textContent = formattedBalance;
  }
}

/**
 * Get SOL balance for connected wallet
 */
async function getSOLBalance() {
  if (!isWalletConnected || !walletPublicKey) {
    return 0;
  }

  try {
    // Create connection to Solana RPC (devnet for testing)
    const connection = new solanaWeb3.Connection(
      solanaWeb3.clusterApiUrl('devnet'),
      'confirmed'
    );

    const tokenAddress = new solanaWeb3.PublicKey(BURN_TOKEN_ADDRESS);

    try {
      // Calculate the associated token account address
      const TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const ASSOCIATED_TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

      const [associatedTokenAccount] = await solanaWeb3.PublicKey.findProgramAddress(
        [
          walletPublicKey.toBuffer(),
          TOKEN_PROGRAM_ID.toBuffer(),
          tokenAddress.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const accountInfo = await connection.getAccountInfo(associatedTokenAccount);

      if (!accountInfo) {
        // Account doesn't exist, balance is 0
        return 0;
      }

      // Parse token account data (simplified)
      const data = accountInfo.data;
      if (data.length >= 72) {
        // Read 8 bytes starting at offset 64 as little-endian
        let amount = 0;
        for (let i = 0; i < 8; i++) {
          amount += data[64 + i] * Math.pow(256, i);
        }

        // Convert from smallest unit (considering 9 decimals)
        const balance = amount / Math.pow(10, 9);
        return balance;
      }

      return 0;
    } catch (error) {
      // Token account doesn't exist or has no balance
      console.log("BURN token account not found or error accessing it:", error.message);
      return 0;
    }
  } catch (error) {
    console.warn("⚠️ Error fetching BURN token balance:", error);
    return 0;
  }
}

/**
 * Update SOL balance and display
 */
async function updateSOLBalance() {
  try {
    const balance = await getSOLBalance();
    updateSOLBalanceDisplay(balance);
    console.log(`🔥 BURN Token Balance updated: ${balance.toLocaleString()} BURN`);
  } catch (error) {
    console.warn("⚠️ Error updating BURN token balance:", error);
    updateSOLBalanceDisplay("Error");
  }
}

/**
 * Start periodic SOL balance checking
 */
function startSOLBalanceMonitoring() {
  // Clear any existing interval
  if (solBalanceInterval) {
    clearInterval(solBalanceInterval);
  }

  // Update balance every 10 seconds when wallet is connected
  if (isWalletConnected) {
    solBalanceInterval = setInterval(() => {
      if (isWalletConnected) {
        updateSOLBalance();
      } else {
        stopSOLBalanceMonitoring();
      }
    }, 10000); // 10 seconds
  }
}

/**
 * Stop SOL balance monitoring
 */
function stopSOLBalanceMonitoring() {
  if (solBalanceInterval) {
    clearInterval(solBalanceInterval);
    solBalanceInterval = null;
  }
}

// Listen for wallet connection events to start/stop balance monitoring
window.addEventListener('wallet-connected', () => {
  startSOLBalanceMonitoring();
});

// Make functions available globally for debugging
window.updateSOLBalance = updateSOLBalance;
window.getSOLBalance = getSOLBalance;
