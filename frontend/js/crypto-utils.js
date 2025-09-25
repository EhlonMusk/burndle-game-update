// Frontend crypto utilities for wallet signatures - FIXED VERSION with better timestamp handling

class CryptoUtils {
  /**
   * Create a game message for signing
   * @param {string} action - Action type (start, guess, complete)
   * @param {string} gameId - Game ID
   * @param {string} data - Additional data
   * @param {number} timestamp - Timestamp
   * @returns {string} - Message to sign
   */
  static createGameMessage(action, gameId, data, timestamp) {
    const message = `BURNdle-${action}-${gameId}-${data}-${timestamp}`;

    return message;
  }

  /**
   * ✅ FIXED: Sign a game action with better timestamp handling
   * @param {string} action - Action type
   * @param {string} gameId - Game ID
   * @param {string} data - Action data
   * @returns {Object} - Signed data object
   */
  static async signGameAction(action, gameId, data) {
    if (!window.solana || !window.solana.isConnected) {
      throw new Error("Wallet not connected");
    }

    // ✅ CRITICAL FIX: Use current time instead of future timestamp
    const timestamp = Date.now(); // Remove the multiplication that was causing future dates
    const currentTime = new Date().toISOString();

    console.log(`⏰ Using current timestamp: ${timestamp} (${currentTime})`);

    const message = this.createGameMessage(action, gameId, data, timestamp);

    try {
      const encoder = new TextEncoder();
      const messageBytes = encoder.encode(message);

      const signatureResult = await window.solana.signMessage(messageBytes);

      console.log(`🔑 Public key: ${signatureResult.publicKey.toString()}`);
      console.log(
        `✍️ Signature array length: ${signatureResult.signature.length}`
      );

      const result = {
        message,
        timestamp,
        signature: Array.from(signatureResult.signature),
        publicKey: signatureResult.publicKey.toString(),
      };

      return result;
    } catch (error) {
      console.error("❌ Signing failed:", error);
      throw new Error(`Failed to sign message: ${error.message}`);
    }
  }

  /**
   * ✅ FIXED: Sign game start action
   * @param {string} walletAddress - Wallet address
   * @returns {Object} - Signed start game data
   */
  static async signStartGame(walletAddress) {
    return this.signGameAction("start", "new", walletAddress);
  }

  /**
   * ✅ FIXED: Sign guess action
   * @param {string} gameId - Game ID
   * @param {string} guess - Player's guess
   * @returns {Object} - Signed guess data
   */
  static async signGuess(gameId, guess) {
    const normalizedGuess = guess.toLowerCase().trim();

    return this.signGameAction("guess", gameId, normalizedGuess);
  }

  /**
   * Show signing prompt to user
   * @param {string} action - Action being signed
   */
  static showSigningPrompt(action) {
    if (window.showToast) {
      showToast(`Please sign the ${action} in your wallet`, "info", 3000);
    }
  }

  /**
   * Handle signing errors
   * @param {Error} error - Error that occurred
   * @param {string} action - Action that failed
   */
  static handleSigningError(error, action) {
    console.error(`❌ ${action} signing error:`, error);

    if (window.showToast) {
      if (error.message && error.message.includes("User rejected")) {
        showToast(`${action} cancelled by user`, "warning", 3000);
      } else if (error.message && error.message.includes("Invalid signature")) {
        showToast(
          `Signature verification failed. Please try again.`,
          "error",
          4000
        );
      } else {
        showToast(`Failed to sign ${action}. Please try again.`, "error", 3000);
      }
    }
  }

  /**
   * ✅ NEW: Test signature creation (for debugging)
   * @param {string} testMessage - Test message
   * @returns {Object} - Test signature result
   */
  static async testSignature(testMessage = "BURNdle-test-message") {
    if (!window.solana || !window.solana.isConnected) {
      throw new Error("Wallet not connected for test");
    }

    try {
      const encoder = new TextEncoder();
      const messageBytes = encoder.encode(testMessage);
      const signatureResult = await window.solana.signMessage(messageBytes);

      const result = {
        testMessage,
        messageBytes: Array.from(messageBytes),
        signature: Array.from(signatureResult.signature),
        publicKey: signatureResult.publicKey.toString(),
        timestamp: Date.now(),
      };

      return result;
    } catch (error) {
      console.error("❌ Test signature failed:", error);
      throw error;
    }
  }

