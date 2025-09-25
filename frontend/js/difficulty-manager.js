// ============================== STREAK-BASED DIFFICULTY MANAGER ==============================
// Progressive difficulty based on current streak

class DifficultyManager {
  constructor() {
    this.currentStreak = 0;
    this.maxRows = 6; // Default starting rows
    this.minRows = 3; // Minimum rows allowed
    this.usableRows = 6; // Currently usable rows
    this.pendingDelayedApplication = false; // For delaying restrictions until timer reset

    console.log("🎯 Difficulty Manager initialized");
  }

  /**
   * Calculate usable rows based on current streak
   * Streak 0: 6 rows
   * Streak 1: 5 rows
   * Streak 2: 4 rows
   * Streak 3+: 3 rows (minimum)
   */
  calculateUsableRows(streak) {
    if (streak === 0) return 6; // Full rows when no streak
    if (streak === 1) return 5; // Remove 1 row after first win
    if (streak === 2) return 4; // Remove another row after second win
    return 3; // Minimum 3 rows for streak 3+
  }

  /**
   * Update difficulty based on current streak
   * @param {number} streak - Current player streak
   */
  updateDifficulty(streak) {
    console.log(`🎯 Updating difficulty for streak: ${streak}`);

    this.currentStreak = streak;
    const newUsableRows = this.calculateUsableRows(streak);

    if (newUsableRows !== this.usableRows) {
      this.usableRows = newUsableRows;
      // Don't apply restrictions immediately - wait for next game start
      console.log(`🎯 Difficulty calculated for next game: ${this.usableRows}/${this.maxRows} rows will be available`);
    }
  }

  /**
   * Apply visual restrictions to rows based on current difficulty
   */
  applyRowRestrictions() {
    const totalSquares = 30; // 6 rows × 5 columns
    const squaresPerRow = 5;
    const usableSquares = this.usableRows * squaresPerRow;

    console.log(`🎯 Applying restrictions: ${this.usableRows} rows (${usableSquares} squares) will be usable`);
    console.log(`🎯 Current streak: ${this.currentStreak}, usableRows: ${this.usableRows}`);

    // First, enable ALL squares to clear any previous disabled state
    for (let i = 1; i <= totalSquares; i++) {
      const square = document.getElementById(String(i));
      if (!square) {
        console.warn(`❌ Square ${i} not found`);
        continue;
      }
      this.enableSquare(square);
    }

    // Then disable squares that should be disabled
    for (let i = usableSquares + 1; i <= totalSquares; i++) {
      const square = document.getElementById(String(i));
      if (!square) {
        console.warn(`❌ Square ${i} not found`);
        continue;
      }
      this.disableSquare(square);
      console.log(`🎯 Disabled square ${i} (row ${Math.ceil(i/5)})`);
    }

    console.log(`🎯 Applied restrictions: ${usableSquares}/${totalSquares} squares available`);

    // Verify the application worked
    setTimeout(() => {
      const disabledCount = document.querySelectorAll('.square.disabled-square').length;
      const expectedDisabled = totalSquares - usableSquares;
      console.log(`🔍 Verification: ${disabledCount} squares disabled (expected: ${expectedDisabled})`);
    }, 100);
  }

  /**
   * Enable a game square
   */
  enableSquare(square) {
    square.classList.remove('disabled-square');
    square.style.pointerEvents = '';

    // DON'T clear styling if this square has already been guessed
    if (square.classList.contains('guessed') || square.dataset.result) {
      // This square has game content, don't modify its appearance
      console.log(`🎯 Skipping style reset for guessed square: ${square.id}`);
      return;
    }

    // Clear any background color that might have been set (only for empty squares)
    if (!square.textContent) {
      square.style.backgroundColor = '';
      square.style.color = '';

      // Reset to theme-appropriate border
      const isLightMode = document.querySelector("html").classList.contains("switch");
      if (isLightMode) {
        square.style.borderColor = "rgb(211, 214, 218)";
        square.classList.add("switch");
      } else {
        square.style.borderColor = "rgb(58, 58, 60)";
        square.classList.remove("switch");
      }
    }
  }

