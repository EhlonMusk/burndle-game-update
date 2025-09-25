// backend/utils/gameEngine.js - Fixed version without circular reference
const fs = require("fs");
const path = require("path");
const storage = require("../data/storage");

class GameEngine {
  constructor() {
    // Load valid words for validation
    this.validWords = this.loadValidWords();
    this.answerWords = this.loadAnswerWords();
  }

  /**
   * Load valid words for guess validation
   */
  loadValidWords() {
    try {
      const validWordsPath = path.join(__dirname, "../valid_words.json");

      if (fs.existsSync(validWordsPath)) {
        const validWords = new Set(
          JSON.parse(fs.readFileSync(validWordsPath, "utf8"))
            .map((w) => w.replace(/[^a-zA-Z]/g, "").toLowerCase())
            .filter((w) => w.length === 5)
        );

        console.log(`📚 Loaded ${validWords.size} valid words for validation`);
        return validWords;
      } else {
        console.warn("⚠️ valid_words.json not found, using basic validation");
        return new Set();
      }
    } catch (error) {
      console.error("Error loading valid words:", error);
      return new Set();
    }
  }

  /**
   * Load answer words (potential game answers)
   */
  loadAnswerWords() {
    try {
      const wordListPath = path.join(__dirname, "../wordlist.json");

      if (fs.existsSync(wordListPath)) {
        const answerWords = JSON.parse(fs.readFileSync(wordListPath, "utf8"))
          .map((w) => w.replace(/[^a-zA-Z]/g, "").toLowerCase())
          .filter((w) => w.length === 5);

        console.log(`🎯 Loaded ${answerWords.length} potential answer words`);
        return answerWords;
      } else {
        console.warn("⚠️ wordlist.json not found, using fallback words");
        return this.getFallbackWords();
      }
    } catch (error) {
      console.error("Error loading answer words:", error);
      return this.getFallbackWords();
    }
  }

  /**
   * Get fallback words if files are missing
   */
  getFallbackWords() {
    return [
      "apple",
      "brave",
      "cloud",
      "dance",
      "eagle",
      "flame",
      "grace",
      "happy",
      "input",
      "jolly",
      "karma",
      "light",
      "magic",
      "noble",
      "ocean",
      "peace",
      "quiet",
      "royal",
      "smart",
      "trust",
      "unity",
      "voice",
      "worth",
      "youth",
      "zebra",
      "amber",
      "blaze",
      "charm",
      "dream",
      "exact",
      "frost",
      "giant",
      "house",
      "ivory",
      "judge",
      "knife",
      "lemon",
      "mouse",
      "night",
      "olive",
    ];
  }

  /**
   * ✅ Create a new game with assigned or random word
   * @param {string} walletAddress - Player's wallet address
   * @returns {Object} - Game object
   */
  createGame(walletAddress, maxGuesses = 6) {
    try {
      const gameId = this.generateGameId();

      // ✅ Get assigned word if available, otherwise random
      const answer = this.getWordForPlayer(walletAddress);

      const game = {
        gameId,
        walletAddress,
        answer: answer.toLowerCase(),
        guesses: [],
        isComplete: false,
        isWin: false,
        startTime: Date.now(),
        maxGuesses: maxGuesses,
      };

      console.log(
        `🎮 Game created for ${walletAddress.slice(
          0,
          8
        )}...: ${gameId} (word: ${answer})`
      );
      return game;
    } catch (error) {
      console.error("Error creating game:", error);
      throw new Error("Failed to create game");
    }
  }

  /**
   * ✅ Get word for player (assigned first, then random)
   * @param {string} walletAddress - Player's wallet address
   * @returns {string} - Word to use
   */
  getWordForPlayer(walletAddress) {
    // Check if player has assigned words
    const assignedWords = storage.getAssignedWords();
    const playerWords = assignedWords[walletAddress] || [];
    const nextAssignedWord = playerWords.find((w) => !w.used);

    if (nextAssignedWord) {
      console.log(
        `📝 Using assigned word "${
          nextAssignedWord.word
        }" for ${walletAddress.slice(0, 8)}...`
      );
      return nextAssignedWord.word;
    }

    // Fall back to random word selection
    const randomWord = this.getRandomWord();
    console.log(
      `🎲 Using random word "${randomWord}" for ${walletAddress.slice(0, 8)}...`
    );
    return randomWord;
  }

  /**
   * ✅ Get random word from answer list
   * @returns {string} - Random word
   */
  getRandomWord() {
    if (this.answerWords.length === 0) {
      return this.getFallbackWords()[0]; // Emergency fallback
    }

    return this.answerWords[
      Math.floor(Math.random() * this.answerWords.length)
    ];
  }

