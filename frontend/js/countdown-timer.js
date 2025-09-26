// ============================== COMPLETE ENHANCED COUNTDOWN TIMER ==============================
// frontend/js/countdown-timer.js - Full implementation with game status checking and compatibility

class GameTimer {
  constructor() {
    this.countdownElement = null;
    this.lastPeriod = null;
    this.initializeTimer();
  }

  initializeTimer() {
    // Find the countdown element in the footer
    this.countdownElement = document.querySelector(".time-countdown");

    if (this.countdownElement) {
      console.log(
        "🕐 Enhanced 1-minute countdown timer with game status checking initialized"
      );
      this.lastPeriod = this.getCurrentPeriod();
      this.updateCountdown();
      setInterval(() => this.updateCountdown(), 1000);
    }
  }

  getCurrentPeriod() {
    const now = Date.now();
    return Math.floor(now / 60000); // 1-minute periods
  }

  updateCountdown() {
    const now = Date.now();
    const currentPeriod = this.getCurrentPeriod();
    const currentPeriodStart = currentPeriod * 60000;
    const nextPeriodStart = currentPeriodStart + 60000;
    const timeUntilReset = nextPeriodStart - now;

    const minutes = Math.floor(timeUntilReset / 60000);
    const seconds = Math.floor((timeUntilReset % 60000) / 1000);

    // Update countdown display with danger indication
    if (this.countdownElement) {
      const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
      this.countdownElement.textContent = formattedTime;

      // ✅ NEW: Visual warning (red glow) in final 5 seconds, submission blocking in final 1 second
      const totalSeconds = minutes * 60 + seconds;

      // Red glowing text for final 5 seconds
      if (totalSeconds <= 5 && totalSeconds > 0) {
        this.countdownElement.classList.add("danger-countdown");
      } else {
        this.countdownElement.classList.remove("danger-countdown");
      }

      // Submission blocking in final 3 seconds
      if (totalSeconds <= 3 && totalSeconds > 0) {
        this.applyDangerStyling(true);
      } else {
        this.applyDangerStyling(false);
      }
    }

    // ✅ CHECK FOR PERIOD CHANGE (NEW GAME PERIOD)
    if (this.lastPeriod !== null && currentPeriod > this.lastPeriod) {
      this.handlePeriodTransition();
    }
    this.lastPeriod = currentPeriod;

    // Show warning notifications
    if (minutes === 0 && seconds === 15) {
      if (window.showToast) {
        showToast("New period starts in 15 seconds! ⏰", "warning", 3000);
      }
    }

    if (minutes === 0 && seconds === 5) {
      if (window.showToast) {
        showToast("New period starts in 5 seconds! 🚨", "warning", 2000);
      }
    }
  }

  // ✅ FIXED: Handle period transition with proper server coordination
  async handlePeriodTransition() {
    try {
      // ✅ STEP 1: Set period transition flag (compatibility with existing bug fix)
      if (window.setPeriodTransition) {
        window.setPeriodTransition(true);
      }

      // ✅ STEP 1.5: Check for inactive streak reset (before server processes)
      let previousStreak = 0;
      let walletAddress = null;
      if (window.isWalletConnected && window.isWalletConnected() && window.streakManager) {
        walletAddress = window.getWalletPublicKey()?.toString();
        if (walletAddress) {
          console.log("🔍 COUNTDOWN TIMER - Checking streak before period transition");

          // Get current streak status - assume player had a streak if they have maxStreak > 0
          // This handles the race condition where streak might already be reset
          try {
            await window.streakManager.loadStreakData(walletAddress);
            const currentData = window.currentStreakData;
            const currentStreak = currentData?.currentStreak || 0;
            const maxStreakEver = currentData?.maxStreak || 0;

            // If player has ever had a streak (maxStreak > 0), assume they had one before this transition
            previousStreak = maxStreakEver > 0 ? Math.max(currentStreak, 1) : currentStreak;

            console.log("🔍 COUNTDOWN TIMER - Streak analysis:", {
              currentStreak,
              maxStreakEver,
              assumedPreviousStreak: previousStreak
            });

            // ✅ INSTANT FOOTER UPDATE: If player had a streak but is inactive, immediately show 0 current streak
            if (maxStreakEver > 0 && currentStreak > 0) {
              console.log("🔍 COUNTDOWN TIMER - ⚡ INSTANT UPDATE: Setting current streak to 0 for inactive player");
              const streakCounter = document.querySelector(".steak-counter");
              if (streakCounter) {
                streakCounter.textContent = "0";
                console.log("✅ COUNTDOWN TIMER - Current streak footer instantly updated to 0");
              }

              // Also update highest streak display
              const prizeCounter = document.querySelector(".prize-count");
              if (prizeCounter) {
                prizeCounter.textContent = maxStreakEver;
                console.log("✅ COUNTDOWN TIMER - Highest streak footer updated to:", maxStreakEver);
              }
            }
          } catch (error) {
            console.error("❌ COUNTDOWN TIMER - Error loading streak data:", error);
            previousStreak = 0;
          }
        }
      }

      // ✅ STEP 2: Handle incomplete games FIRST (before server processes them)
      console.log("🔍 Checking for incomplete game BEFORE server transition:", {
        hasGameId: !!window.gameId,
        gameId: window.gameId,
        gameEnabled: window.gameEnabled,
        gameComplete: window.gameComplete
      });

      if (window.gameId && !window.gameComplete) {
        console.log("🔄 Incomplete game detected - handling BEFORE server transition to ensure proper notifications");
        await this.handleIncompleteGameNoWin();
      } else {
        console.log("⏭️ No incomplete game to handle");
      }

      // ✅ STEP 3: Now trigger server-side period transition (after frontend handled incomplete games)
      try {
        const response = await fetch("/api/trigger-period-transition", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "countdown_timer" }),
        });