  /**
   * Disable a game square by making it blend with background
   */
  disableSquare(square) {
    // DON'T disable squares that have already been guessed
    if (square.classList.contains('guessed') || square.dataset.result || square.textContent) {
      console.log(`🎯 Not disabling guessed square: ${square.id}`);
      return;
    }

    square.classList.add('disabled-square');
    square.style.pointerEvents = 'none';
    square.textContent = '';

    // Make border match background color
    const isLightMode = document.querySelector("html").classList.contains("switch");
    const backgroundColor = isLightMode ? 'white' : 'black';

    square.style.borderColor = backgroundColor;
    square.style.backgroundColor = backgroundColor;
    square.style.color = backgroundColor;
  }

  /**
   * Check if a square ID is usable based on current difficulty
   */
  isSquareUsable(squareId) {
    const squareNum = parseInt(squareId);
    const usableSquares = this.usableRows * 5;
    return squareNum <= usableSquares;
  }

  /**
   * Get maximum allowed guesses based on current difficulty
   */
  getMaxGuesses() {
    return this.usableRows;
  }

  /**
   * Apply difficulty restrictions for a new game
   */
  applyDifficultyForNewGame() {
    this.applyRowRestrictions();
    this.saveDifficultyState(); // Save state whenever difficulty is applied
    console.log(`🎯 Applied difficulty for new game: ${this.usableRows}/${this.maxRows} rows available`);
  }

  /**
   * Apply pending delayed difficulty restrictions (called during timer reset)
   */
  applyDelayedDifficultyRestrictions() {
    if (this.pendingDelayedApplication) {
      console.log(`🎯 Applying delayed difficulty restrictions: ${this.usableRows}/${this.maxRows} rows available`);
      this.applyRowRestrictions();
      this.pendingDelayedApplication = false;
      this.saveDifficultyState();
      return true; // Indicates restrictions were applied
    }
    return false; // No pending restrictions
  }

  /**
   * Reset difficulty to default (6 rows)
   */
  resetDifficulty() {
    console.log("🎯 Resetting difficulty to default");
    this.currentStreak = 0;
    this.usableRows = 6;
    this.pendingDelayedApplication = false; // Clear any pending delayed applications

    // Clear saved state since we're resetting
    this.clearDifficultyState();

    // ✅ NEW: Save the reset state immediately to prevent override
    const resetState = {
      currentStreak: 0,
      usableRows: 6,
      pendingDelayedApplication: false,
      timestamp: Date.now(),
      wasReset: true  // Mark this as a reset state
    };
    localStorage.setItem('gameDifficultyState', JSON.stringify(resetState));
    console.log("💾 Saved reset state to prevent override:", resetState);

    // Immediately apply the reset (full 6 rows available)
    this.applyRowRestrictions();
    console.log("🎯 Difficulty reset complete: 6/6 rows available");
  }

  /**
   * Apply theme-specific styling to disabled squares
   */
  updateDisabledSquaresForTheme() {
    const disabledSquares = document.querySelectorAll('.disabled-square');
    const isLightMode = document.querySelector("html").classList.contains("switch");
    const backgroundColor = isLightMode ? 'white' : 'black';

    disabledSquares.forEach(square => {
      square.style.borderColor = backgroundColor;
      square.style.backgroundColor = backgroundColor;
      square.style.color = backgroundColor;
    });
  }

  /**
   * Initialize difficulty system - called when game starts
   */
  initialize() {
    // Add CSS for disabled squares
    this.addDisabledSquareStyles();

    // Try to restore difficulty state from localStorage
    this.restoreDifficultyState();

    console.log("🎯 Difficulty system initialized");
  }

