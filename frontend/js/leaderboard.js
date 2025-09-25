// ============================== LEADERBOARD MAIN FUNCTIONALITY ==============================
// frontend/js/leaderboard-main.js - Core leaderboard functionality

class LeaderboardManager {
  constructor() {
    this.API_BASE = "http://localhost:3000/api";
    this.allPlayers = [];
    this.filteredPlayers = [];
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.searchTerm = "";
    this.isLoading = false;
    this.currentPlayerAddress = null;
    this.initialized = false;
  }

  // ✅ Initialize the leaderboard system
  async initialize() {
    if (this.initialized) return;

    // Ensure modal exists in DOM
    this.ensureModalExists();

    // Setup event listeners
    this.setupEventListeners();

    this.initialized = true;
  }

  // ✅ Ensure modal exists in DOM
  ensureModalExists() {
    if (!document.getElementById("leaderboard-modal")) {
      const modalHTML = `
        <div id="leaderboard-modal" class="leaderboard-modal">
          <div class="leaderboard-content">
            <div class="leaderboard-header">
              <button class="leaderboard-close" onclick="window.leaderboardManager.closeLeaderboard()">&times;</button>
              <h2 class="leaderboard-title">🏆 Leaderboard</h2>
              <p class="leaderboard-subtitle">Top players by highest streak</p>
            </div>

            <div class="leaderboard-search">
              <div class="search-container">
                <span class="search-icon">🔍</span>
                <input 
                  type="text" 
                  id="leaderboard-search-input" 
                  class="search-input" 
                  placeholder="Search wallet address..."
                  autocomplete="off"
                  spellcheck="false"
                  style="pointer-events: auto; user-select: text; -webkit-user-select: text;"
                >
              </div>
              <div id="search-results-info" class="search-results-info" style="display: none;"></div>
            </div>

            <div id="leaderboard-list" class="leaderboard-list">
              <!-- Leaderboard items will be populated here -->
            </div>

            <div class="leaderboard-pagination">
              <button id="leaderboard-prev-btn" class="pagination-btn" disabled>
                ← Previous
              </button>
              <div id="leaderboard-pagination-info" class="pagination-info">
                Page 1 of 1
              </div>
              <button id="leaderboard-next-btn" class="pagination-btn" disabled>
                Next →
              </button>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML("beforeend", modalHTML);
    } else {
    }
  }

  // ✅ Setup event listeners
  setupEventListeners() {
    // Search input with proper event handling
    const searchInput = document.getElementById("leaderboard-search-input");
    if (searchInput) {
      // Handle input changes
      searchInput.addEventListener("input", (e) => {
        this.handleSearchInput(e.target.value);
      });

      // ✅ FIX: Prevent game keyboard interference
      searchInput.addEventListener("keydown", (e) => {
        // Stop the event from reaching the game's keyboard handler
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Allow normal input behavior
        if (e.key === "Escape") {
          // ESC to clear search or close modal
          if (searchInput.value) {
            searchInput.value = "";
            this.handleSearchInput("");
          } else {
            this.closeLeaderboard();
          }
        }
      });

      // ✅ FIX: Also prevent keypress and keyup interference
      searchInput.addEventListener("keypress", (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
      });

      searchInput.addEventListener("keyup", (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
      });

      // ✅ FIX: Focus handling
      searchInput.addEventListener("focus", (e) => {
        e.stopPropagation();
      });

      searchInput.addEventListener("blur", (e) => {
        e.stopPropagation();
      });
    }

    // Pagination buttons
    const prevBtn = document.getElementById("leaderboard-prev-btn");
    const nextBtn = document.getElementById("leaderboard-next-btn");

    if (prevBtn) {
      prevBtn.addEventListener("click", () => this.previousPage());
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => this.nextPage());
    }

    // Modal close events
    document.addEventListener("keydown", (e) => {
      // Only handle ESC if modal is open and no input is focused
      if (e.key === "Escape" && this.isModalOpen()) {
        const focusedElement = document.activeElement;
        if (!focusedElement || focusedElement.tagName !== "INPUT") {
          e.preventDefault();
          e.stopPropagation();
          this.closeLeaderboard();
        }
      }
    });

    // Close on outside click
    document.addEventListener("click", (e) => {
      const modal = document.getElementById("leaderboard-modal");
      if (e.target === modal) {
        this.closeLeaderboard();
      }
    });
  }

  // ✅ Check if modal is open
  isModalOpen() {
    return document
      .getElementById("leaderboard-modal")
      ?.classList.contains("show");
  }

  // ✅ Open leaderboard modal
  async openLeaderboard() {
    // Initialize if not already done
    if (!this.initialized) {
      await this.initialize();
    }

    const modal = document.getElementById("leaderboard-modal");
    if (!modal) {
      console.error("❌ Leaderboard modal not found");
      return;
    }

    // Show modal
    modal.classList.add("show");

    // Update theme
    this.updateTheme();

    // Get current player address if available
    this.currentPlayerAddress = this.getCurrentPlayerAddress();

    // Load leaderboard data
    await this.loadLeaderboardData();

    // Focus search input after animation
    setTimeout(() => {
      const searchInput = document.getElementById("leaderboard-search-input");
      if (searchInput) {
        searchInput.focus();
      }
    }, 300);
  }

  // ✅ Close leaderboard modal
  closeLeaderboard() {
    const modal = document.getElementById("leaderboard-modal");
    if (modal) {
      modal.classList.remove("show");
    }

    // Reset search
    this.resetSearch();
  }

  // ✅ Get current player wallet address
  getCurrentPlayerAddress() {
    try {
      if (
        window.isWalletConnected &&
        window.isWalletConnected() &&
        window.getWalletPublicKey
      ) {
        return window.getWalletPublicKey().toString();
      }
    } catch (error) {
      console.warn("Could not get current player address:", error);
    }
    return null;
  }

  // ✅ Load leaderboard data from API
  async loadLeaderboardData() {
    if (this.isLoading) return;

    this.showLoading();

    try {
      // Try multiple endpoints to get player data
      let players = await this.fetchPlayersData();

      if (!players || players.length === 0) {
        throw new Error("No leaderboard data available");
      }

      // Transform and sort data
      this.allPlayers = this.transformPlayerData(players);
      this.sortPlayers();

      // Apply current search and refresh display
      this.applySearch();
    } catch (error) {
      console.error("❌ Error loading leaderboard:", error);
      this.showError("Failed to load leaderboard data");
    } finally {
      this.hideLoading();
    }
  }

  // ✅ Fetch players data from various endpoints
  async fetchPlayersData() {
    const endpoints = [
      "/leaderboard",
      "/admin/players",
      "/admin/players-enhanced",
    ];

    for (const endpoint of endpoints) {
      try {
        // ✅ FIX: Add cache busting to ensure fresh data after admin resets
        const timestamp = new Date().getTime();
        const response = await fetch(`${this.API_BASE}${endpoint}?_t=${timestamp}`, {
          cache: 'no-cache'
        });
        const data = await response.json();

        if (data.success && data.data && data.data.length > 0) {
          console.log(
            `✅ Got data from ${endpoint}: ${data.data.length} players`
          );
          return data.data;
        }
      } catch (error) {
        console.warn(`⚠️ Failed to fetch from ${endpoint}:`, error);
        continue;
      }
    }

    throw new Error("All leaderboard endpoints failed");
  }

  // ✅ Transform player data to consistent format
  transformPlayerData(players) {
    const transformedPlayers = players.map((player, globalIndex) => {
      // Handle different API response formats
      const wallet =
        player.wallet ||
        player.wallet_address?.slice(0, 4) +
          "..." +
          player.wallet_address?.slice(-4) ||
        "Unknown";

      const fullWallet =
        player.fullWallet ||
        player.wallet_address ||
        player.full_wallet ||
        "Unknown";

      return {
        wallet: wallet,
        fullWallet: fullWallet,
        currentStreak: player.currentStreak || player.current_streak || 0,
        maxStreak: player.maxStreak || player.max_streak || 0,
        gamesPlayed: player.gamesPlayed || player.total_games_played || 0,
        gamesWon: player.gamesWon || player.total_games_won || 0,
        winRate: this.calculateWinRate(
          player.gamesWon || player.total_games_won || 0,
          player.gamesPlayed || player.total_games_played || 0
        ),
        lastPlayedDate:
          player.lastPlayedDate || player.last_played_date || "Unknown",
        // ✅ CRITICAL: Store the global rank (1-based index after sorting)
        globalRank: globalIndex + 1,
      };
    });

    return transformedPlayers;
  }

  // ✅ Calculate win rate
  calculateWinRate(won, played) {
    if (played === 0) return 0;
    return Math.round((won / played) * 100);
  }

  // ✅ Sort players by max streak (primary), then by current streak
  sortPlayers() {
    this.allPlayers.sort((a, b) => {
      // Primary sort: max streak (descending)
      if (b.maxStreak !== a.maxStreak) {
        return b.maxStreak - a.maxStreak;
      }

      // Secondary sort: current streak (descending)
      if (b.currentStreak !== a.currentStreak) {
        return b.currentStreak - a.currentStreak;
      }

      // Tertiary sort: games won (descending)
      return b.gamesWon - a.gamesWon;
    });

    // ✅ CRITICAL: Update global ranks after sorting
    this.allPlayers.forEach((player, index) => {
      player.globalRank = index + 1;
    });

    console.log(
      `✅ Sorted ${this.allPlayers.length} players with global ranks assigned`
    );
  }

  // ✅ Apply search filter
  applySearch() {
    if (!this.searchTerm) {
      this.filteredPlayers = [...this.allPlayers];
    } else {
      const searchLower = this.searchTerm.toLowerCase();
      this.filteredPlayers = this.allPlayers.filter(
        (player) =>
          player.fullWallet.toLowerCase().includes(searchLower) ||
          player.wallet.toLowerCase().includes(searchLower)
      );
    }

    // ✅ IMPORTANT: Don't change global ranks when filtering
    // The globalRank property remains unchanged from the original sorted list

    // Reset to first page and update display
    this.currentPage = 1;
    this.updateDisplay();
    this.updateSearchInfo();

    console.log(
      `🔍 Applied search filter: ${this.filteredPlayers.length} results`
    );

    // ✅ DEBUG: Log global ranks in search results
    if (this.searchTerm && this.filteredPlayers.length > 0) {
      console.log(
        "🏆 Global ranks in search results:",
        this.filteredPlayers
          .slice(0, 5)
          .map((p) => `${p.wallet}: Global #${p.globalRank}`)
      );
    }
  }

  updateSearchInfo() {
    const infoElement = document.getElementById("search-results-info");
    if (!infoElement) return;

    if (this.searchTerm) {
      infoElement.style.display = "block";
      if (this.filteredPlayers.length > 0) {
        // ✅ Show if any top 3 players are in search results
        const topPlayersInResults = this.filteredPlayers.filter(
          (p) => p.globalRank <= 3
        );

        let infoText = `Found ${this.filteredPlayers.length} player(s) matching "${this.searchTerm}"`;

        if (topPlayersInResults.length > 0) {
          const topPlayerRanks = topPlayersInResults
            .map((p) => `#${p.globalRank}`)
            .join(", ");
          infoText += ` (Including global top 3: ${topPlayerRanks})`;
        }

        infoElement.textContent = infoText;
        infoElement.style.color = "rgba(255, 255, 255, 0.8)";
      } else {
        infoElement.textContent = `No players found matching "${this.searchTerm}"`;
        infoElement.style.color = "#ff6b6b";
      }
    } else {
      infoElement.style.display = "none";
    }
  }

  // ✅ Handle search input
  handleSearchInput(value) {
    this.searchTerm = value.trim();
    this.applySearch();
  }

  // ✅ Reset search
  resetSearch() {
    const searchInput = document.getElementById("leaderboard-search-input");
    if (searchInput) {
      searchInput.value = "";
    }
    this.searchTerm = "";
    this.applySearch();
  }

  // ✅ Update main display
  updateDisplay() {
    this.renderLeaderboardItems();
    this.updatePagination();
  }

  // ✅ Render leaderboard items for current page
  renderLeaderboardItems() {
    const listElement = document.getElementById("leaderboard-list");
    if (!listElement) return;

    if (this.filteredPlayers.length === 0) {
      listElement.innerHTML = `
        <div class="empty-leaderboard">
          <div class="empty-icon">🏆</div>
          <h3>No players found</h3>
          <p>${
            this.searchTerm
              ? "Try a different search term"
              : "No players have played yet"
          }</p>
        </div>
      `;
      return;
    }

    // Calculate pagination
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageItems = this.filteredPlayers.slice(startIndex, endIndex);

    // ✅ CRITICAL: Use both page position and global rank
    const itemsHtml = pageItems
      .map((player, pageIndex) => {
        const pagePosition = startIndex + pageIndex + 1; // Position on current page
        const globalRank = player.globalRank; // Global position in full leaderboard
        const isCurrentPlayer =
          this.currentPlayerAddress &&
          player.fullWallet === this.currentPlayerAddress;

        return this.renderLeaderboardItem(
          player,
          pagePosition, // For display purposes
          globalRank, // For trophy logic
          isCurrentPlayer
        );
      })
      .join("");

    listElement.innerHTML = itemsHtml;
  }

  // ✅ FIXED: Render individual leaderboard item with working copy functionality
  renderLeaderboardItem(player, pagePosition, globalRank, isCurrentPlayer) {
    // ✅ CRITICAL: Use globalRank for trophy, pagePosition for display
    const displayRank = this.searchTerm ? `#${globalRank}` : `${pagePosition}`;
    const trophyRankClass = globalRank <= 3 ? `rank-${globalRank}` : "";
    const currentPlayerClass = isCurrentPlayer ? "current-player" : "";

    // ✅ Only show trophy if player is actually in top 3 globally
    const trophyIcon = globalRank <= 3 ? this.getTrophyIcon(globalRank) : "";

    return `
      <div class="leaderboard-item ${currentPlayerClass}">
        <div class="leaderboard-rank ${trophyRankClass}">
          ${trophyIcon}${displayRank}
        </div>
        <div class="leaderboard-player">
          <div class="player-wallet-container">
            <div 
              class="player-wallet" 
              onclick="window.leaderboardManager.copyWallet('${
                player.fullWallet
              }')" 
              title="Click to copy: ${player.fullWallet}"
              data-full-wallet="${player.fullWallet}"
            >
              <span>${player.wallet}</span>
              <svg class="copy-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
              </svg>
            </div>
            <div 
              class="solscan-link" 
              onclick="window.leaderboardManager.openSolscan('${
                player.fullWallet
              }')" 
              title="View on Solscan"
            >
              <svg class="solscan-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
              </svg>
            </div>
          </div>
          ${
            isCurrentPlayer
              ? '<span style="color: #667eea; font-size: 0.8rem; margin-left: 0.5rem;">👤 You</span>'
              : ""
          }
          ${
            globalRank <= 3 && this.searchTerm
              ? `<span style="color: #ffd700; font-size: 0.8rem; margin-left: 0.5rem;">🌟 Global ${
                  globalRank === 1
                    ? "Champion"
                    : globalRank === 2
                    ? "Runner-up"
                    : "3rd Place"
                }</span>`
              : ""
          }
        </div>
        <div class="leaderboard-streak">
          <div class="streak-main">
            <span class="streak-fire">🔥</span>
            <span class="streak-number">${player.maxStreak}</span>
            <span class="streak-label">HIGHEST</span>
          </div>
          <div class="streak-current">
            <span class="current-number">${player.currentStreak}</span>
            <span class="current-label">Current</span>
          </div>
        </div>
      </div>
    `;
  }

  // ✅ Get trophy icon for top 3
  getTrophyIcon(globalRank) {
    const icons = {
      1: '<span class="trophy-icon">🏆</span>',
      2: '<span class="trophy-icon">🥈</span>',
      3: '<span class="trophy-icon">🥉</span>',
    };
    return icons[globalRank] || "";
  }

  // ✅ Update pagination controls
  updatePagination() {
    const totalPages = Math.ceil(
      this.filteredPlayers.length / this.itemsPerPage
    );

    // Update pagination info
    const paginationInfo = document.getElementById(
      "leaderboard-pagination-info"
    );
    if (paginationInfo) {
      paginationInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
    }

    // Update button states
    const prevBtn = document.getElementById("leaderboard-prev-btn");
    const nextBtn = document.getElementById("leaderboard-next-btn");

    if (prevBtn) {
      prevBtn.disabled = this.currentPage <= 1;
    }

    if (nextBtn) {
      nextBtn.disabled = this.currentPage >= totalPages;
    }
  }

  // ✅ Navigation methods
  nextPage() {
    const totalPages = Math.ceil(
      this.filteredPlayers.length / this.itemsPerPage
    );
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.updateDisplay();
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updateDisplay();
    }
  }

  // ✅ Show loading state
  showLoading() {
    this.isLoading = true;
    const listElement = document.getElementById("leaderboard-list");
    if (listElement) {
      listElement.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                </div>
            `;
    }
  }

  // ✅ Hide loading state
  hideLoading() {
    this.isLoading = false;
  }

  // ✅ Show error message
  showError(message) {
    const listElement = document.getElementById("leaderboard-list");
    if (listElement) {
      listElement.innerHTML = `
                <div class="empty-leaderboard">
                    <div class="empty-icon">❌</div>
                    <h3>Error</h3>
                    <p>${message}</p>
                    <button class="pagination-btn" onclick="window.leaderboardManager.loadLeaderboardData()" style="margin-top: 1rem;">
                        🔄 Retry
                    </button>
                </div>
            `;
    }
  }

  // ✅ COMPLETELY FIXED: Copy wallet address functionality
  async copyWallet(walletAddress) {
    if (!walletAddress || walletAddress === "Unknown") {
      this.showCopyFeedback("Invalid wallet address", "error");
      return;
    }

    // ✅ CRITICAL FIX: Add visual feedback first
    const clickedElement = event?.target?.closest(".player-wallet");
    if (clickedElement) {
      clickedElement.style.background = "rgba(76, 175, 80, 0.3)";
      clickedElement.style.borderColor = "#4caf50";
    }

    try {
      // Method 1: Modern Clipboard API (works on HTTPS and localhost)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(walletAddress);

        this.showCopyFeedback("Wallet address copied! ✓", "success");
        console.log(
          `✅ Copied via Clipboard API: ${walletAddress.slice(0, 8)}...`
        );

        // ✅ Visual success feedback
        if (clickedElement) {
          clickedElement.innerHTML = `
          <span>${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}</span>
          <span style="color: #4caf50;">✓ Copied</span>
        `;

          setTimeout(() => {
            clickedElement.innerHTML = `
            <span>${walletAddress.slice(0, 4)}...${walletAddress.slice(
              -4
            )}</span>
            <svg class="copy-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
          `;
            clickedElement.style.background = "";
            clickedElement.style.borderColor = "";
          }, 2000);
        }

        return;
      }
    } catch (clipboardError) {
      console.warn("📋 Clipboard API failed:", clipboardError);
    }

    try {
      // Method 2: Enhanced fallback using document.execCommand

      // ✅ IMPROVED: Better textarea setup for mobile compatibility
      const textArea = document.createElement("textarea");
      textArea.value = walletAddress;

      // ✅ Better positioning and styling
      textArea.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      width: 1px;
      height: 1px;
      padding: 0;
      border: none;
      outline: none;
      boxShadow: none;
      background: transparent;
      opacity: 0;
      pointerEvents: none;
      zIndex: -1;
    `;

      textArea.setAttribute("readonly", "");
      textArea.setAttribute("contenteditable", "true");

      document.body.appendChild(textArea);

      try {
        // ✅ ENHANCED: Better mobile and cross-browser selection
        textArea.focus();
        textArea.setSelectionRange(0, textArea.value.length);

        // For iOS Safari specifically
        if (navigator.userAgent.match(/ipad|iphone/i)) {
          const range = document.createRange();
          range.selectNodeContents(textArea);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }

        // Try to copy
        const successful = document.execCommand("copy");

        if (successful) {
          this.showCopyFeedback("Wallet address copied! ✓", "success");
          console.log(
            `✅ Copied via execCommand: ${walletAddress.slice(0, 8)}...`
          );

          // ✅ Visual success feedback
          if (clickedElement) {
            clickedElement.innerHTML = `
            <span>${walletAddress.slice(0, 4)}...${walletAddress.slice(
              -4
            )}</span>
            <span style="color: #4caf50;">✓ Copied</span>
          `;

            setTimeout(() => {
              clickedElement.innerHTML = `
              <span>${walletAddress.slice(0, 4)}...${walletAddress.slice(
                -4
              )}</span>
              <svg class="copy-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
              </svg>
            `;
              clickedElement.style.background = "";
              clickedElement.style.borderColor = "";
            }, 2000);
          }

          return;
        } else {
          throw new Error("execCommand copy failed");
        }
      } finally {
        document.body.removeChild(textArea);
      }
    } catch (fallbackError) {
      console.error("📋 Fallback method failed:", fallbackError);
    }

    // Method 3: Show address for manual copy

    // ✅ ENHANCED: Better manual copy experience
    const shortWallet = `${walletAddress.slice(0, 8)}...${walletAddress.slice(
      -8
    )}`;

    // Show in a modal-style alert that's easier to copy from
    if (window.showToast) {
      showToast(`Copy this address: ${walletAddress}`, "info", 8000);
    }

    // Also try the prompt method as last resort
    try {
      if (window.prompt) {
        const userCopied = window.prompt(
          "Copy this wallet address (Ctrl+C / Cmd+C):",
          walletAddress
        );

        if (userCopied !== null) {
          this.showCopyFeedback("Please copy the address manually", "info");
        }
      }
    } catch (promptError) {
      console.error("📋 Prompt method failed:", promptError);
    }

    // ✅ Visual feedback for failed copy
    if (clickedElement) {
      clickedElement.style.background = "rgba(255, 193, 7, 0.3)";
      clickedElement.style.borderColor = "#ffc107";
      clickedElement.innerHTML = `
      <span>${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}</span>
      <span style="color: #ffc107;">⚠ Manual</span>
    `;

      setTimeout(() => {
        clickedElement.innerHTML = `
        <span>${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}</span>
        <svg class="copy-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>
      `;
        clickedElement.style.background = "";
        clickedElement.style.borderColor = "";
      }, 3000);
    }

    this.showCopyFeedback(`Address: ${shortWallet}`, "warning");
  }

  // ✅ Update theme based on current mode
  updateTheme() {
    const modal = document.getElementById("leaderboard-modal");
    if (!modal) return;

    const isLightMode = document
      .querySelector("html")
      ?.classList.contains("switch");

    if (isLightMode) {
      modal.classList.add("switch");
    } else {
      modal.classList.remove("switch");
    }
  }

  // ✅ Open wallet on Solscan
  openSolscan(walletAddress) {
    if (!walletAddress || walletAddress === "Unknown") {
      if (window.showToast) {
        showToast("Invalid wallet address", "error", 2000);
      }
      return;
    }

    const url = `https://solscan.io/account/${walletAddress}`;
    window.open(url, "_blank", "noopener,noreferrer");

    if (window.showToast) {
      showToast("Opening Solscan...", "info", 2000);
    }

    console.log(
      `🔗 Opened Solscan for wallet: ${walletAddress.slice(0, 8)}...`
    );
  }

  // ✅ Show feedback message (fallback if toast system not available)
  showCopyFeedback(message, type = "success") {
    // Try toast system first
    if (window.showToast) {
      showToast(message, type, 2000);
      return;
    }

    // Fallback to temporary div
    const feedback = document.createElement("div");
    feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            font-weight: 500;
            z-index: 10000;
            transition: opacity 0.3s ease;
            background: ${
              type === "success"
                ? "#28a745"
                : type === "error"
                ? "#dc3545"
                : "#17a2b8"
            };
            color: white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
    feedback.textContent = message;

    document.body.appendChild(feedback);

    setTimeout(() => {
      feedback.style.opacity = "0";
      setTimeout(() => feedback.remove(), 300);
    }, 2000);
  }

  // ✅ Refresh leaderboard data
  async refresh() {
    await this.loadLeaderboardData();
  }

  // ✅ Get current state for debugging
  getState() {
    return {
      isOpen: this.isModalOpen(),
      totalPlayers: this.allPlayers.length,
      filteredPlayers: this.filteredPlayers.length,
      currentPage: this.currentPage,
      searchTerm: this.searchTerm,
      isLoading: this.isLoading,
      currentPlayer: this.currentPlayerAddress,
      initialized: this.initialized,
    };
  }
}

