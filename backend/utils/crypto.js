const nacl = require("tweetnacl");
const bs58 = require("bs58");

class CryptoUtils {
  /**
   * Verify a Solana wallet signature
   * @param {string} walletAddress - Base58 encoded public key
   * @param {string} message - Original message that was signed
   * @param {Array|Uint8Array} signature - Signature bytes
   * @returns {boolean} - True if signature is valid
   */
  static verifyWalletSignature(walletAddress, message, signature) {
    try {
      console.log(`🔍 Verifying signature for wallet: ${walletAddress}`);
      console.log(`📄 Message: "${message}"`);
      console.log(`✍️ Signature length: ${signature?.length}`);

      if (!walletAddress || !message || !signature) {
        console.error(
          "❌ Missing required parameters for signature verification"
        );
        return false;
      }

      const messageBytes = new TextEncoder().encode(message);
      console.log(`📊 Message bytes length: ${messageBytes.length}`);

      const signatureBytes = Array.isArray(signature)
        ? new Uint8Array(signature)
        : signature;

      console.log(`🔢 Signature bytes length: ${signatureBytes.length}`);

      if (signatureBytes.length !== 64) {
        console.error(
          `❌ Invalid signature length: ${signatureBytes.length}, expected 64`
        );
        return false;
      }

      const publicKeyBytes = bs58.decode(walletAddress);
      console.log(`🔑 Public key bytes length: ${publicKeyBytes.length}`);

      if (publicKeyBytes.length !== 32) {
        console.error(
          `❌ Invalid public key length: ${publicKeyBytes.length}, expected 32`
        );
        return false;
      }

      const isValid = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKeyBytes
      );

      console.log(
        `${isValid ? "✅" : "❌"} Signature verification result: ${isValid}`
      );
      return isValid;
    } catch (error) {
      console.error("❌ Signature verification error:", error);
      return false;
    }
  }

  /**
   * ✅ FIXED: Validate timestamp with much more generous tolerance for gaming
   * @param {number} timestamp - Timestamp to validate
   * @param {number} maxAge - Maximum age in milliseconds (default 10 minutes)
   * @returns {boolean} - True if timestamp is valid
   */
  static validateTimestamp(timestamp, maxAge = 600000) {
    // ✅ CRITICAL FIX: Increased from 5 minutes to 10 minutes for gaming applications
    try {
      const now = Date.now();
      const age = Math.abs(now - timestamp);
      const isValid = age <= maxAge;

      // ✅ Enhanced timestamp debugging
      console.log(`⏰ Timestamp validation:`);
      console.log(`   Server time: ${now} (${new Date(now).toISOString()})`);
      console.log(
        `   Request time: ${timestamp} (${new Date(timestamp).toISOString()})`
      );
      console.log(`   Time difference: ${age}ms (${(age / 1000).toFixed(1)}s)`);
      console.log(
        `   Max allowed: ${maxAge}ms (${(maxAge / 1000).toFixed(1)}s)`
      );
      console.log(`   Is valid: ${isValid}`);

      // ✅ Special handling for future timestamps (common in development)
      if (timestamp > now && age < maxAge) {
        console.log(`⚠️ Future timestamp within tolerance - allowing`);
        return true;
      }

      // ✅ Check for obvious clock issues but don't fail immediately
      if (age > 86400000) {
        // More than 24 hours
        console.error(
          `❌ MAJOR CLOCK ISSUE: Time difference is ${(age / 3600000).toFixed(
            1
          )} hours!`
        );
        return false;
      }

      return isValid;
    } catch (error) {
      console.error("❌ Timestamp validation error:", error);
      return false;
    }
  }

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
    console.log(`📝 Backend created message: "${message}"`);
    return message;
  }

  /**
   * ✅ COMPLETELY REWRITTEN: More robust game action validation
   * @param {Object} params - Parameters object
   * @param {string} params.walletAddress - Wallet address
   * @param {string} params.action - Action type
   * @param {string} params.gameId - Game ID
   * @param {string} params.data - Action data
   * @param {number} params.timestamp - Timestamp
   * @param {Array} params.signature - Signature
   * @returns {boolean} - True if valid
   */
  static validateGameAction(params) {
    try {
      const { walletAddress, action, gameId, data, timestamp, signature } =
        params;

      console.log(`🔍 Validating game action:`);
      console.log(`   Action: ${action}`);
      console.log(`   Game ID: ${gameId}`);
      console.log(`   Data: ${data}`);
      console.log(`   Wallet: ${walletAddress}`);
      console.log(`   Timestamp: ${timestamp}`);

      // ✅ STEP 1: Check required parameters
      const missingParams = [];
      if (!walletAddress) missingParams.push("walletAddress");
      if (!action) missingParams.push("action");
      if (!gameId) missingParams.push("gameId");
      if (!data) missingParams.push("data");
      if (!timestamp) missingParams.push("timestamp");
      if (!signature) missingParams.push("signature");

      if (missingParams.length > 0) {
        console.error(
          `❌ Missing required parameters: ${missingParams.join(", ")}`
        );
        return false;
      }

      // ✅ STEP 2: Validate timestamp with generous tolerance
      console.log(`⏰ Validating timestamp with 10-minute tolerance...`);
      if (!this.validateTimestamp(timestamp, 600000)) {
        // 10 minutes
        console.error("❌ Timestamp validation failed");
        return false;
      }
      console.log("✅ Timestamp validation passed");

      // ✅ STEP 3: Create expected message with exact same format
      const expectedMessage = this.createGameMessage(
        action,
        gameId,
        data,
        timestamp
      );
      console.log(`📝 Expected message: "${expectedMessage}"`);

      // ✅ STEP 4: Verify signature
      console.log(`🔐 Verifying signature...`);
      const signatureValid = this.verifyWalletSignature(
        walletAddress,
        expectedMessage,
        signature
      );

      if (!signatureValid) {
        console.error("❌ Signature verification failed");
        console.error("Debug info:", {
          walletAddress,
          expectedMessage,
          signatureLength: signature?.length,
          messageLength: expectedMessage.length,
        });
        return false;
      }

      console.log("✅ Game action validation successful");
      return true;
    } catch (error) {
      console.error("❌ Game action validation error:", error);
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      return false;
    }
  }

  /**
   * ✅ NEW: Test signature validation (for debugging)
   * @param {string} walletAddress - Wallet address
   * @param {string} testMessage - Test message
   * @param {Array} signature - Signature to test
   * @returns {boolean} - True if valid
   */
  static testSignatureValidation(walletAddress, testMessage, signature) {
    console.log("🧪 Testing signature validation...");
    return this.verifyWalletSignature(walletAddress, testMessage, signature);
  }

  /**
   * ✅ NEW: Debug function to test timestamp validation separately
   * @param {number} timestamp - Timestamp to test
   * @returns {Object} - Detailed validation result
   */
  static debugTimestampValidation(timestamp) {
    const now = Date.now();
    const age = Math.abs(now - timestamp);
    const maxAge = 600000; // 10 minutes

    return {
      timestamp,
      timestampDate: new Date(timestamp).toISOString(),
      serverTime: now,
      serverTimeDate: new Date(now).toISOString(),
      ageDifference: age,
      ageDifferenceSeconds: (age / 1000).toFixed(1),
      maxAllowedAge: maxAge,
      maxAllowedSeconds: (maxAge / 1000).toFixed(1),
      isValid: age <= maxAge,
      isFuture: timestamp > now,
      isPast: timestamp < now,
    };
  }

  /**
   * ✅ NEW: Test complete game action validation with debug info
   * @param {Object} params - Same as validateGameAction
   * @returns {Object} - Detailed validation result
   */
  static debugGameActionValidation(params) {
    const result = {
      params,
      steps: [],
      overall: false,
    };

    try {
      // Step 1: Parameter check
      const { walletAddress, action, gameId, data, timestamp, signature } =
        params;
      const missingParams = [];
      if (!walletAddress) missingParams.push("walletAddress");
      if (!action) missingParams.push("action");
      if (!gameId) missingParams.push("gameId");
      if (!data) missingParams.push("data");
      if (!timestamp) missingParams.push("timestamp");
      if (!signature) missingParams.push("signature");

      result.steps.push({
        step: "Parameter validation",
        success: missingParams.length === 0,
        details:
          missingParams.length > 0
            ? `Missing: ${missingParams.join(", ")}`
            : "All parameters present",
      });

      if (missingParams.length > 0) return result;

      // Step 2: Timestamp validation
      const timestampResult = this.debugTimestampValidation(timestamp);
      result.steps.push({
        step: "Timestamp validation",
        success: timestampResult.isValid,
        details: timestampResult,
      });

      if (!timestampResult.isValid) return result;

      // Step 3: Message creation
      const expectedMessage = this.createGameMessage(
        action,
        gameId,
        data,
        timestamp
      );
      result.steps.push({
        step: "Message creation",
        success: true,
        details: { expectedMessage, length: expectedMessage.length },
      });

      // Step 4: Signature verification
      const signatureValid = this.verifyWalletSignature(
        walletAddress,
        expectedMessage,
        signature
      );
      result.steps.push({
        step: "Signature verification",
        success: signatureValid,
        details: {
          walletAddress,
          messageLength: expectedMessage.length,
          signatureLength: signature?.length,
          valid: signatureValid,
        },
      });

      result.overall = signatureValid;
      return result;
    } catch (error) {
      result.steps.push({
        step: "Error occurred",
        success: false,
        details: { error: error.message, stack: error.stack },
      });
      return result;
    }
  }
}

module.exports = CryptoUtils;