  /**
   * Add CSS styles for disabled squares
   */
  addDisabledSquareStyles() {
    const existingStyle = document.getElementById('difficulty-styles');
    if (existingStyle) {
      existingStyle.remove();
    }

    const style = document.createElement('style');
    style.id = 'difficulty-styles';
    style.textContent = `
      .disabled-square {
        transition: all 0.3s ease;
        cursor: not-allowed !important;
        opacity: 0.3;
      }

      .disabled-square:hover {
        transform: none !important;
        background-color: inherit !important;
        border-color: inherit !important;
      }

      /* Ensure disabled squares blend with background in both themes */
      .disabled-square {
        background-color: black;
        border-color: black;
        color: black;
      }

      html.switch .disabled-square {
        background-color: white;
        border-color: white;
        color: white;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Update difficulty when streak data changes
   */
  handleStreakUpdate(streakData) {
    if (streakData && typeof streakData.currentStreak === 'number') {
      console.log(`🎯 Handling streak update: streak=${streakData.currentStreak}`);

      // ✅ NEW: Check if we have a recent reset that should not be overridden
      const stored = localStorage.getItem('gameDifficultyState');
      if (stored) {
        try {
          const state = JSON.parse(stored);
          const age = Date.now() - state.timestamp;

          // If reset was within last 30 seconds and streak data is same/lower, don't override
          if (state.wasReset && age < 30000 && streakData.currentStreak <= state.currentStreak) {
            console.log("🚫 Ignoring streak update - recent reset should take precedence");
            console.log(`📊 Reset state: ${state.currentStreak}, New streak: ${streakData.currentStreak}, Age: ${age}ms`);
            return;
          }
        } catch (error) {
          console.log("Error reading reset state:", error);
        }
      }

      const oldUsableRows = this.usableRows;

      // Always just update the difficulty calculation, never apply visual changes
      // ONLY the countdown timer should apply visual changes for both wins and losses
      this.updateDifficulty(streakData.currentStreak);

      if (this.usableRows !== oldUsableRows) {
        console.log(`🎯 Usable rows calculated to change from ${oldUsableRows} to ${this.usableRows} - countdown timer will apply`);
      }
    }
  }

  /**
   * Force apply current difficulty restrictions (for page reload scenarios)
   */
  forceApplyCurrentDifficulty() {
    this.applyRowRestrictions();
    console.log(`🎯 Force applied current difficulty: ${this.usableRows}/${this.maxRows} rows available`);
  }

  /**
   * Save difficulty state to localStorage
   */
  saveDifficultyState() {
    const state = {
      currentStreak: this.currentStreak,
      usableRows: this.usableRows,
      pendingDelayedApplication: this.pendingDelayedApplication,
      timestamp: Date.now()
    };
    localStorage.setItem('gameDifficultyState', JSON.stringify(state));
    console.log("💾 Saved difficulty state:", state);
  }

  /**
   * Restore difficulty state from localStorage
   */
  restoreDifficultyState() {
    try {
      const stored = localStorage.getItem('gameDifficultyState');
      if (!stored) return;

      const state = JSON.parse(stored);
      const age = Date.now() - state.timestamp;

      // Only restore if less than 24 hours old
      if (age < 24 * 60 * 60 * 1000) {
        this.currentStreak = state.currentStreak || 0;
        this.usableRows = state.usableRows || 6;
        this.pendingDelayedApplication = state.pendingDelayedApplication || false;

        console.log("🔄 Restored difficulty state:", state);

        // ✅ NEW: If this was a reset state, apply immediately and ensure it sticks
        if (state.wasReset) {
          console.log("🎯 Restored state was from a reset - ensuring 6 rows and applying immediately");
          this.currentStreak = 0;
          this.usableRows = 6;
          this.pendingDelayedApplication = false;

          setTimeout(() => {
            this.applyRowRestrictions();
            console.log("🎯 Reset state applied: 6/6 rows available");
          }, 100);
          return;
        }

        // Apply the restored difficulty if it's not the default (6 rows)
        setTimeout(() => {
          if (this.usableRows < 6) {
            console.log("🎯 Applying restored difficulty restrictions (non-default state)");
            this.applyRowRestrictions();
          } else {
            console.log("🎯 Restored difficulty is default (6 rows), no restrictions needed");
          }
        }, 500);
      } else {
        // Clear old state
        localStorage.removeItem('gameDifficultyState');
      }
    } catch (error) {
      console.error("❌ Error restoring difficulty state:", error);
      localStorage.removeItem('gameDifficultyState');
    }
  }

  /**
   * Clear difficulty state from localStorage
   */
  clearDifficultyState() {
    localStorage.removeItem('gameDifficultyState');
    console.log("🗑️ Cleared difficulty state from localStorage");
  }

  /**
   * Get current difficulty info
   */
  getDifficultyInfo() {
    return {
      currentStreak: this.currentStreak,
      usableRows: this.usableRows,
      maxRows: this.maxRows,
      minRows: this.minRows,
      maxGuesses: this.getMaxGuesses(),
      difficultyLevel: this.currentStreak === 0 ? 'Easy' :
                     this.currentStreak <= 2 ? 'Normal' :
                     this.currentStreak <= 4 ? 'Hard' : 'Expert'
    };
  }
}

// Create global instance
window.difficultyManager = new DifficultyManager();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (window.difficultyManager) {
      window.difficultyManager.initialize();
      console.log("🎯 Difficulty Manager ready");

      // Additional fallback: ensure difficulty is applied after full page load
      setTimeout(() => {
        if (window.difficultyManager.usableRows < 6) {
          console.log("🎯 Fallback: Ensuring difficulty restrictions are applied");
          window.difficultyManager.applyRowRestrictions();
        }
      }, 2000);
    }
  }, 500);
});

// Theme change integration
document.addEventListener('DOMContentLoaded', () => {
  // Listen for theme changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        if (window.difficultyManager) {
          setTimeout(() => {
            window.difficultyManager.updateDisabledSquaresForTheme();
          }, 100);
        }
      }
    });
  });

  // Observe html element for theme class changes
  const htmlElement = document.querySelector('html');
  if (htmlElement) {
    observer.observe(htmlElement, {
      attributes: true,
      attributeFilter: ['class']
    });
  }
});

// Debug functions
window.debugDifficulty = {
  testStreak(streak) {
    if (window.difficultyManager) {
      window.difficultyManager.updateDifficulty(streak);
      console.log(`🧪 Testing difficulty with streak: ${streak}`);
      console.log('Current difficulty:', window.difficultyManager.getDifficultyInfo());
    }
  },

  reset() {
    if (window.difficultyManager) {
      window.difficultyManager.resetDifficulty();
      console.log('🔄 Difficulty reset to default');
    }
  },

  getInfo() {
    if (window.difficultyManager) {
      const info = window.difficultyManager.getDifficultyInfo();
      console.table(info);
      return info;
    }
  },

  // Debug method to check square states
  checkSquareStates() {
    if (window.difficultyManager) {
      const totalSquares = 30;
      const usableSquares = window.difficultyManager.usableRows * 5;

      console.log(`🔍 Current difficulty: ${window.difficultyManager.usableRows} rows (${usableSquares} squares usable)`);

      let mismatches = [];
      for (let i = 1; i <= totalSquares; i++) {
        const square = document.getElementById(String(i));
        if (square) {
          const isDisabled = square.classList.contains('disabled-square');
          const shouldBeUsable = i <= usableSquares;
          const status = shouldBeUsable ? (isDisabled ? '❌ SHOULD BE ENABLED' : '✅ enabled')
                                       : (isDisabled ? '✅ disabled' : '❌ SHOULD BE DISABLED');

          if (status.includes('❌')) {
            mismatches.push(`Square ${i}: ${status}`);
          }

          // Also check visual appearance
          const bgColor = square.style.backgroundColor;
          const borderColor = square.style.borderColor;
          console.log(`Square ${i}: ${status} | bg: ${bgColor} | border: ${borderColor}`);
        }
      }

      if (mismatches.length > 0) {
        console.error("❌ Found mismatches:", mismatches);
      } else {
        console.log("✅ All squares have correct state");
      }
    }
  },

  // Force reapply difficulty (for debugging)
  forceReapply() {
    if (window.difficultyManager) {
      console.log("🔧 Force reapplying difficulty...");
      window.difficultyManager.applyRowRestrictions();
    }
  }
};

console.log("🎯 Difficulty Manager loaded. Debug commands:");
console.log("  window.debugDifficulty.testStreak(5) - Test with streak 5");
console.log("  window.debugDifficulty.reset() - Reset to default");
console.log("  window.debugDifficulty.getInfo() - Get difficulty info");