// ✅ Global leaderboard manager instance
const leaderboardManager = new LeaderboardManager();

// ✅ Global functions for backward compatibility
window.openLeaderboard = () => leaderboardManager.openLeaderboard();
window.closeLeaderboard = () => leaderboardManager.closeLeaderboard();
window.handleSearchInput = (value) =>
  leaderboardManager.handleSearchInput(value);
window.nextPage = () => leaderboardManager.nextPage();
window.previousPage = () => leaderboardManager.previousPage();
window.openSolscan = (wallet) => leaderboardManager.openSolscan(wallet);
window.copyWallet = (wallet) => leaderboardManager.copyWallet(wallet);
window.updateLeaderboardTheme = () => leaderboardManager.updateTheme();

// ✅ Make manager available globally
window.leaderboardManager = leaderboardManager;

// ✅ Auto-initialize when DOM is ready with better integration
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(async () => {
    await leaderboardManager.initialize();

    // Set up the leaderboard button after initialization
    setupLeaderboardButtonIntegration();
  }, 1000);
});

// ✅ Enhanced button setup function
function setupLeaderboardButtonIntegration() {
  // Try multiple selectors to find the leaderboard button
  const buttonSelectors = [
    ".header-right-button-leaderboard",
    ".header-right-leaderboard .header-right-icon",
    ".header-right-button:nth-child(2)",
    '[data-action="leaderboard"]',
    ".leaderboard-btn",
    ".leaderboard-button",
  ];

  let leaderboardButton = null;

  // Try each selector
  for (const selector of buttonSelectors) {
    leaderboardButton = document.querySelector(selector);
    if (leaderboardButton) {
      break;
    }
  }

  // If still not found, try finding by parent container
  if (!leaderboardButton) {
    const headerButtons = document.querySelectorAll(".header-right-button");
    if (headerButtons.length >= 2) {
      leaderboardButton = headerButtons[1]; // Second button should be leaderboard
    }
  }

  if (!leaderboardButton) {
    console.error(
      "❌ Leaderboard button not found! Trying to create fallback..."
    );
    createFallbackLeaderboardButton();
    return;
  }

  // Remove any existing event listeners
  const newButton = leaderboardButton.cloneNode(true);
  leaderboardButton.parentNode.replaceChild(newButton, leaderboardButton);
  leaderboardButton = newButton;

  // Add click event listener
  leaderboardButton.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await leaderboardManager.openLeaderboard();
    } catch (error) {
      console.error("❌ Error opening leaderboard:", error);
      if (window.showToast) {
        showToast("Error opening leaderboard", "error", 3000);
      }
    }
  });

  // Add visual feedback
  leaderboardButton.style.cursor = "pointer";
  leaderboardButton.title = "View Leaderboard";
}