  /**
   * Generate unique game ID
   * @returns {string} - Unique game ID
   */
  generateGameId() {
    return (
      Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
    );
  }

  /**
   * ✅ Process a guess with storage integration
   * @param {Object} game - Game object
   * @param {string} guess - Player's guess
   * @returns {Object} - Result object
   */
  async processGuess(game, guess) {
    const guessLower = guess.toLowerCase();
    const answer = game.answer;

    console.log(
      `🎯 Processing guess: "${guessLower}" against answer: "${answer}"`
    );

    // Validate guess
    if (guessLower.length !== 5) {
      throw new Error("Guess must be exactly 5 letters");
    }

    if (!/^[a-z]+$/.test(guessLower)) {
      throw new Error("Guess must contain only letters");
    }

    if (game.isComplete) {
      throw new Error("Game already completed");
    }

    if (game.guesses.length >= game.maxGuesses) {
      throw new Error("No more guesses allowed");
    }

    // Validate against word list if available
    if (this.validWords.size > 0) {
      // Check if it's in valid words OR in answer words
      if (!this.validWords.has(guessLower) && !this.answerWords.includes(guessLower)) {
        throw new Error("Not a valid word");
      }
    }

    // ✅ CRITICAL: Calculate result using checkGuess
    console.log(`🎲 Calling checkGuess with: "${guessLower}", "${answer}"`);
    const result = this.checkGuess(guessLower, answer);
    console.log(`📊 checkGuess returned:`, result);

    // ✅ VALIDATION: Ensure result is valid
    if (!result || !Array.isArray(result) || result.length !== 5) {
      console.error("❌ CRITICAL: checkGuess returned invalid result:", {
        result,
        isArray: Array.isArray(result),
        length: result?.length,
      });
      throw new Error("Invalid result from checkGuess function");
    }

    // Add guess to game
    game.guesses.push({
      guess: guessLower,
      result,
      timestamp: Date.now(),
    });

    console.log(
      `📝 Added guess to game. Total guesses: ${game.guesses.length}`
    );

    // Check win condition
    if (guessLower === answer) {
      game.isComplete = true;
      game.isWin = true;
      console.log("🎉 Player won!");
    } else if (game.guesses.length >= game.maxGuesses) {
      game.isComplete = true;
      game.isWin = false;
      console.log("💔 Player lost - out of guesses");
    }

    // ✅ Record game completion in storage
    if (game.isComplete) {
      await this.recordGameCompletion(game);
    }

    const responseResult = {
      result, // This is the array from checkGuess
      isWin: game.isWin,
      isGameOver: game.isComplete && !game.isWin,
      answer: game.isComplete ? game.answer.toUpperCase() : undefined,
      guessesRemaining: game.maxGuesses - game.guesses.length,
      guessCount: game.guesses.length,
    };

    console.log(`📤 processGuess returning:`, responseResult);
    return responseResult;
  }

  /**
   * ✅ CRITICAL: Check guess against answer - this is the core logic
   * @param {string} guess - Player's guess
   * @param {string} answer - Correct answer
   * @returns {Array} - Array of results ('correct', 'present', 'absent')
   */
  checkGuess(guess, answer) {
    console.log(
      `🔍 checkGuess called with: guess="${guess}", answer="${answer}"`
    );

    if (!guess || !answer) {
      console.error("❌ checkGuess: Missing guess or answer");
      return ["absent", "absent", "absent", "absent", "absent"];
    }

    if (guess.length !== 5 || answer.length !== 5) {
      console.error("❌ checkGuess: Invalid lengths", {
        guessLength: guess.length,
        answerLength: answer.length,
      });
      return ["absent", "absent", "absent", "absent", "absent"];
    }

    const result = [];
    const answerArray = answer.split("");
    const guessArray = guess.split("");

    // Track used letters in answer for yellow/gray logic
    const answerLetterCount = {};
    answerArray.forEach((letter) => {
      answerLetterCount[letter] = (answerLetterCount[letter] || 0) + 1;
    });

    console.log(`📊 Answer letter counts:`, answerLetterCount);

    // First pass: find all green (correct position) letters
    for (let i = 0; i < 5; i++) {
      if (guessArray[i] === answerArray[i]) {
        result[i] = "correct"; // Green
        answerLetterCount[guessArray[i]]--;
        console.log(`✅ Position ${i}: "${guessArray[i]}" is correct`);
      }
    }

    // Second pass: find yellow (wrong position) and gray (not in word) letters
    for (let i = 0; i < 5; i++) {
      if (result[i]) continue; // Already marked as green

      if (answerLetterCount[guessArray[i]] > 0) {
        result[i] = "present"; // Yellow
        answerLetterCount[guessArray[i]]--;
        console.log(
          `🟨 Position ${i}: "${guessArray[i]}" is present elsewhere`
        );
      } else {
        result[i] = "absent"; // Gray
        console.log(`⬜ Position ${i}: "${guessArray[i]}" is absent`);
      }
    }

    console.log(`🎯 Final result for "${guess}" vs "${answer}":`, result);

    // ✅ VALIDATION: Ensure we return exactly 5 valid results
    if (!Array.isArray(result) || result.length !== 5) {
      console.error("❌ CRITICAL: checkGuess result validation failed", {
        result,
        length: result?.length,
        isArray: Array.isArray(result),
      });
      return ["absent", "absent", "absent", "absent", "absent"];
    }

    const validValues = ["correct", "present", "absent"];
    const allValid = result.every((item) => validValues.includes(item));
    if (!allValid) {
      console.error("❌ CRITICAL: checkGuess result contains invalid values", {
        result,
        validValues,
      });
      return ["absent", "absent", "absent", "absent", "absent"];
    }

    return result;
  }

