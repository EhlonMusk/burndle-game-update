// Streak tracking frontend functionality

let currentStreakData = null;

class StreakManager {
  constructor() {
    this.API_BASE = "http://localhost:3000/api";
    this.currentStreakData = null; // Make accessible from instance

    // Initialize click handler when DOM is ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        this.initializeStreakClickHandler();
      });
    } else {
      this.initializeStreakClickHandler();
    }
  }

  /**
   * Initialize streak click handler for footer
   */
  initializeStreakClickHandler() {
    const streakContainer = document.querySelector(".streak-container");
    if (streakContainer) {
      streakContainer.style.cursor = "pointer";
      streakContainer.onclick = () => this.showStreakStats();
    }
  }

  /**
   * Load streak data when wallet connects
   * @param {string} walletAddress - Wallet address
   */
  async loadStreakData(walletAddress) {
    if (!walletAddress) {
      console.warn("⚠️ loadStreakData called without wallet address");
      return;
    }

    console.log("🔄 Loading streak data for:", walletAddress.slice(0, 8) + "...");

    try {
      const response = await fetch(`${this.API_BASE}/streak/${walletAddress}`);
      const data = await response.json();

      console.log("📊 Streak data response:", data);

      if (data.success) {
        currentStreakData = data.data;
        this.currentStreakData = data.data; // Also update instance variable
        console.log("✅ Updated currentStreakData:", currentStreakData);
        this.updateStreakDisplay();
      } else {
        console.error("❌ Streak data loading failed:", data.error);
      }
    } catch (error) {
      console.error("Error loading streak data:", error);
    }
  }

  /**
   * Update streak display in footer
   */
  updateStreakDisplay() {
    console.log("🔄 updateStreakDisplay called with data:", currentStreakData);

    if (!currentStreakData) {
      console.warn("⚠️ No currentStreakData available for display update");
      return;
    }

    // Find the footer streak counter (current streak)
    const streakCounter = document.querySelector(".steak-counter");
    console.log("🔍 Found current streak counter element:", streakCounter);

    if (streakCounter) {
      // Update the footer current streak counter
      streakCounter.textContent = currentStreakData.currentStreak;
      console.log("✅ Updated footer current streak to:", currentStreakData.currentStreak);
    } else {
      console.error("❌ Could not find .steak-counter element");
    }

    // Find the footer highest streak counter (previously prize)
    const prizeCounter = document.querySelector(".prize-count");
    console.log("🔍 Found highest streak counter element:", prizeCounter);

    if (prizeCounter) {
      // Update the footer highest streak counter
      prizeCounter.textContent = currentStreakData.maxStreak || 0;
      console.log("✅ Updated footer highest streak to:", currentStreakData.maxStreak);
    } else {
      console.error("❌ Could not find .prize-count element");
    }

    // ✅ NEW: Update difficulty calculation based on current streak
    if (window.difficultyManager) {
      window.difficultyManager.handleStreakUpdate(currentStreakData);
      console.log("🎯 Difficulty calculation updated - visual restrictions preserved until next deposit/game start");
    }
  }

  /**
   * Submit game completion (called automatically when game ends)
   * @param {string} gameId - Game ID
   * @param {string} walletAddress - Wallet address
   * @param {string} completionReason - Optional reason for completion
   */
  async submitGameCompletion(gameId, walletAddress, completionReason = null) {
    if (!gameId || !walletAddress) return;

    try {
      const requestBody = {
        gameId,
        walletAddress,
      };

      // Add completion reason if provided
      if (completionReason) {
        requestBody.completionReason = completionReason;
        console.log(`🎯 Submitting game completion with reason: ${completionReason}`);
      }

      const response = await fetch(`${this.API_BASE}/game-complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        currentStreakData = data.data;
        this.updateStreakDisplay();

        // Show streak message with appropriate delay based on type
        const isManualLoss = data.message && (data.message.includes("Game over") || data.message.includes("loss"));
        const isIncompleteGame = data.message && (data.message.includes("Incomplete game") || data.message.includes("Game not found"));
        const delayTime = (isManualLoss || isIncompleteGame) ? 1200 : 2000; // 1.2s for losses/incomplete, 2s for wins

        setTimeout(() => {
          console.log("🔍 DEBUGGING STREAK RESET - Message received:", data.message);
          console.log("🔍 DEBUGGING WIN DETECTION - Full data object:", data);

          const isWin = data.message.includes("Congratulations") || data.message.includes("won") || data.message.includes("victory") || data.message.includes("success");
          const isStreakReset = data.message.includes("Streak reset") || data.message.includes("Game over");
          const isIncompleteGame = data.message.includes("Incomplete game processed") || data.message.includes("Incomplete game handled");

          console.log("🔍 DEBUGGING STREAK RESET - Condition checks:", {
            messageReceived: data.message,
            messageContainsWin: isWin,
            messageContainsStreakReset: data.message.includes("Streak reset"),
            messageContainsGameOver: data.message.includes("Game over"),
            messageContainsIncompleteProcessed: data.message.includes("Incomplete game processed"),
            messageContainsIncompleteHandled: data.message.includes("Incomplete game handled"),
            finalIsStreakReset: isStreakReset,
            finalIsIncompleteGame: isIncompleteGame,
            willTriggerStreakResetToast: isStreakReset || isIncompleteGame
          });

          let streakMessage;
          let toastType;

          if (isWin || (!isStreakReset && !isIncompleteGame && data.data && data.data.currentStreak >= 0)) {
            // Either explicitly detected as win, OR it's a successful completion (not reset/incomplete)
            streakMessage = `🔥 Streak: ${data.data.currentStreak}!`;
            toastType = "success";
            console.log("🔍 WIN DETECTED - Will show streak toast:", streakMessage);
          } else if (isStreakReset || isIncompleteGame) {
            // ✅ SIMPLIFIED: Show streak reset notification for ALL players
            // Remove complex deduplication - let websocket and streak manager both show if needed
            streakMessage = `💔 Streak reset!`;
            toastType = "warning";
            window.lastStreakResetToastTime = Date.now();
            console.log("🔍 STREAK RESET SOURCE 1: Main success path in submitGameCompletion");

            // ✅ REMOVED: Don't immediately reset difficulty - countdown timer handles this
            // The countdown timer will reset rows back to 6 at the appropriate time
            console.log("🎯 Difficulty reset will be handled by countdown timer (not immediate)")
          } else {
            // For other messages (like "already processed"), just show streak count
            streakMessage = `🔥 Streak: ${data.data.currentStreak}`;
            toastType = "info";
          }

          if (isStreakReset || isIncompleteGame) {
            console.log("🔍 DEBUGGING STREAK RESET - SHOULD show streak reset toast:", {
              streakMessage,
              toastType,
              hasShowToast: !!window.showToast
            });
          }

          if (isWin || (!isStreakReset && !isIncompleteGame && data.data && data.data.currentStreak >= 0)) {
            console.log("🔍 DEBUGGING WIN - SHOULD show streak toast:", {
              streakMessage,
              toastType,
              hasShowToast: !!window.showToast,
              currentStreak: data.data ? data.data.currentStreak : "no data"
            });
          }

          if (window.showToast && streakMessage) {
            // ✅ Check for recent streak reset toasts to prevent duplicates
            if (streakMessage.includes("Streak reset")) {
              const now = Date.now();
              const lastToast = window.lastStreakResetToastTime || 0;
              const timeSinceLastToast = now - lastToast;

              if (timeSinceLastToast < 5000) { // Within 5 seconds
                console.log("🔍 DEBUGGING STREAK RESET - ❌ SKIPPING duplicate toast, recent toast shown:", timeSinceLastToast + "ms ago");
                return; // Skip showing this toast
              }
              console.log("🔍 DEBUGGING STREAK RESET - ✅ SHOWING STREAK RESET TOAST:", streakMessage);
            } else if (streakMessage.includes("Streak:")) {
              console.log("🔍 DEBUGGING WIN - ✅ SHOWING WIN STREAK TOAST:", streakMessage);
            }
            showToast(streakMessage, toastType, 4000);
          } else {
            if (isStreakReset || isIncompleteGame) {
              console.log("🔍 DEBUGGING STREAK RESET - ❌ NOT showing streak reset toast, why?", {
                hasShowToast: !!window.showToast,
                hasStreakMessage: !!streakMessage,
                streakMessage
              });
            }
          }
        }, delayTime); // Dynamic delay: 1.2s for losses/incomplete games, 2s for wins
      } else {
        console.error("Streak update error:", data.error);

        // ✅ IMPROVED: Handle incomplete games that were already processed by period transition
        if (data.error.includes("Game not found")) {
          console.log("🔍 Game not found - this is often normal for games processed during period transitions");

          // ✅ NEW: Check if player won in the previous period to avoid wrong notifications
          try {
            const walletAddress = window.getWalletPublicKey()?.toString();
            if (walletAddress) {
              const response = await fetch(`/api/check-previous-period-win/${walletAddress}`);
              if (response.ok) {
                const winData = await response.json();

                if (winData.wonPreviousPeriod) {
                  console.log("🔍 Player won previous period - game not found is normal, no negative notifications needed");

                  // Just update streak display, no negative notifications
                  if (walletAddress) {
                    this.loadStreakData(walletAddress);
                  }
                  return;
                }
              }
            }
          } catch (error) {
            console.log("🔍 Could not check win status for Game not found handling:", error);
          }

          const now = Date.now();
          const lastStreakResetToast = window.lastStreakResetToastTime || 0;
          const recentStreakResetToast = (now - lastStreakResetToast) < 10000; // Within 10 seconds

          if (!recentStreakResetToast) {
            console.log("🔍 No recent streak reset toast and player didn't win - showing fallback for incomplete game");

            // For incomplete games, show streak reset notification
            setTimeout(() => {
              console.log("🔍 STREAK RESET SOURCE 2: Fallback error path for Game not found");
              if (window.showToast) {
                showToast("💔 Streak reset!", "warning", 4000);
                window.lastStreakResetToastTime = Date.now();
              }

              // ✅ REMOVED: Don't immediately reset difficulty - countdown timer handles this
              console.log("🎯 Difficulty reset will be handled by countdown timer (fallback case)");
            }, 2000);
          } else {
            console.log("🔍 Recent streak reset toast detected - skipping fallback to avoid duplicate");
          }

          // Update streak display by reloading current data
          if (walletAddress) {
            this.loadStreakData(walletAddress);
          }

          return; // Don't fall through to other error handling
        }

        if (data.error.includes("already played today") || data.error.includes("already processed")) {
          // ✅ For restored games, just update display without confusing messages
          if (data.data) {
            currentStreakData = data.data;
            this.updateStreakDisplay();
          }

          if (window.showToast) {
            showToast(
              "Game already completed this period.",
              "info",
              3000
            );
          }
        }
      }
    } catch (error) {
      console.error("Error submitting game completion:", error);
    }
  }

  /**
   * Show detailed streak statistics modal
   */
  showStreakStats() {
    if (!currentStreakData) return;

    // Remove existing modal if any
    const existingModal = document.querySelector(".streak-modal");
    if (existingModal) {
      document.body.removeChild(existingModal);
    }

    const modal = document.createElement("div");
    modal.className = "streak-modal";

    document.body.appendChild(modal);

    // Close modal functionality
    const closeBtn = modal.querySelector(".streak-modal-close");
    closeBtn.onclick = () => {
      document.body.removeChild(modal);
    };

    modal.onclick = (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    };
  }

  /**
   * Update theme for footer streak display
   */
  updateTheme() {
    // Footer streak display doesn't need theme updates since it's just text
    // But you can add styling here if needed
  }

  /**
   * Get leaderboard data
   */
  async getLeaderboard() {
    try {
      const response = await fetch(`${this.API_BASE}/leaderboard`);
      const data = await response.json();

      if (data.success) {
        return data.data;
      }
    } catch (error) {
      console.error("Error getting leaderboard:", error);
    }
    return [];
  }
}

// Create global instance
const streakManager = new StreakManager();
window.streakManager = streakManager;