  /**
   * ✅ NEW: Get current timestamp for debugging
   * @returns {Object} - Current time info
   */
  static getCurrentTimeInfo() {
    const now = Date.now();
    return {
      timestamp: now,
      date: new Date(now).toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
    };
  }

  /**
   * ✅ NEW: Test complete signing flow
   * @returns {Object} - Test results
   */
  static async testCompleteFlow() {
    if (!window.solana || !window.solana.isConnected) {
      throw new Error("Wallet not connected");
    }

    try {
      const walletAddress = window.solana.publicKey.toString();
      const timeInfo = this.getCurrentTimeInfo();

      // Test start game signing

      const startResult = await this.signStartGame(walletAddress);

      // Test guess signing

      const guessResult = await this.signGuess("test-game-123", "hello");

      const results = {
        success: true,
        timeInfo,
        walletAddress,
        startGameTest: startResult,
        guessTest: guessResult,
        timestamps: {
          start: startResult.timestamp,
          guess: guessResult.timestamp,
          difference: guessResult.timestamp - startResult.timestamp,
        },
      };

      return results;
    } catch (error) {
      console.error("❌ Complete flow test failed:", error);
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  /**
   * ✅ NEW: Validate timestamp is reasonable (client-side check)
   * @param {number} timestamp - Timestamp to check
   * @returns {boolean} - True if timestamp seems valid
   */
  static isTimestampValid(timestamp) {
    const now = Date.now();
    const age = Math.abs(now - timestamp);
    const maxAge = 600000; // 10 minutes

    const isValid = age <= maxAge;

    if (!isValid) {
      console.warn(
        `⏰ Timestamp validation failed - Age: ${age}ms, Max: ${maxAge}ms`
      );
    }

    return isValid;
  }
}

// Make available globally
window.CryptoUtils = CryptoUtils;

// ✅ ADD: Enhanced global debug functions
window.debugCrypto = {
  async testWalletConnection() {
    console.log("Public key:", window.solana?.publicKey?.toString());

    return {
      hasSolana: !!window.solana,
      isConnected: window.solana?.isConnected || false,
      publicKey: window.solana?.publicKey?.toString() || null,
      isPhantom: window.solana?.isPhantom || false,
    };
  },

  async testSignature() {
    try {
      const result = await CryptoUtils.testSignature();

      return result;
    } catch (error) {
      console.error("❌ Signature test failed:", error);
      return { success: false, error: error.message };
    }
  },

  async testCompleteFlow() {
    try {
      const result = await CryptoUtils.testCompleteFlow();

      return result;
    } catch (error) {
      console.error("❌ Complete flow test failed:", error);
      return { success: false, error: error.message };
    }
  },

  getCurrentTimeInfo() {
    const info = CryptoUtils.getCurrentTimeInfo();

    return info;
  },

  async testGameSignature() {
    try {
      if (!window.isWalletConnected()) {
        console.error("❌ Wallet not connected");
        return { success: false, error: "Wallet not connected" };
      }

      const walletAddress = window.getWalletPublicKey().toString();
      const result = await CryptoUtils.signStartGame(walletAddress);

      return { success: true, result };
    } catch (error) {
      console.error("❌ Game signature test failed:", error);
      return { success: false, error: error.message };
    }
  },
};

console.log(
  "🔐 Enhanced CryptoUtils loaded with debugging tools and fixed timestamps"
);
console.log("💡 Use window.debugCrypto.testCompleteFlow() to test everything");
console.log(
  "💡 Use window.debugCrypto.getCurrentTimeInfo() to check current time"
);
