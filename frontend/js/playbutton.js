// ============================== PLAY GAME BUTTON FIX ==============================
// Add this to your main.js or create a separate file

document.addEventListener("DOMContentLoaded", () => {
  // Wait for other scripts to load
  setTimeout(() => {
    setupPlayButton();
  }, 1000);
});

function setupPlayButton() {
  const playButton = document.querySelector(".play-button");

  if (!playButton) {
    console.error("❌ Play button not found");
    return;
  }

  // ✅ Update button state on page load
  updatePlayButtonState();

  playButton.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Check wallet connection
    if (!window.isWalletConnected || !window.isWalletConnected()) {
      showToast("Please connect your wallet first!", "warning", 3000);

      // Show wallet gate
      const overlay = document.getElementById("wallet-gate-overlay");
      if (overlay) {
        overlay.style.display = "flex";
      }
      return;
    }

    // Check if deposit system is available
    if (!window.depositSystem || !window.depositSystem.isInitialized()) {
      console.error("❌ Deposit system not available");
      showToast(
        "Deposit system not ready yet, please wait...",
        "warning",
        3000
      );
      return;
    }

    try {
      // Check if there's already an active game
      const walletAddress = window.getWalletPublicKey().toString();

      // ✅ FIX: If game is already complete, don't allow new actions
      if (window.gameComplete && window.gameId) {
        showToast("Game completed! Wait for next word.", "info", 4000);
        return;
      }

      // First try to load existing game (only if not already complete)
      if (window.loadExistingGame) {
        const hasExistingGame = await window.loadExistingGame(walletAddress);

        if (hasExistingGame) {
          // Check if the restored game is complete
          if (window.gameComplete) {
            showToast(
              "Game completed! Wait for next word or check your results.",
              "info",
              4000
            );
          } else {
            showToast("Existing game loaded!", "info", 3000);
          }
          return;
        }
      }

      // If we reach here, no existing game was found, so we need a new game

      // Check if player has already deposited for current period
      const hasDeposited = await window.depositSystem.hasDeposited(
        window.getWalletPublicKey()
      );

      if (hasDeposited) {
        // Player has deposited for this period, start game directly
        console.log(
          "💰 Player has deposited for this period, starting game directly"
        );
        if (window.startNewGame) {
          await window.startNewGame(false, false);
        } else {
          showToast(
            "Game functions not ready yet, please wait...",
            "warning",
            3000
          );
        }
      } else {
        // Player needs to deposit for this period, show deposit modal
        console.log(
          "💰 Player needs to deposit for this period, showing deposit modal"
        );
        window.depositSystem.showModal();
      }
    } catch (error) {
      console.error("❌ Error with Play Game button:", error);

      if (
        error.message &&
        error.message.includes("already have an active game")
      ) {
        showToast("You already have a game in progress!", "warning", 3000);
      } else {
        showToast("Error starting game. Please try again.", "error", 3000);
      }
    }
  });

  // Update button state based on wallet connection and backend status
  async function updatePlayButtonState() {
    const isConnected = window.isWalletConnected && window.isWalletConnected();

    if (!isConnected) {
      playButton.textContent = "Connect Wallet";
      playButton.style.opacity = "0.6";
      console.log("🔄 Set button to: Connect Wallet");
      return;
    }

    // ✅ IMPORTANT: Check local frontend state first (prioritize restored games)
    const localGameId = window.gameId;
    const localGameEnabled = window.gameEnabled;
    const localGameComplete = window.gameComplete;

    // If we have a locally restored active game, respect that state
    if (localGameId && localGameEnabled && !localGameComplete) {
      playButton.textContent = "Game Active";
      playButton.style.opacity = "1";
      return;
    }

    // If we have a locally restored completed game, respect that state
    if (localGameId && localGameComplete) {
      playButton.textContent = "Game Complete";
      playButton.style.opacity = "0.7";
      console.log(
        "🔄 Set button to: Game Complete (local restored game takes priority)"
      );
      return;
    }

    try {
      // Only check backend if no local game state exists
      const walletAddress = window.getWalletPublicKey().toString();
      const API_BASE = "http://localhost:3000/api";
      const response = await fetch(`${API_BASE}/game-status/${walletAddress}`);

      if (response.ok) {
        const data = await response.json();
        const status = data.data;

        if (status.hasActiveGame && !status.isComplete) {
          playButton.textContent = "Game Active";
          playButton.style.opacity = "1";
          console.log("🔄 Set button to: Game Active (from backend)");
        } else if (status.hasPlayedToday) {
          playButton.textContent = "Game Complete";
          playButton.style.opacity = "0.7";
          console.log("🔄 Set button to: Game Complete (from backend)");
        } else if (!status.hasDepositedThisPeriod) {
          playButton.textContent = "Play Game";
          playButton.style.opacity = "1";
        } else {
          playButton.textContent = "Play Game";
          playButton.style.opacity = "1";
          console.log("🔄 Set button to: Play Game - Ready (from backend)");
        }
      } else {
        // Fallback to Play Game if backend fails and no local state
        playButton.textContent = "Play Game";
        playButton.style.opacity = "1";
        console.log(
          "🔄 Set button to: Play Game (backend failed, no local state)"
        );
      }
    } catch (error) {
      console.warn("🔄 Error checking backend status, using fallback:", error);

      // Fallback to Play Game if error and no local state
      playButton.textContent = "Play Game";
      playButton.style.opacity = "1";
      console.log("🔄 Set button to: Play Game (error fallback)");
    }
  }

  // Update button state periodically (with delay to allow game loading)
  setTimeout(() => {
    updatePlayButtonState(); // Initial update after delay
    setInterval(updatePlayButtonState, 1000);
  }, 2000); // Wait 2 seconds for game state to load
}