  /**
   * ✅ Record game completion in storage (instead of database)
   * @param {Object} game - Completed game object
   */
  async recordGameCompletion(game) {
    console.log(`🎯 GAME ENGINE: recordGameCompletion called for ${game.walletAddress.slice(0, 8)}...`);
    try {
      // ✅ ALWAYS: Save completed game to period storage with full data
      // This ensures the complete game data persists for tile restoration
      console.log(
        `💾 Saving completed game to period storage for ${game.walletAddress.slice(0, 8)}...`
      );

      storage.markPlayedToday(game.walletAddress, {
        gameId: game.gameId,
        isWin: game.isWin,
        isComplete: true,
        answer: game.answer,
        guesses: game.guesses,
        maxGuesses: game.maxGuesses,
        startTime: game.startTime,
        completedAt: Date.now(),
      });

      // ✅ NEW: Calculate and update streaks immediately when game completes
      await this.updatePlayerStreak(game);

      // ✅ Mark assigned word as used if it was assigned
      const wasAssignedWord = storage.markAssignedWordAsUsed(
        game.walletAddress,
        game.answer
      );

      if (wasAssignedWord) {
        console.log(
          `✅ Marked assigned word "${
            game.answer
          }" as used for ${game.walletAddress.slice(0, 8)}...`
        );

        // ✅ Broadcast word usage to WebSocket clients if available
        if (global.broadcastToAdmins) {
          global.broadcastToAdmins("word-used", {
            walletAddress: game.walletAddress,
            word: game.answer,
            isWin: game.isWin,
            guessCount: game.guesses.length,
            timestamp: new Date().toISOString(),
          });
        }
      }

      console.log(
        `🏁 Game completion recorded for ${game.walletAddress.slice(
          0,
          8
        )}...: ${game.isWin ? "WIN" : "LOSS"} in ${game.guesses.length} guesses`
      );
    } catch (error) {
      console.error("Error recording game completion:", error);
      // Don't throw error here to avoid breaking the game flow
      // The game can still complete successfully even if recording fails
    }
  }

  /**
   * ✅ NEW: Update player streak when game completes
   * @param {Object} game - Completed game object
   */
  async updatePlayerStreak(game) {
    try {
      const { walletAddress, isWin, gameId } = game;

      console.log(`🔥 Updating streak for ${walletAddress.slice(0, 8)}...: ${isWin ? 'WIN' : 'LOSS'}`);

      const streakData = storage.getStreakData(walletAddress);
      const oldStreak = streakData.currentStreak;
      const today = storage.getTodayString(); // Current period

      // Update basic stats
      streakData.gamesPlayed += 1;
      if (isWin) {
        streakData.gamesWon += 1;
      }
      streakData.winRate = Math.round(
        (streakData.gamesWon / streakData.gamesPlayed) * 100
      );

      // Handle streak logic
      const lastPlayedDate = streakData.lastPlayedDate;

      console.log(`🔥 Streak calculation for ${walletAddress.slice(0, 8)}...:`);
      console.log(`  - lastPlayedDate: ${lastPlayedDate}`);
      console.log(`  - today: ${today}`);
      console.log(`  - isWin: ${isWin}`);
      console.log(`  - currentStreak: ${streakData.currentStreak}`);

      if (isWin) {
        if (!lastPlayedDate) {
          // First time playing
          streakData.currentStreak = 1;
          console.log(`  ✅ First win - streak set to 1`);
        } else {
          // Any win should continue/increment the streak
          streakData.currentStreak += 1;
          console.log(`  ✅ Win - streak incremented to ${streakData.currentStreak}`);
        }

        if (streakData.currentStreak > streakData.maxStreak) {
          streakData.maxStreak = streakData.currentStreak;
        }
      } else {
        // Lost the game
        const oldStreak = streakData.currentStreak;
        streakData.currentStreak = 0;
        console.log(`  💔 Game lost - streak reset from ${oldStreak} to 0`);
      }

      streakData.lastPlayedDate = today; // Current period
      storage.saveStreakData(walletAddress, streakData);

      // ✅ WEBSOCKET: Broadcast streak update to admins
      if (global.broadcastToAdmins) {
        global.broadcastToAdmins("streak-updated", {
          walletAddress,
          oldStreak,
          newStreak: streakData.currentStreak,
          isWin,
          gameResult: isWin ? "win" : "loss",
          timestamp: new Date().toISOString(),
          period: today,
        });
      }

      console.log(`🔥 Streak updated: ${oldStreak} → ${streakData.currentStreak}`);

    } catch (error) {
      console.error("Error updating player streak:", error);
      // Don't throw - streak calculation failure shouldn't break game completion
    }
  }