        if (response.ok) {
          const data = await response.json();

          if (data.data && data.data.summary) {
            const summary = data.data.summary;

            // ✅ DISABLED: Remove unwanted period reset toast notification
            // if (summary.streaksReset > 0 || summary.streaksPreserved > 0) {
            //   const message = `🔄 Period reset: ${summary.streaksReset} streaks reset, ${summary.streaksPreserved} winners preserved`;
            //   if (window.showToast) {
            //     showToast(
            //       message,
            //       summary.streaksPreserved > 0 ? "success" : "warning",
            //       5000
            //     );
            //   }
            // }
          }
        }
      } catch (error) {
        console.error("❌ Server period transition failed:", error);
        // Continue with client-side transition even if server fails
      }

      // Note: Difficulty will only be reset if streak was actually reset during this period
      // Winners should keep their reduced rows when period transitions

      // ✅ STEP 4: Use existing resetGameState with period transition flag (compatibility)
      if (window.resetGameState) {
        window.resetGameState(true); // true = fromPeriodTransition
      } else {
        // Fallback to manual reset
        this.resetGameBoard();
        this.resetGameVariables();
      }

      // ✅ STEP 5: Enable new game functionality
      this.enableNewGame();

      // ✅ STEP 5.1: Handle timer reset difficulty changes (check pause state first)
      if (window.difficultyManager) {
        // ✅ NEW: Check if game is paused - skip difficulty resets during pause
        const isGamePaused = window.gamePauseHandler && window.gamePauseHandler.isGamePaused();

        if (isGamePaused) {
          console.log("⏸️ COUNTDOWN TIMER - Game is paused, skipping all difficulty resets");
          return;
        }

        console.log("🎯 COUNTDOWN TIMER - Checking for pending delayed difficulty restrictions");
        console.log("🎯 COUNTDOWN TIMER - Current difficulty state:", {
          pendingDelayedApplication: window.difficultyManager.pendingDelayedApplication,
          usableRows: window.difficultyManager.usableRows,
          currentStreak: window.difficultyManager.currentStreak
        });

        const hadPendingDelayedApplication = window.difficultyManager.pendingDelayedApplication;

        if (hadPendingDelayedApplication) {
          // Winner - apply delayed restrictions
          console.log("🎯 COUNTDOWN TIMER - Applying delayed difficulty restrictions for winner");
          window.difficultyManager.applyDelayedDifficultyRestrictions();
        } else {
          // No pending restrictions - this could be a loser who needs rows reset to 6
          console.log("🎯 COUNTDOWN TIMER - No pending restrictions, checking if player needs reset to 6 rows");
          console.log("🎯 COUNTDOWN TIMER - Current usableRows:", window.difficultyManager.usableRows);
          console.log("🎯 COUNTDOWN TIMER - Current currentStreak:", window.difficultyManager.currentStreak);

          // ✅ IMPROVED: Force reset to 6 rows for any player with streak 0 (loss scenario)
          if (window.difficultyManager.currentStreak === 0) {
            console.log("🎯 COUNTDOWN TIMER - Player has streak 0 (loss scenario), forcing reset to 6 rows");
            window.difficultyManager.resetDifficulty();
            console.log("🎯 COUNTDOWN TIMER - After reset, usableRows:", window.difficultyManager.usableRows);
          } else if (window.difficultyManager.usableRows < 6) {
            console.log("🎯 COUNTDOWN TIMER - Player has <6 rows and no pending restrictions, resetting to 6 rows (fallback)");
            window.difficultyManager.resetDifficulty();
            console.log("🎯 COUNTDOWN TIMER - After reset, usableRows:", window.difficultyManager.usableRows);
          } else {
            console.log("🎯 COUNTDOWN TIMER - Player has winning streak, no reset needed");
          }
        }
      } else {
        console.log("🎯 COUNTDOWN TIMER - No difficultyManager available");
      }

      // ✅ STEP 5.2: Update difficulty manager internal streak tracking based on server data (after processing)
      setTimeout(async () => {
        if (window.isWalletConnected && window.isWalletConnected() && window.streakManager) {
          const walletAddress = window.getWalletPublicKey()?.toString();
          if (walletAddress) {
            console.log("🎯 COUNTDOWN TIMER - Syncing streak data with difficulty manager");

            // Load current streak data after server processing
            await window.streakManager.loadStreakData(walletAddress);
            const streakData = window.currentStreakData;

            // Update difficulty manager's internal tracking to match server state
            if (window.difficultyManager && streakData) {
              window.difficultyManager.currentStreak = streakData.currentStreak || 0;
              console.log(`🎯 COUNTDOWN TIMER - Synced difficulty manager streak to ${streakData.currentStreak}`);
            }
          }
        }
      }, 4000); // Wait for server processing to complete

      // ✅ STEP 5.5: Check for inactive streak reset (after server processing)
      // Check for any connected wallet, not just those with streak >0
      if (walletAddress) {
        console.log("🔍 COUNTDOWN TIMER - Setting up streak reset monitoring");
        console.log("🔍 COUNTDOWN TIMER - Previous streak:", previousStreak);

        // Single check after 3 seconds (give backend time to process)
        setTimeout(async () => {
          try {
            console.log("🔍 COUNTDOWN TIMER - Simplified streak check");

            // Force reload streak data from backend
            console.log("🔍 COUNTDOWN TIMER - Loading streak data for wallet:", walletAddress);
            await window.streakManager.loadStreakData(walletAddress);

            // Wait longer for the data to be fully processed and check multiple times
            let streakData = null;
            let attempts = 0;
            const maxAttempts = 10;

            while (!streakData && attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 200));
              streakData = window.currentStreakData;
              attempts++;
              console.log(`🔍 COUNTDOWN TIMER - Attempt ${attempts}: currentStreakData =`, streakData);
            }

            console.log("🔍 COUNTDOWN TIMER - Final streak data received:", streakData);

            const currentStreak = streakData?.currentStreak || 0;
            const maxStreak = streakData?.maxStreak || 0;

            console.log("🔍 COUNTDOWN TIMER - Extracted values:", {
              rawCurrentStreak: streakData?.currentStreak,
              processedCurrentStreak: currentStreak,
              rawMaxStreak: streakData?.maxStreak,
              processedMaxStreak: maxStreak
            });

            console.log("🔍 COUNTDOWN TIMER - Simplified check:", {
              currentStreak,
              maxStreak,
              hadPreviousStreak: maxStreak > 0,
              streakIsZero: currentStreak === 0
            });

            console.log("🔍 COUNTDOWN TIMER - 🚨 REAL PERIOD TRANSITION DEBUG 🚨");
            console.log("🔍 COUNTDOWN TIMER - Condition 1 (maxStreak > 0):", maxStreak > 0, "(maxStreak:", maxStreak, ")");
            console.log("🔍 COUNTDOWN TIMER - Condition 2 (currentStreak === 0):", currentStreak === 0, "(currentStreak:", currentStreak, ")");
            console.log("🔍 COUNTDOWN TIMER - Both conditions met:", (maxStreak > 0 && currentStreak === 0));

            // ✅ FIXED: Only show incomplete word notifications for players who actually lost/didn't complete
            // Check if the game was completed in the previous period
            if (maxStreak > 0 && currentStreak === 0) {
              console.log("🔍 COUNTDOWN TIMER - 🚨 ENTERING NOTIFICATION BLOCK! 🚨");

              // ✅ NEW: Check if player won in the previous period before showing incomplete notifications
              try {
                const response = await fetch(`/api/check-previous-period-win/${walletAddress}`);
                if (response.ok) {
                  const winData = await response.json();

                  if (winData.wonPreviousPeriod) {
                    console.log("🔍 COUNTDOWN TIMER - Player won previous period, skipping incomplete word notification");

                    // Still reset difficulty since streak was reset, but don't show negative messages
                    if (window.difficultyManager) {
                      // ✅ NEW: Check if game is paused - skip difficulty reset during pause
                      const isGamePaused = window.gamePauseHandler && window.gamePauseHandler.isGamePaused();

                      if (isGamePaused) {
                        console.log("⏸️ COUNTDOWN TIMER - Game is paused, skipping difficulty reset for winner");
                      } else {
                        window.difficultyManager.resetDifficulty();
                        console.log("🎯 COUNTDOWN TIMER - Reset difficulty for winner (streak continuation failed)");
                      }
                    }
                    return; // Don't show "didn't complete" message for winners
                  }
                }
              } catch (error) {
                console.log("🔍 COUNTDOWN TIMER - Could not check previous period win status:", error);
                // Continue with original logic if check fails
              }

              const now = Date.now();
              const lastNotification = window.lastStreakResetToastTime || 0;
              const timeSinceLastNotification = now - lastNotification;

              console.log(`🔍 COUNTDOWN TIMER - Timing check: ${timeSinceLastNotification}ms since last notification`);

              if (timeSinceLastNotification > 10000) {
                console.log("🔍 COUNTDOWN TIMER - 🚨 SHOWING STREAK RESET NOTIFICATIONS! 🚨");

                // ✅ NEW: Reset difficulty when streak was actually reset during period transition
                if (window.difficultyManager) {
                  // ✅ NEW: Check if game is paused - skip difficulty reset during pause
                  const isGamePaused = window.gamePauseHandler && window.gamePauseHandler.isGamePaused();

                  if (isGamePaused) {
                    console.log("⏸️ COUNTDOWN TIMER - Game is paused, skipping difficulty reset for streak reset");
                  } else {
                    window.difficultyManager.resetDifficulty();
                    console.log("🎯 COUNTDOWN TIMER - Reset difficulty due to confirmed streak reset (period transition)");
                  }
                }

                // Show toasts with original timing
                setTimeout(() => {
                  showToast("💔 Streak reset!", "warning", 4000);
                }, 1200);

                // ✅ FIXED: Only show "didn't complete" for actual incomplete games
                setTimeout(() => {
                  showToast("You didn't complete the word!", "error", 4000);
                }, 1700);

                window.lastStreakResetToastTime = now;
              } else {
                console.log("🔍 COUNTDOWN TIMER - Skipping (recent notification)");
              }
            } else {
              console.log("🔍 COUNTDOWN TIMER - No inactive streak reset detected");
            }
          } catch (error) {
            console.error("❌ COUNTDOWN TIMER - Error in simplified streak check:", error);
          }
        }, 3000);
      }

      // ✅ STEP 6: Show appropriate messages
      if (window.isWalletConnected && window.isWalletConnected()) {
        if (window.showToast) {
          showToast(
            "🆕 New word available! Ready to play! 🚀",
            "success",
            4000
          );
        }
      } else {
        if (window.showToast) {
          showToast(
            "🎮 New word available! Connect your wallet to play! 📱",
            "info",
            4000
          );
        }
      }


      // ✅ STEP 7: Start new game using compatible method
      // ❌ DISABLED: Auto-start removed to prevent phantom signature prompts and unintended game activation
      // After period transitions, users must manually click "Play Game" and deposit 0.01 SOL
      // setTimeout(() => this.autoStartNewGameCompatible(), 1000);

      // ✅ STEP 8: Clear period transition flag after delay (compatibility)
      setTimeout(() => {
        if (window.setPeriodTransition) {
          window.setPeriodTransition(false);
        }
      }, 5000);
    } catch (error) {
      console.error("Error handling period transition:", error);

      // ✅ Always clear period transition flag on error
      if (window.setPeriodTransition) {
        window.setPeriodTransition(false);
      }
    }
  }

  // ✅ ENHANCED: Game status determination with API checking and period transition awareness
  async getEnhancedGameStatus() {
    const isWalletConnected =
      window.isWalletConnected && window.isWalletConnected();

    // ✅ Check period transition state from existing bug fix
    const isPeriodTransition = window.isPeriodTransition || false;

    if (!isWalletConnected) {
      const storedWallets = this.getAllStoredWallets();
      const hasStoredStreaks = storedWallets.some((wallet) => {
        const streak =
          parseInt(localStorage.getItem(`lastKnownStreak_${wallet}`)) || 0;
        return streak > 0;
      });

      return {
        scenario: hasStoredStreaks
          ? "not_connected_has_streak"
          : "not_connected_no_streak",
        storedWallets,
        hasStoredStreaks,
        isPeriodTransition,
      };
    }

    try {
      const walletAddress = window.getWalletPublicKey().toString();

      // ✅ Check with server for current game and win status
      const response = await fetch(`/api/test-game-status-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const serverStatus = data.data;

          // ✅ Use existing game state variables from bug fix
          const hasActiveGame = window.gameId && window.gameId !== null;
          const gameComplete = window.gameComplete || false;

          // ✅ During period transition, prioritize server status
          if (isPeriodTransition) {
            if (serverStatus.wonCurrentPeriod) {
              return {
                scenario:
                  hasActiveGame && !gameComplete ? "incomplete_won" : "won",
                serverStatus,
                hasActiveGame,
                gameComplete,
                isPeriodTransition: true,
              };
            } else if (hasActiveGame && !gameComplete) {
              return {
                scenario: "incomplete_no_win",
                serverStatus,
                hasActiveGame,
                gameComplete,
                isPeriodTransition: true,
              };
            } else {
              return {
                scenario: "not_started",
                serverStatus,
                isPeriodTransition: true,
              };
            }
          }

          // Normal game status checking
          if (hasActiveGame && !gameComplete) {
            if (serverStatus.wonCurrentPeriod) {
              return {
                scenario: "incomplete_won",
                serverStatus,
                hasActiveGame,
                gameComplete,
              };
            } else {
              return {
                scenario: "incomplete_no_win",
                serverStatus,
                hasActiveGame,
                gameComplete,
              };
            }
          } else if (gameComplete) {
            // Use existing visual detection method from bug fix
            const squares = document.querySelectorAll(".square.guessed");
            if (squares.length === 0) {
              return { scenario: "not_started", serverStatus };
            }

            const lastRowStart = Math.floor((squares.length - 1) / 5) * 5;
            const lastRowSquares = Array.from(squares).slice(
              lastRowStart,
              lastRowStart + 5
            );

            if (lastRowSquares.length === 5) {
              const allCorrect = lastRowSquares.every(
                (square) => square.dataset.result === "correct"
              );
              return {
                scenario: allCorrect ? "won" : "lost",
                serverStatus,
              };
            }

            return { scenario: "lost", serverStatus };
          } else {
            return { scenario: "not_started", serverStatus };
          }
        }
      }
    } catch (error) {
      console.error("Error getting enhanced game status:", error);
    }

    // ✅ Fallback to existing local checking from bug fix
    const hasActiveGame = window.gameId && window.gameId !== null;
    const gameComplete = window.gameComplete || false;

    if (!hasActiveGame) {
      return { scenario: "not_started", isPeriodTransition };
    }

    if (gameComplete) {
      const squares = document.querySelectorAll(".square.guessed");
      if (squares.length === 0) {
        return { scenario: "not_started", isPeriodTransition };
      }

      const lastRowStart = Math.floor((squares.length - 1) / 5) * 5;
      const lastRowSquares = Array.from(squares).slice(
        lastRowStart,
        lastRowStart + 5
      );

      if (lastRowSquares.length === 5) {
        const allCorrect = lastRowSquares.every(
          (square) => square.dataset.result === "correct"
        );
        return { scenario: allCorrect ? "won" : "lost", isPeriodTransition };
      }

      return { scenario: "lost", isPeriodTransition };
    }

    return { scenario: "incomplete_no_win", isPeriodTransition };
  }

  // ✅ NEW: Handle incomplete game where player already won this period
  async handleIncompleteGameWon() {
    console.log(
      "🏆 Player won this period but has incomplete game - preserving streak"
    );

    if (window.isWalletConnected && window.isWalletConnected()) {
      try {
        const walletAddress = window.getWalletPublicKey().toString();

        // Still handle the incomplete game but with won status
        const response = await fetch("http://localhost:3000/api/handle-incomplete-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress,
            gameId: window.gameId,
            reason: "time_expired_but_won",
            broadcastToAdmins: true,
          }),
        });

        if (response.ok) {
          const data = await response.json();

          // Update streak display
          if (window.streakManager) {
            await window.streakManager.loadStreakData(walletAddress);
          }

          if (data.streakPreserved) {
            if (window.showToast) {
              showToast(
                "🏆 Time's up but you won this period! Streak preserved! 🔥",
                "success",
                5000
              );
            }
          } else {
            if (window.showToast) {
              showToast(
                "🏆 You won this period! Your streak continues! 🔥",
                "success",
                4000
              );
            }
          }
        }
      } catch (error) {
        console.error("Error handling incomplete won game:", error);
        if (window.showToast) {
          showToast(
            "🏆 You won this period! Streak continues! 🔥",
            "success",
            4000
          );
        }
      }
    }
  }

  // ✅ UPDATED: Handle incomplete games where player didn't win
  async handleIncompleteGameNoWin() {
    console.log("⏰ Incomplete game detected (no win) - resetting streak");
    console.log("🔍 Current game state:", {
      gameId: window.gameId,
      gameEnabled: window.gameEnabled,
      gameComplete: window.gameComplete
    });

    if (window.isWalletConnected && window.isWalletConnected()) {
      try {
        const walletAddress = window.getWalletPublicKey().toString();

        const response = await fetch("http://localhost:3000/api/handle-incomplete-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress,
            gameId: window.gameId,
            reason: "time_expired_no_win",
            broadcastToAdmins: true,
          }),
        });

        console.log("🔍 Response status:", response.status, response.statusText);

        if (response.ok) {
          const data = await response.json();
          console.log("🔍 Incomplete game backend response:", data);

          // ✅ Complete the game on frontend
          if (data.hasIncompleteGame) {
            console.log("✅ Backend confirmed incomplete game, completing on frontend...");
            window.gameComplete = true;
            window.gameEnabled = false;

            // Submit game completion to update streaks
            if (window.streakManager && data.gameId) {
              await window.streakManager.submitGameCompletion(data.gameId, walletAddress, "period_timeout");
            }

            // Show game over message with answer for ALL players
            if (window.showToast && data.answer) {
              console.log("🎯 Showing game over toast with answer:", data.answer);
              setTimeout(() => {
                showToast(
                  `🎮 Game over! The word was: ${data.answer}`,
                  "error",
                  4000
                );
              }, 1700);
            } else {
              console.warn("⚠️ Cannot show game over toast:", {
                hasShowToast: !!window.showToast,
                hasAnswer: !!data.answer,
                answer: data.answer
              });
            }
          }

          // Update streak display
          if (window.streakManager) {
            await window.streakManager.loadStreakData(walletAddress);
          }

          if (data.streakPreserved) {
            if (window.showToast) {
              showToast(
                "🏆 Time's up but you won this period! Streak preserved! 🔥",
                "success",
                5000
              );
            }
          } else {
            console.log("❌ No incomplete game found by backend, but frontend detected one");
            // This should not happen anymore with the fixed backend logic
            console.warn("⚠️ This case should be rare now - backend should find period data");

            // ✅ REMOVED: Don't call submitGameCompletion again - it was already called above
            // This was causing duplicate streak reset notifications
            console.log("ℹ️ Skipping second submitGameCompletion call to avoid duplicates");
          }
        } else {
          console.error("❌ Backend request failed:", response.status, response.statusText);
          const errorData = await response.text();
          console.error("❌ Error response:", errorData);
        }
      } catch (error) {
        console.error("Error handling incomplete game:", error);
        if (window.showToast) {
          showToast("⏰ Time's up! Try the new word! 🎮", "warning", 4000);
        }
      }
    }
  }

  // ✅ NEW: Handle disconnected players with streaks
  async handleDisconnectedPlayerWithStreak() {
    console.log(
      "💔 Disconnected player with streak detected - checking for wins"
    );

    const allStoredWallets = this.getAllStoredWallets();
    let totalChecked = 0;
    let totalPreserved = 0;
    let totalReset = 0;

    for (const walletAddress of allStoredWallets) {
      try {
        const lastKnownStreak =
          parseInt(localStorage.getItem(`lastKnownStreak_${walletAddress}`)) ||
          0;

        if (lastKnownStreak === 0) continue;

        totalChecked++;

        const response = await fetch("/api/handle-disconnected-player", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress,
            reason: "disconnected_timeout_enhanced",
            broadcastToAdmins: true,
          }),
        });

        if (response.ok) {
          const data = await response.json();

          if (data.streakPreserved) {
            totalPreserved++;
            console.log(
              `🏆 Preserved streak for winner: ${walletAddress.slice(0, 8)}...`
            );
          } else if (data.wasReset) {
            totalReset++;
            console.log(
              `💔 Reset streak for non-winner: ${walletAddress.slice(0, 8)}...`
            );

            // Update local storage
            localStorage.setItem(`lastKnownStreak_${walletAddress}`, "0");
          }
        }
      } catch (error) {
        console.error(`Error checking wallet ${walletAddress}:`, error);
      }
    }

    // ✅ DISABLED: Remove unwanted period reset toast notification
    // if (totalReset > 0 || totalPreserved > 0) {
    //   const message = `🔄 Period reset: ${totalReset} streaks reset, ${totalPreserved} winners preserved`;
    //   if (window.showToast) {
    //     showToast(message, totalPreserved > 0 ? "success" : "warning", 4000);
    //   }
    // }

    console.log(
      `📊 Disconnected player check: ${totalChecked} checked, ${totalReset} reset, ${totalPreserved} preserved`
    );
  }

  // ✅ NEW: Handle disconnected players with no streaks
  async handleDisconnectedPlayerNoStreak() {
    if (window.showToast) {
      showToast(
        "🎮 New word available! Connect your wallet to play! 📱",
        "info",
        4000
      );
    }
  }

  // ✅ NEW: Handle completed winning games
  handleWonGame() {
    if (window.showToast) {
      showToast(
        "🎉 New word available! Your streak continues! 🔥",
        "success",
        4000
      );
    }
  }

  // ✅ NEW: Handle completed losing games
  handleLostGame() {
    console.log(
      "💔 Player lost - streak already reset, clearing board for new game"
    );
    if (window.showToast) {
      showToast("🎮 New word available! Try again! 💪", "info", 4000);
    }
  }

  // ✅ NEW: Handle when no game was started
  handleNotStartedGame() {
    if (window.showToast) {
      showToast("🆕 New word available! Start your game! 🚀", "info", 3000);
    }
  }

  // ✅ UPDATED: Reset game variables completely (fallback method)
  resetGameVariables() {
    // Reset global game state if available
    if (window.resetGameState) {
      window.resetGameState();
    }

    // Force reset game variables
    if (typeof window.gameId !== "undefined") {
      window.gameId = null;
    }
    if (typeof window.gameComplete !== "undefined") {
      window.gameComplete = false;
    }
    if (typeof window.gameEnabled !== "undefined") {
      window.gameEnabled = false;
    }

    // Clear any stored game data that might be restored
    try {
      const keysToCheck = Object.keys(localStorage);
      keysToCheck.forEach((key) => {
        if (
          key.includes("gameState") ||
          key.includes("currentGame") ||
          key.includes("activeGame")
        ) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn("Warning: Could not clear game localStorage:", error);
    }
  }

  // ✅ UPDATED: Reset visual game elements (fallback method)
  resetGameBoard() {
    // Clear all tiles
    const squares = document.querySelectorAll(".square");
    squares.forEach((square, index) => {
      // Store whether this square was disabled before clearing
      const wasDisabled = square.classList.contains('disabled-square');

      square.textContent = "";
      square.style.backgroundColor = "";
      square.style.borderColor = "";
      square.style.transform = "";

      // Remove all classes except basic ones
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

        console.log(`🎯 Preserved disabled state for square ${square.id} in countdown-timer`);
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

      // Reset theme colors
      const isLightMode = document
        .querySelector("html")
        .classList.contains("switch");
      if (isLightMode && !button.classList.contains("switch")) {
        button.classList.add("switch");
      }
    });

    // Add visual feedback
    const board = document.getElementById("board");
    if (board) {
      board.classList.add("animate__animated", "animate__fadeIn");
      setTimeout(() => {
        board.classList.remove("animate__animated", "animate__fadeIn");
      }, 1000);
    }
  }

  // ✅ NEW: Enable new game (always happens)
  enableNewGame() {
    if (window.enableGame) {
      window.enableGame();
    }
  }

  // ✅ COMPATIBLE: Auto-start new game with existing bug fix integration
  async autoStartNewGameCompatible() {
    // Only start if wallet is connected
    if (
      window.isWalletConnected &&
      window.isWalletConnected() &&
      window.startNewGame
    ) {
      // ✅ Make sure no game state exists before starting
      if (window.gameId && window.gameId !== null) {
        window.gameId = null;
        if (window.resetGameState) {
          window.resetGameState();
        }
      }

      try {
        console.log(
          "🚀 Auto-starting NEW game (period transition compatible)..."
        );

        // ✅ Use the existing startNewGame with forceNew flag from bug fix
        await window.startNewGame(true, true); // isAutoStart=true, forceNew=true

        if (window.showToast) {
          showToast("✨ Ready to play! Good luck! 🍀", "success", 3000);
        }
      } catch (error) {
        console.error("Error auto-starting compatible new game:", error);
        if (window.showToast) {
          showToast(
            "🎮 New word ready! Click 'Play Game' to start! 👆",
            "info",
            4000
          );
        }
      }
    } else if (window.isWalletConnected && window.isWalletConnected()) {
      if (window.showToast) {
        showToast(
          "🎮 New word ready! Click 'Play Game' to start! 👆",
          "info",
          4000
        );
      }
    }
  }

  // ✅ NEW: Check if we're in submission danger window (final 3 seconds)
  isInSubmissionDangerWindow() {
    const timeUntilReset = this.getTimeUntilReset();
    const totalSeconds = timeUntilReset.minutes * 60 + timeUntilReset.seconds;
    return totalSeconds <= 3;
  }

  // ✅ NEW: Apply visual styling to indicate submission blocking
  applyDangerStyling(isDanger) {
    // Use the unified keyboard visual state function
    if (window.applyKeyboardVisualState) {
      window.applyKeyboardVisualState();
    }

    // Apply red/glowing styling to countdown timer
    const countdownElement = document.querySelector('#countdown-timer');
    if (countdownElement) {
      if (isDanger) {
        countdownElement.classList.add('countdown-danger');
      } else {
        countdownElement.classList.remove('countdown-danger');
      }
    }
  }

  // ✅ Helper methods
  getAllStoredWallets() {
    const wallets = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("lastKnownStreak_")) {
          const wallet = key.replace("lastKnownStreak_", "");
          const streak = parseInt(localStorage.getItem(key)) || 0;
          if (streak > 0) {
            wallets.push(wallet);
          }
        }
      }

      const lastWallet = localStorage.getItem("lastWalletAddress");
      if (lastWallet && !wallets.includes(lastWallet)) {
        const lastStreak =
          parseInt(localStorage.getItem(`lastKnownStreak_${lastWallet}`)) || 0;
        if (lastStreak > 0) {
          wallets.push(lastWallet);
        }
      }
    } catch (error) {
      console.error("Error getting stored wallets:", error);
    }
    return wallets;
  }

  // Utility methods
  getTimeUntilReset() {
    const now = Date.now();
    const currentPeriodStart = Math.floor(now / 60000) * 60000;
    const nextPeriodStart = currentPeriodStart + 60000;
    const timeUntilReset = nextPeriodStart - now;

    return {
      minutes: Math.floor(timeUntilReset / 60000),
      seconds: Math.floor((timeUntilReset % 60000) / 1000),
      totalMilliseconds: timeUntilReset,
    };
  }

  getCurrentPeriodInfo() {
    const now = Date.now();
    const periodTimestamp = Math.floor(now / 60000);
    const periodStart = periodTimestamp * 60000;
    const periodEnd = periodStart + 60000;

    return {
      currentTime: new Date(now).toISOString(),
      periodTimestamp,
      periodStart: new Date(periodStart).toISOString(),
      periodEnd: new Date(periodEnd).toISOString(),
      minutesInPeriod: Math.floor((now - periodStart) / 60000),
      secondsInPeriod: Math.floor((now - periodStart) / 1000) % 60,
      timeUntilNext: this.getTimeUntilReset(),
      gameStatus: "Use getEnhancedGameStatus() for detailed status",
      storedWallets: this.getAllStoredWallets(),
    };
  }

  // ✅ DEBUG METHODS

  // ✅ NEW: Debug method to test the fixed period transition
  async simulatePeriodTransition() {
    this.lastPeriod = this.getCurrentPeriod() - 1; // Force transition
    await this.handlePeriodTransition();
  }

  // ✅ NEW: Test server connectivity
  async testServerConnection() {
    try {
      const response = await fetch("/api/disconnected-manager-status");
      if (response.ok) {
        const data = await response.json();

        if (window.showToast) {
          showToast("Server connection: OK", "success", 2000);
        }

        return data;
      } else {
        console.error("❌ Server connection test failed");
        if (window.showToast) {
          showToast("Server connection: Failed", "error", 3000);
        }
        return null;
      }
    } catch (error) {
      console.error("❌ Server connection error:", error);
      if (window.showToast) {
        showToast("Server connection: Error", "error", 3000);
      }
      return null;
    }
  }

  // ✅ Debug method to test enhanced period transition
  async simulateEnhancedPeriodTransition() {
    this.lastPeriod = this.getCurrentPeriod() - 1; // Force transition
    await this.handlePeriodTransition();
  }

  // ✅ NEW: Test inactive streak reset notifications manually
  testInactiveStreakResetNotifications() {
    console.log("🧪 TESTING - Manual trigger of inactive streak reset notifications");

    if (window.showToast) {
      // Show "💔 Streak reset!" at 1.2s
      setTimeout(() => {
        console.log("🧪 TESTING - SHOWING STREAK RESET TOAST NOW");
        showToast("💔 Streak reset!", "warning", 4000);
      }, 1200);

      // Show "You didn't complete the word!" at +0.5s delay (1.7s total)
      setTimeout(() => {
        console.log("🧪 TESTING - SHOWING INCOMPLETE WORD TOAST NOW");
        showToast("You didn't complete the word!", "error", 4000);
      }, 1700);

      console.log("🧪 TESTING - Timers set, notifications should appear");
    } else {
      console.log("❌ TESTING - showToast not available");
    }
  }

  // ✅ NEW: Test footer streak updating manually
  testFooterStreakUpdate() {
    console.log("🧪 TESTING - Manual footer streak update");

    if (window.isWalletConnected && window.isWalletConnected() && window.streakManager) {
      const walletAddress = window.getWalletPublicKey()?.toString();
      if (walletAddress) {
        console.log("🧪 TESTING - Reloading streak data and updating footer");

        window.streakManager.loadStreakData(walletAddress).then(() => {
          console.log("🧪 TESTING - Streak data loaded, forcing footer update");
          window.streakManager.updateStreakDisplay();
          console.log("🧪 TESTING - Footer update completed");
        });
      } else {
        console.log("❌ TESTING - No wallet address available");
      }
    } else {
      console.log("❌ TESTING - Wallet not connected or streak manager not available");
    }
  }

  // ✅ NEW: Test inactive player logic with current data
  async testInactivePlayerLogic() {
    console.log("🧪 TESTING - Manual inactive player logic test");

    if (window.isWalletConnected && window.isWalletConnected() && window.streakManager) {
      const walletAddress = window.getWalletPublicKey()?.toString();
      if (walletAddress) {
        console.log("🧪 TESTING - Loading current streak data");

        try {
          await window.streakManager.loadStreakData(walletAddress);

          const currentStreak = window.currentStreakData?.currentStreak || 0;
          const maxStreak = window.currentStreakData?.maxStreak || 0;

          console.log("🧪 TESTING - Current data:", {
            currentStreak,
            maxStreak,
            fullData: window.currentStreakData
          });

          // Simulate the logic from period transition
          const previousStreak = 1; // Simulate having had a streak
          const newStreak = currentStreak;

          const streakWasReset = (previousStreak > 0 && newStreak === 0);
          const hasMaxStreak = maxStreak > 0;
          const isFirstCheck = true;
          const shouldShowInactiveNotification = hasMaxStreak && newStreak === 0 && isFirstCheck;

          console.log("🧪 TESTING - Logic check:", {
            previousStreak,
            newStreak,
            streakWasReset,
            hasMaxStreak,
            isFirstCheck,
            shouldShowInactiveNotification,
            finalCondition: streakWasReset || shouldShowInactiveNotification
          });

          if (streakWasReset || shouldShowInactiveNotification) {
            console.log("🧪 TESTING - ✅ CONDITIONS MET - Would show notifications");

            // Test the actual notification logic
            if (window.showToast) {
              console.log("🧪 TESTING - Triggering test notifications");

              setTimeout(() => {
                console.log("🧪 TESTING - SHOWING STREAK RESET TOAST");
                showToast("💔 Streak reset!", "warning", 4000);
              }, 1200);

              setTimeout(() => {
                console.log("🧪 TESTING - SHOWING INCOMPLETE WORD TOAST");
                showToast("You didn't complete the word!", "error", 4000);
              }, 1700);
            }
          } else {
            console.log("🧪 TESTING - ❌ CONDITIONS NOT MET - Would not show notifications");
          }

        } catch (error) {
          console.error("❌ TESTING - Error:", error);
        }
      }
    }
  }

  // ✅ NEW: Force trigger inactive notifications for testing
  testForceInactiveNotifications() {
    console.log("🧪 FORCE TEST - Bypassing all conditions and forcing notifications");

    const now = Date.now();
    console.log("🧪 FORCE TEST - Current timestamp:", now);
    console.log("🧪 FORCE TEST - Last notification time:", window.lastStreakResetToastTime || 0);
    console.log("🧪 FORCE TEST - showToast available:", !!window.showToast);

    // Check toast container
    const toastContainer = document.getElementById("toast-container");
    console.log("🧪 FORCE TEST - Toast container:", toastContainer);
    console.log("🧪 FORCE TEST - Toast container visible:", toastContainer ? getComputedStyle(toastContainer).display : "not found");

    if (toastContainer) {
      console.log("🧪 FORCE TEST - Toast container styles:", {
        position: getComputedStyle(toastContainer).position,
        top: getComputedStyle(toastContainer).top,
        left: getComputedStyle(toastContainer).left,
        right: getComputedStyle(toastContainer).right,
        bottom: getComputedStyle(toastContainer).bottom,
        zIndex: getComputedStyle(toastContainer).zIndex,
        width: getComputedStyle(toastContainer).width,
        height: getComputedStyle(toastContainer).height,
        transform: getComputedStyle(toastContainer).transform
      });

      const rect = toastContainer.getBoundingClientRect();
      console.log("🧪 FORCE TEST - Toast container position on screen:", {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        visible: rect.width > 0 && rect.height > 0 && rect.x >= 0 && rect.y >= 0
      });
    }

    // Force clear the last notification time
    window.lastStreakResetToastTime = 0;

    if (window.showToast) {
      console.log("🧪 FORCE TEST - ✅ EXECUTING FORCE NOTIFICATIONS");

      // Test a simple toast first
      console.log("🧪 FORCE TEST - Testing simple toast immediately");
      showToast("🧪 IMMEDIATE TEST TOAST", "success", 3000);

      // Check what's in the toast container after creating a toast
      setTimeout(() => {
        const container = document.getElementById("toast-container");
        console.log("🧪 FORCE TEST - Container children after immediate toast:", container.children.length);
        console.log("🧪 FORCE TEST - Container innerHTML:", container.innerHTML);

        if (container.children.length > 0) {
          const firstToast = container.children[0];
          console.log("🧪 FORCE TEST - First toast element:", firstToast);
          console.log("🧪 FORCE TEST - First toast styles:", {
            display: getComputedStyle(firstToast).display,
            visibility: getComputedStyle(firstToast).visibility,
            opacity: getComputedStyle(firstToast).opacity,
            position: getComputedStyle(firstToast).position,
            zIndex: getComputedStyle(firstToast).zIndex,
            top: getComputedStyle(firstToast).top,
            left: getComputedStyle(firstToast).left
          });
        }
      }, 100);

      setTimeout(() => {
        console.log("🧪 FORCE TEST - ✅ SHOWING STREAK RESET TOAST NOW");
        const toastContainerCheck = document.getElementById("toast-container");
        console.log("🧪 FORCE TEST - Toast container at execution:", toastContainerCheck);
        showToast("💔 Streak reset! (FORCE TEST)", "warning", 4000);
      }, 1200);

      setTimeout(() => {
        console.log("🧪 FORCE TEST - ✅ SHOWING INCOMPLETE WORD TOAST NOW");
        showToast("You didn't complete the word! (FORCE TEST)", "error", 4000);
      }, 1700);

      window.lastStreakResetToastTime = now;
      console.log("🧪 FORCE TEST - Timers set, should see notifications in 1.2s and 1.7s");
    } else {
      console.log("❌ FORCE TEST - showToast not available!");
    }
  }

  // ✅ Test game status checking
  async testGameStatusCheck() {
    try {
      const gameStatus = await this.getEnhancedGameStatus();

      if (window.showToast) {
        showToast(`Game status: ${gameStatus.scenario}`, "info", 3000);
      }

      return gameStatus;
    } catch (error) {
      console.error("❌ Enhanced game status check failed:", error);
      return { scenario: "error", error: error.message };
    }
  }

  // ✅ Test specific wallet status
  async testWalletStatus(walletAddress) {
    if (
      !walletAddress &&
      window.isWalletConnected &&
      window.isWalletConnected()
    ) {
      walletAddress = window.getWalletPublicKey().toString();
    }

    if (!walletAddress) {
      console.error("❌ No wallet address provided");
      return;
    }

    try {
      console.log(
        `🧪 Testing wallet status for: ${walletAddress.slice(0, 8)}...`
      );

      const response = await fetch("/api/test-game-status-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          if (window.showToast) {
            const status = data.data;
            const message = `Streak: ${status.currentStreak}, Won: ${status.wonCurrentPeriod}, Should reset: ${status.shouldResetStreak}`;
            showToast(message, "info", 5000);
          }

          return data.data;
        }
      }

      console.error("❌ Failed to get wallet status");
      return null;
    } catch (error) {
      console.error("❌ Wallet status check failed:", error);
      return null;
    }
  }

  // ✅ Test complete enhanced system
  async testEnhancedSystem() {
    try {
      // Test 1: Game status check

      const gameStatus = await this.testGameStatusCheck();

      // Test 2: Wallet status (if connected)
      if (window.isWalletConnected && window.isWalletConnected()) {
        await this.testWalletStatus();
      }

      // Test 3: Period info

      const periodInfo = this.getCurrentPeriodInfo();

      // Test 4: Stored wallets

      const storedWallets = this.getAllStoredWallets();

      const testResults = {
        gameStatus,
        periodInfo,
        storedWallets,
        systemStatus: "enhanced_system_operational",
      };

      if (window.showToast) {
        showToast(
          "Enhanced system test completed - check console",
          "success",
          4000
        );
      }

      return testResults;
    } catch (error) {
      console.error("❌ Enhanced system test failed:", error);
      return { error: error.message };
    }
  }
}

// Initialize the timer when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const gameTimer = new GameTimer();
  window.gameTimer = gameTimer;

  // ✅ NEW: Make submission danger window check available globally
  window.isInSubmissionDangerWindow = () => gameTimer.isInSubmissionDangerWindow();

  // ✅ NEW: Test function for submission blocking
  window.testSubmissionBlocking = () => {
    const timeInfo = gameTimer.getTimeUntilReset();
    const isDanger = gameTimer.isInSubmissionDangerWindow();
    const totalSeconds = timeInfo.minutes * 60 + timeInfo.seconds;

    console.log("🧪 SUBMISSION BLOCKING TEST:");
    console.log(`⏰ Time until reset: ${timeInfo.minutes}:${timeInfo.seconds.toString().padStart(2, '0')}`);
    console.log(`🚨 Total seconds remaining: ${totalSeconds}`);
    console.log(`⚠️ In danger window (≤3s): ${isDanger}`);
    console.log(`🎯 Would block submission: ${isDanger}`);
    console.log(`🔴 Red glow active: ${totalSeconds <= 5 && totalSeconds > 0}`);

    // Force apply danger styling for testing
    gameTimer.applyDangerStyling(true);
    console.log("✅ Applied danger styling for 5 seconds...");

    setTimeout(() => {
      gameTimer.applyDangerStyling(false);
      console.log("✅ Removed danger styling");
    }, 5000);

    return { timeInfo, isDanger, totalSeconds };
  };

  // Make enhanced debugging functions available in console
  window.getCurrentPeriodInfo = () => gameTimer.getCurrentPeriodInfo();
  window.simulateEnhancedPeriodTransition = () =>
    gameTimer.simulateEnhancedPeriodTransition();
  window.testGameStatusCheck = () => gameTimer.testGameStatusCheck();
  window.testWalletStatus = (walletAddress) =>
    gameTimer.testWalletStatus(walletAddress);
  window.testEnhancedSystem = () => gameTimer.testEnhancedSystem();
  window.simulatePeriodTransition = () =>
    window.gameTimer?.simulatePeriodTransition();
  window.testServerConnection = () => window.gameTimer?.testServerConnection();
  window.testInactiveStreakResetNotifications = () =>
    gameTimer.testInactiveStreakResetNotifications();
  window.testFooterStreakUpdate = () => gameTimer.testFooterStreakUpdate();
  window.testInactivePlayerLogic = () => gameTimer.testInactivePlayerLogic();
  window.testForceInactiveNotifications = () => gameTimer.testForceInactiveNotifications();
});

// Export for use in other files if needed
window.GameTimer = GameTimer;

console.log(
  "🕐 Enhanced GameTimer loaded with full game status checking and compatibility"
);

// ✅ NEW: Test function for inactive streak reset scenario
window.testInactiveStreakResetScenario = function() {
  console.log("🧪 COMPREHENSIVE TEST - Simulating inactive streak reset scenario");

  // Step 1: Setup - Simulate having a wallet connected with a previous streak
  const mockWalletAddress = "test_wallet_123";
  console.log("🧪 TEST - Step 1: Mock wallet connected:", mockWalletAddress);

  // Step 2: Mock streak data - player had streak 3, but didn't play and now it's 0
  const mockStreakData = {
    currentStreak: 0,  // Reset to 0 (inactive player)
    maxStreak: 3,      // Had a streak of 3 before
    lastUpdated: new Date().toISOString()
  };

  // Simulate the streak data being loaded
  window.currentStreakData = mockStreakData;
  console.log("🧪 TEST - Step 2: Mock streak data set:", mockStreakData);

  // Step 3: Clear any recent notification timestamps to ensure toasts will show
  window.lastStreakResetToastTime = 0;
  console.log("🧪 TEST - Step 3: Cleared notification timestamp");

  // Step 4: Run the exact same logic that runs during period transitions
  setTimeout(async () => {
    console.log("🧪 TEST - Step 4: Running simplified streak check logic");

    try {
      // This is the exact same logic from the period transition
      const streakData = window.currentStreakData;
      const currentStreak = streakData?.currentStreak || 0;
      const maxStreak = streakData?.maxStreak || 0;

      console.log("🧪 TEST - Simplified check:", {
        currentStreak,
        maxStreak,
        hadPreviousStreak: maxStreak > 0,
        streakIsZero: currentStreak === 0
      });

      // Simple logic: If you ever had a streak (maxStreak > 0) and current is 0,
      // and we haven't shown notifications recently, show them
      if (maxStreak > 0 && currentStreak === 0) {
        const now = Date.now();
        const lastNotification = window.lastStreakResetToastTime || 0;
        const timeSinceLastNotification = now - lastNotification;

        console.log(`🧪 TEST - Timing check: ${timeSinceLastNotification}ms since last notification`);

        if (timeSinceLastNotification > 10000) {
          console.log("🧪 TEST - 🚨 CONDITIONS MET! SHOULD SHOW NOTIFICATIONS! 🚨");

          if (window.showToast) {
            // Show toasts with original timing
            console.log("🧪 TEST - Scheduling toast 1 (💔 Streak reset!) in 1.2s");
            setTimeout(() => {
              console.log("🧪 TEST - 🎯 SHOWING TOAST 1 NOW");
              showToast("💔 Streak reset! (TEST)", "warning", 4000);
            }, 1200);

            console.log("🧪 TEST - Scheduling toast 2 (You didn't complete the word!) in 1.7s");
            setTimeout(() => {
              console.log("🧪 TEST - 🎯 SHOWING TOAST 2 NOW");
              showToast("You didn't complete the word! (TEST)", "error", 4000);
            }, 1700);

            window.lastStreakResetToastTime = now;
            console.log("🧪 TEST - ✅ Test completed successfully - toasts should appear!");
          } else {
            console.error("🧪 TEST - ❌ showToast not available");
          }
        } else {
          console.log("🧪 TEST - ❌ FAILED: Recent notification detected");
        }
      } else {
        console.log("🧪 TEST - ❌ FAILED: Conditions not met");
        console.log("🧪 TEST - Condition analysis:", {
          maxStreakGreaterThanZero: maxStreak > 0,
          currentStreakIsZero: currentStreak === 0,
          bothConditions: (maxStreak > 0 && currentStreak === 0)
        });
      }
    } catch (error) {
      console.error("🧪 TEST - ❌ Error in test:", error);
    }
  }, 100); // Small delay to simulate async data loading

  console.log("🧪 TEST - Test initiated, results will appear shortly...");
};

console.log("  testGameStatusCheck() - Test enhanced game status detection");
console.log("  testWalletStatus(address) - Test specific wallet status");
console.log(
  "  simulateEnhancedPeriodTransition() - Test enhanced period transition"
);
console.log("  testEnhancedSystem() - Test complete enhanced system");
console.log("  getCurrentPeriodInfo() - Get current period information");

console.log("  simulatePeriodTransition() - Test fixed period transition");
console.log("  testServerConnection() - Test server connectivity");
console.log("  testInactiveStreakResetScenario() - Test inactive streak reset notifications");