// ✅ Create fallback button if not found
function createFallbackLeaderboardButton() {
  const headerRight = document.querySelector(".header-right");
  if (!headerRight) {
    console.error(
      "❌ Could not create fallback leaderboard button - header not found"
    );
    return;
  }

  const fallbackButton = document.createElement("div");
  fallbackButton.className = "header-right-button leaderboard-fallback";
  fallbackButton.innerHTML = `
        <div class="header-right-icon">🏆</div>
    `;
  fallbackButton.title = "View Leaderboard";
  fallbackButton.style.cursor = "pointer";

  // Insert before the last button (settings/theme)
  const lastButton = headerRight.lastElementChild;
  headerRight.insertBefore(fallbackButton, lastButton);

  fallbackButton.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    await leaderboardManager.openLeaderboard();
  });
}

// ✅ Manual button setup function (can be called from console)
function manualSetupLeaderboardButton() {
  setupLeaderboardButtonIntegration();
}

// ✅ Debug functions
window.debugLeaderboard = {
  // Show leaderboard with test data
  showTestLeaderboard() {
    leaderboardManager.allPlayers = [
      {
        wallet: "4xQo...7KLm",
        fullWallet:
          "4xQoAbC123defGhi789jKl012MnO345pQr678sT901uV234wX567yZ890def7KLm",
        currentStreak: 15,
        maxStreak: 20,
        gamesPlayed: 25,
        gamesWon: 20,
      },
      {
        wallet: "8pLm...3NqR",
        fullWallet:
          "8pLmXyZ456uvwAbc789DeF012GhI345JkL678MnO901PqR234StU567VwX890rst3NqR",
        currentStreak: 12,
        maxStreak: 15,
        gamesPlayed: 18,
        gamesWon: 15,
      },
      {
        wallet: "2fGh...9TuV",
        fullWallet:
          "2fGhJkL789rstUvw012XyZ345AbC678DeF901GhI234JkL567MnO890PqR123stu9TuV",
        currentStreak: 10,
        maxStreak: 12,
        gamesPlayed: 15,
        gamesWon: 12,
      },
      {
        wallet: "6nPq...5WxY",
        fullWallet:
          "6nPqMnO012opqRsT345UvW678XyZ901AbC234DeF567GhI890JkL123MnO456pqr5WxY",
        currentStreak: 8,
        maxStreak: 10,
        gamesPlayed: 12,
        gamesWon: 10,
      },
      {
        wallet: "1aZx...4CvB",
        fullWallet:
          "1aZxCvB345lmnOpQ678RsT901UvW234XyZ567AbC890DeF123GhI456JkL789mno4CvB",
        currentStreak: 6,
        maxStreak: 8,
        gamesPlayed: 10,
        gamesWon: 8,
      },
    ];
    leaderboardManager.filteredPlayers = [...leaderboardManager.allPlayers];
    leaderboardManager.updateDisplay();
    leaderboardManager.openLeaderboard();
  },

  // Test search functionality
  testSearch(term) {
    const searchInput = document.getElementById("leaderboard-search-input");
    if (searchInput) {
      searchInput.value = term;
    }
    leaderboardManager.handleSearchInput(term);
  },

  // Test pagination
  testPagination() {
    const testData = [];
    for (let i = 1; i <= 25; i++) {
      testData.push({
        wallet: `${i.toString().padStart(4, "0")}...${i
          .toString()
          .padStart(4, "0")}`,
        fullWallet: `${i
          .toString()
          .padStart(
            4,
            "0"
          )}abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQR${i
          .toString()
          .padStart(4, "0")}`,
        currentStreak: 25 - i,
        maxStreak: 30 - i,
        gamesPlayed: 20,
        gamesWon: 15,
        winRate: 75,
      });
    }
    leaderboardManager.allPlayers = testData;
    leaderboardManager.filteredPlayers = [...testData];
    leaderboardManager.updateDisplay();
    leaderboardManager.openLeaderboard();
    console.log("🧪 Pagination test data loaded (25 players, 3 pages)");
  },

  // Get current state
  getState() {
    const state = leaderboardManager.getState();

    return state;
  },

  // Force refresh data
  async refresh() {
    await leaderboardManager.refresh();
  },

  // Test theme switching
  testTheme() {
    leaderboardManager.updateTheme();
  },

  // Test copy functionality with debugging
  async testCopy() {
    const testWallet =
      "4xQoAbC123defGhi789jKl012MnO345pQr678sT901uV234wX567yZ890def7KLm";

    console.log(
      "WriteText available:",
      !!(navigator.clipboard && navigator.clipboard.writeText)
    );
    console.log(
      "ExecCommand copy:",
      document.queryCommandSupported && document.queryCommandSupported("copy")
    );

    try {
      await leaderboardManager.copyWallet(testWallet);
    } catch (error) {
      console.error("❌ Copy test failed:", error);
    }
  },

  // Test copy with simple text
  async testSimpleCopy() {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText("test123");
      } else {
      }
    } catch (error) {
      console.error("❌ Simple clipboard test failed:", error);
    }
  },

  // Debug copy functionality step by step
  debugCopy() {
    console.log("Browser info:", {
      userAgent: navigator.userAgent,
      isSecureContext: window.isSecureContext,
      protocol: window.location.protocol,
      hasClipboard: !!navigator.clipboard,
      hasWriteText: !!(navigator.clipboard && navigator.clipboard.writeText),
      execCommandSupported: document.queryCommandSupported
        ? document.queryCommandSupported("copy")
        : "unknown",
    });

    this.testSimpleCopy();

    setTimeout(() => {
      this.testCopy();
    }, 1000);
  },

  // Test search with detailed logging
  testSearchDetailed(term) {
    const searchInput = document.getElementById("leaderboard-search-input");
    if (searchInput) {
      searchInput.value = term;
    } else {
      console.error("❌ Search input not found");
    }

    leaderboardManager.handleSearchInput(term);

    setTimeout(() => {
      console.log(
        `🔍 Search found ${leaderboardManager.filteredPlayers.length} matches`
      );
    }, 300);
  },

  // Debug search functionality
  debugSearch() {
    console.log(
      "Search input element:",
      document.getElementById("leaderboard-search-input")
    );

    // Test with sample data first
    if (leaderboardManager.allPlayers.length === 0) {
      this.showTestLeaderboard();
    }

    // Test search with known data
    setTimeout(() => {
      this.testSearchDetailed("4xQo");
    }, 1000);
  },
};

console.log(
  "🔧 If the leaderboard button is not working, try these diagnostic commands:"
);
console.log("  window.debugLeaderboard.diagnoseButton() - Check button setup");
console.log("  window.manualSetupLeaderboardButton() - Manually setup button");
console.log("  window.debugLeaderboard.forceOpen() - Force open leaderboard");

console.log("  window.debugLeaderboard.debugCopy() - Debug copy functionality");
console.log("  window.debugLeaderboard.testCopy() - Test wallet copy");
console.log(
  "  window.debugLeaderboard.testSimpleCopy() - Test basic clipboard"
);

console.log(
  "  window.debugLeaderboard.showTestLeaderboard() - Show with test data"
);
console.log(
  '  window.debugLeaderboard.testSearchDetailed("term") - Test search with logging'
);
console.log("  window.debugLeaderboard.getState() - Get current state");