  /**
   * ✅ NEW: Handle incomplete game streak reset
   * @param {string} walletAddress - Player's wallet address
   * @returns {Object} - Streak reset result
   */
  async handleIncompleteGameStreakReset(walletAddress) {
    try {
      console.log(`💔 Handling incomplete game streak reset for ${walletAddress.slice(0, 8)}...`);

      const streakData = storage.getStreakData(walletAddress);
      const oldStreak = streakData.currentStreak;

      // Reset streak to 0 for incomplete game
      streakData.currentStreak = 0;

      // Update last played date to current period
      const today = storage.getTodayString();
      streakData.lastPlayedDate = today;

      // Save the updated streak data
      storage.setStreakData(walletAddress, streakData);

      // ✅ WEBSOCKET: Broadcast streak reset to admins
      if (global.broadcastToAdmins) {
        global.broadcastToAdmins("streak-updated", {
          walletAddress,
          oldStreak,
          newStreak: 0,
          isWin: false,
          gameResult: "incomplete",
          timestamp: new Date().toISOString(),
          period: today,
        });
      }

      console.log(`💔 Streak reset due to incomplete game: ${oldStreak} → 0`);

      return {
        success: true,
        oldStreak,
        newStreak: 0,
        reason: "incomplete_game"
      };

    } catch (error) {
      console.error("Error handling incomplete game streak reset:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate game sequence (prevent cheating)
   * @param {Object} game - Game object
   * @param {string} guess - New guess
   * @returns {boolean} - True if sequence is valid
   */
  validateGameSequence(game, guess) {
    // Check timing (prevent too fast guesses)
    const lastGuess = game.guesses[game.guesses.length - 1];
    if (lastGuess && Date.now() - lastGuess.timestamp < 500) {
      return false; // Minimum 0.5 seconds between guesses
    }

    // Check maximum game duration (prevent stale games)
    if (Date.now() - game.startTime > 30 * 60 * 1000) {
      // 30 minutes
      return false;
    }

    return true;
  }

  // Additional utility methods for completeness...

  /**
   * ✅ Get player statistics from storage
   */
  getPlayerStats(walletAddress) {
    try {
      const streakData = storage.getStreakData(walletAddress);
      const assignedWords = storage.getAssignedWords();
      const playerWords = assignedWords[walletAddress] || [];

      return {
        wallet_address: walletAddress,
        current_streak: streakData.currentStreak || 0,
        max_streak: streakData.maxStreak || 0,
        total_games_played: streakData.gamesPlayed || 0,
        total_games_won: streakData.gamesWon || 0,
        last_played_date: streakData.lastPlayedDate || "Never",
        assigned_words: playerWords,
        next_word: playerWords.find((w) => !w.used)?.word || "Random",
      };
    } catch (error) {
      console.error("Error getting player stats:", error);
      return null;
    }
  }

  /**
   * ✅ Check if word is valid for guessing
   */
  isValidWord(word) {
    const lowerWord = word.toLowerCase();

    // If we have a valid words list, check it
    if (this.validWords.size > 0) {
      return this.validWords.has(lowerWord);
    }

    // If no valid words list, check if it's in answer words
    return this.answerWords.includes(lowerWord);
  }
}

// ✅ IMPORTANT: Export the class, don't create an instance here
module.exports = GameEngine;