// Make functions globally available
window.setupPlayButton = setupPlayButton;
window.updatePlayButtonState = async () => {
  const playButton = document.querySelector(".play-button");
  if (!playButton) return;

  const isConnected = window.isWalletConnected && window.isWalletConnected();

  if (!isConnected) {
    playButton.textContent = "Connect Wallet";
    playButton.style.opacity = "0.6";
    return;
  }

  // ✅ IMPORTANT: Check local frontend state first (prioritize restored games)
  const localGameId = window.gameId;
  const localGameEnabled = window.gameEnabled;
  const localGameComplete = window.gameComplete;

  // If we have a locally restored active game, respect that state
  if (localGameId && localGameEnabled && !localGameComplete) {
    playButton.textContent = "Game Active";
    playButton.style.opacity = "1";
    console.log(
      "🔄 Manual: Set button to Game Active (local restored game takes priority)"
    );
    return;
  }

  // If we have a locally restored completed game, respect that state
  if (localGameId && localGameComplete) {
    playButton.textContent = "Game Complete";
    playButton.style.opacity = "0.7";
    console.log(
      "🔄 Manual: Set button to Game Complete (local restored game takes priority)"
    );
    return;
  }

  try {
    // Only check backend if no local game state exists
    const walletAddress = window.getWalletPublicKey().toString();
    const API_BASE = "http://localhost:3000/api";
    const response = await fetch(`${API_BASE}/game-status/${walletAddress}`);

    if (response.ok) {
      const data = await response.json();
      const status = data.data;

      console.log("🔄 Manual backend game status (no local game):", status);

      if (status.hasActiveGame && !status.isComplete) {
        playButton.textContent = "Game Active";
        playButton.style.opacity = "1";
      } else if (status.hasPlayedToday) {
        playButton.textContent = "Game Complete";
        playButton.style.opacity = "0.7";
      } else if (!status.hasDepositedThisPeriod) {
        playButton.textContent = "Play Game";
        playButton.style.opacity = "1";
      } else {
        playButton.textContent = "Play Game";
        playButton.style.opacity = "1";
      }
    } else {
      // Fallback to Play Game if backend fails and no local state
      playButton.textContent = "Play Game";
      playButton.style.opacity = "1";
      console.log(
        "🔄 Manual: Set button to Play Game (backend failed, no local state)"
      );
    }
  } catch (error) {
    console.warn("🔄 Manual update error, using fallback:", error);

    // Fallback to Play Game if error and no local state
    playButton.textContent = "Play Game";
    playButton.style.opacity = "1";
    console.log("🔄 Manual: Set button to Play Game (error fallback)");
  }
};
