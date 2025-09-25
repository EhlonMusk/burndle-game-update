const fs = require("fs");
const path = require("path");

class WordAssignment {
  constructor(database) {
    this.db = database;
    this.wordList = this.loadWordList();
    this.usedWords = new Set();
  }

  loadWordList() {
    try {
      const wordListPath = path.join(__dirname, "../wordlist.json");
      return JSON.parse(fs.readFileSync(wordListPath, "utf8"));
    } catch (error) {
      console.error("Error loading word list:", error);
      return [];
    }
  }

  async getRandomUnusedWord() {
    // Get all used words from the database
    const usedWords = await this.getAllUsedWords();
    const availableWords = this.wordList.filter((word) => !usedWords.has(word));

    if (availableWords.length === 0) {
      // Reset if all words have been used
      this.usedWords.clear();
      return this.wordList[Math.floor(Math.random() * this.wordList.length)];
    }

    return availableWords[Math.floor(Math.random() * availableWords.length)];
  }

  async getAllUsedWords() {
    return new Promise((resolve, reject) => {
      this.db.db.all(
        "SELECT DISTINCT word_answer FROM game_sessions",
        [],
        (err, rows) => {
          if (err) reject(err);
          else {
            const usedWords = new Set(rows.map((row) => row.word_answer));
            resolve(usedWords);
          }
        }
      );
    });
  }

  async assignWordToPlayer(walletAddress) {
    const word = await this.getRandomUnusedWord();
    await this.db.assignNextWord(walletAddress, word);
    return word;
  }

  async getPlayerSpecificWord(walletAddress) {
    // This ensures each player gets a different word every game
    const existingWord = await this.db.getPlayerNextWord(walletAddress);

    if (existingWord) {
      return existingWord;
    }

    // Get words already assigned to other players today
    const today = new Date().toISOString().split("T")[0];
    const assignedToday = await this.getWordsAssignedToday(today);

    // Find a word that hasn't been assigned to anyone today
    const availableWords = this.wordList.filter(
      (word) => !assignedToday.has(word)
    );

    if (availableWords.length === 0) {
      // Fallback to any available word
      return await this.getRandomUnusedWord();
    }

    const selectedWord =
      availableWords[Math.floor(Math.random() * availableWords.length)];
    await this.db.assignNextWord(walletAddress, selectedWord);

    return selectedWord;
  }

  async getWordsAssignedToday(date) {
    return new Promise((resolve, reject) => {
      this.db.db.all(
        "SELECT DISTINCT next_word FROM player_words WHERE assigned_date = ? AND used = FALSE",
        [date],
        (err, rows) => {
          if (err) reject(err);
          else {
            const assignedWords = new Set(rows.map((row) => row.next_word));
            resolve(assignedWords);
          }
        }
      );
    });
  }
}

module.exports = WordAssignment;
