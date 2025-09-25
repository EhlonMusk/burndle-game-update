// ============================== COMPLETE FRONTEND GAME PAUSE HANDLER ==============================
// Save as: frontend/js/pause-handler.js

class GamePauseHandler {
  constructor() {
    this.isPaused = false;
    this.pauseInfo = null;
    this.pauseOverlay = null;
    this.pauseCheckInterval = null;
    this.socket = null;
    this.isInitialized = false;

    // Finish game state tracking (similar to pause)
    this.isFinished = false;
    this.finishInfo = null;
    this.finishOverlay = null;
    this.finishCountdownInterval = null;
    this.finishStartTime = null;

    // Bind methods to preserve 'this' context
    this.blockKeyInput = this.blockKeyInput.bind(this);
    this.blockClickInput = this.blockClickInput.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

    this.init();
  }

  // ✅ Initialize the pause handler
  init() {
    if (this.isInitialized) return;

    console.log("🎮 Initializing Game Pause Handler...");

    this.createPauseOverlay();
    this.createFinishOverlay();
    this.createPauseStyles();
    this.createFinishStyles();
    this.setupEventListeners();
    this.startPauseChecking();
    this.setupWebSocketListeners();

    // Check initial pause state after short delay
    setTimeout(() => this.checkPauseStatus(), 2000);

    // Check initial finish state multiple times to ensure it loads
    setTimeout(() => this.checkFinishStatus(), 1500);
    setTimeout(() => this.checkFinishStatus(), 3000);
    setTimeout(() => this.checkFinishStatus(), 5000);

    this.isInitialized = true;
    console.log("✅ Game Pause Handler initialized successfully");
  }

  // ✅ Create pause overlay UI
  createPauseOverlay() {
    // Remove existing overlay if present
    const existing = document.getElementById("game-pause-overlay");
    if (existing) {
      existing.remove();
    }

    this.pauseOverlay = document.createElement("div");
    this.pauseOverlay.id = "game-pause-overlay";
    this.pauseOverlay.className = "game-pause-overlay";

    this.pauseOverlay.innerHTML = `
      <div class="pause-modal">
        <h2 class="pause-title">Paused for maintenance</h2>
        <p id="pause-message" class="pause-message">
          The game will resume momentarily. Check our socials for updates.
        </p>
        <div class="pause-status">
          <span id="connection-status" class="connection-status">
            🔗 Checking connection...
          </span>
        </div>
      </div>
    `;

    // Add overlay to body
    document.body.appendChild(this.pauseOverlay);

    // Setup button handlers
    this.setupOverlayButtons();
  }

  // ✅ Create finish overlay UI
  createFinishOverlay() {
    // Remove existing overlay if present
    const existing = document.getElementById("game-finish-overlay");
    if (existing) {
      existing.remove();
    }

    this.finishOverlay = document.createElement("div");
    this.finishOverlay.id = "game-finish-overlay";
    this.finishOverlay.className = "game-finish-overlay";

    this.finishOverlay.innerHTML = `
      <div class="finish-modal">
        <div class="finish-header">
          <h2>🏆 Game Finished!</h2>
          <p class="finish-subtitle">Thanks for playing BURNdle!<br>Prizes will be distributed shortly.<br>Keep an eye on our socials for updates.</p>
        </div>
        <div class="finish-content" id="finish-leaderboard">
          <!-- Leaderboard will be populated here -->
        </div>
      </div>
    `;

    // Add overlay to body
    document.body.appendChild(this.finishOverlay);
  }


  // ✅ Setup overlay button handlers
  setupOverlayButtons() {
    // No buttons to setup since they were removed for the maintenance modal
  }

  // ✅ Create CSS styles for pause overlay
  createPauseStyles() {
    // Remove existing styles
    const existingStyle = document.getElementById("game-pause-styles");
    if (existingStyle) {
      existingStyle.remove();
    }

    const style = document.createElement("style");
    style.id = "game-pause-styles";
    style.textContent = `
      .game-pause-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, 
          rgba(0, 0, 0, 0.85) 0%, 
          rgba(20, 20, 40, 0.9) 100%);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
      }
      
      .game-pause-overlay.active {
        opacity: 1;
        visibility: visible;
      }
      
      .pause-modal {
        background: linear-gradient(135deg, 
          rgba(30, 30, 60, 0.95) 0%, 
          rgba(50, 50, 80, 0.95) 100%);
        border: 2px solid rgba(100, 150, 255, 0.3);
        border-radius: 20px;
        padding: 40px;
        text-align: center;
        max-width: 500px;
        min-width: 400px;
        box-shadow: 
          0 20px 60px rgba(0, 0, 0, 0.5),
          inset 0 1px 0 rgba(255, 255, 255, 0.1);
        transform: scale(0.8) translateY(20px);
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      
      .game-pause-overlay.active .pause-modal {
        transform: scale(1) translateY(0);
      }
      
      
      .pause-title {
        color: #fff;
        font-size: 2.5rem;
        font-weight: bold;
        margin: 0 0 20px 0;
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
      }
      
      .pause-message {
        color: #ddd;
        font-size: 1.2rem;
        line-height: 1.5;
        margin: 0 0 30px 0;
      }
      
      
      .pause-status {
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .connection-status {
        color: #2196F3;
        font-size: 0.9rem;
        font-weight: bold;
      }
      
      @media (max-width: 600px) {
        .pause-modal {
          min-width: 90%;
          padding: 30px 20px;
        }
        
        .pause-title {
          font-size: 2rem;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // ✅ Create finish overlay styles
  createFinishStyles() {
    // Remove existing styles
    const existingStyle = document.getElementById("game-finish-styles");
    if (existingStyle) {
      existingStyle.remove();
    }

    const style = document.createElement("style");
    style.id = "game-finish-styles";
    style.textContent = `
      .game-finish-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg,
          rgba(0, 0, 0, 0.85) 0%,
          rgba(20, 20, 40, 0.9) 100%);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
      }

      .game-finish-overlay.active {
        opacity: 1;
        visibility: visible;
      }

      .finish-modal {
        background: linear-gradient(135deg, #4c63d2 0%, #6c5ce7 50%, #a044ff 100%);
        border-radius: 24px;
        max-width: 600px;
        width: 90vw;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
        animation: modalSlideIn 0.3s ease-out;
        position: relative;
      }

      @keyframes modalSlideIn {
        from { transform: scale(0.8); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }

      .finish-header {
        padding: 40px 40px 30px 40px;
        text-align: center;
      }

      .finish-header h2 {
        margin: 0 0 15px 0;
        font-size: 2.5rem;
        font-weight: 700;
        color: white;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }

      .finish-subtitle {
        margin: 0;
        font-size: 1rem;
        color: rgba(255, 255, 255, 0.85);
        line-height: 1.5;
      }

      .finish-content {
        background: rgba(44, 62, 80, 0.95);
        margin: 0 20px 20px 20px;
        border-radius: 16px;
        padding: 20px;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }


      .top-three-section {
        margin-bottom: 30px;
      }

      .top-player-row {
        display: flex;
        align-items: center;
        padding: 16px 20px;
        margin-bottom: 12px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        transition: all 0.2s ease;
      }

      .top-player-row:hover {
        background: rgba(255, 255, 255, 0.08);
        transform: translateY(-2px);
      }

      .player-rank {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 80px;
      }

      .rank-medal {
        font-size: 1.5rem;
      }

      .rank-number {
        font-size: 1.2rem;
        font-weight: 700;
        color: white;
      }

      .player-wallet {
        flex: 1;
        margin: 0 20px;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .wallet-address {
        font-family: 'Courier New', monospace;
        font-size: 0.95rem;
        color: white;
        cursor: pointer;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .wallet-address:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: scale(1.02);
      }

      .copy-icon {
        width: 16px;
        height: 16px;
        opacity: 0.7;
      }

      .solscan-btn {
        color: rgba(255, 255, 255, 0.7);
        text-decoration: none;
        padding: 8px;
        border-radius: 6px;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .solscan-btn:hover {
        color: white;
        background: rgba(255, 255, 255, 0.1);
        transform: scale(1.1);
      }

      .player-stats {
        display: flex;
        gap: 16px;
      }

      .stat {
        text-align: center;
      }

      .stat-label {
        display: block;
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.7);
        margin-bottom: 4px;
        font-weight: 600;
      }

      .stat-value {
        display: block;
        font-size: 1.2rem;
        font-weight: 700;
        color: white;
      }

      .next-game-section {
        text-align: center;
        padding: 20px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .next-game-text {
        margin: 0 0 15px 0;
        font-size: 1.1rem;
        color: rgba(255, 255, 255, 0.9);
      }

      .next-game-section {
        text-align: center;
        padding: 20px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        margin-top: 20px;
      }

      .next-game-text {
        margin: 0 0 15px 0;
        font-size: 1rem;
        color: rgba(255, 255, 255, 0.8);
      }

      .countdown-display {
        font-size: 2.5rem;
        font-weight: bold;
        color: white;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        letter-spacing: 2px;
      }
    `;

    document.head.appendChild(style);
  }

  // ✅ Setup event listeners
  setupEventListeners() {
    // Block keyboard input when paused
    document.addEventListener("keydown", this.blockKeyInput, true);
    document.addEventListener("keyup", this.blockKeyInput, true);
    document.addEventListener("keypress", this.blockKeyInput, true);

    // Block click input when paused
    document.addEventListener("click", this.blockClickInput, true);
    document.addEventListener("mousedown", this.blockClickInput, true);
    document.addEventListener("mouseup", this.blockClickInput, true);

    // Block touch input when paused
    document.addEventListener("touchstart", this.blockClickInput, true);
    document.addEventListener("touchend", this.blockClickInput, true);

    // Handle page visibility changes
    document.addEventListener("visibilitychange", this.handleVisibilityChange);

    // ESC key support
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isPaused) {
        this.showPauseNotification("Game is paused - cannot close overlay");
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }

  // ✅ Block keyboard input when paused
  blockKeyInput(event) {
    if (this.shouldBlockAction()) {
      // Allow certain keys for accessibility
      const allowedKeys = ["F5", "F12", "Tab", "Alt", "Control", "Meta"];

      if (!allowedKeys.includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();

        // Show notification for game-related keys
        const gameKeys = [
          "Enter",
          " ",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ];
        if (gameKeys.includes(event.key)) {
          this.showPauseNotification("Game input blocked - game is paused");
        }
      }
    }
  }

  // ✅ Block click input when paused
  blockClickInput(event) {
    if (this.shouldBlockAction()) {
      // Allow clicks on pause overlay elements
      const pauseOverlay = document.getElementById("game-pause-overlay");
      if (pauseOverlay && pauseOverlay.contains(event.target)) {
        return; // Allow interaction with pause overlay
      }

      event.preventDefault();
      event.stopPropagation();
      this.showPauseNotification("Game interaction blocked - game is paused");
    }
  }

  // ✅ Handle page visibility changes
  handleVisibilityChange() {
    if (!document.hidden && this.isPaused) {
      // Page became visible while paused - ensure overlay is shown
      setTimeout(() => this.showPauseOverlay(), 100);
    }
  }

  // ✅ Setup WebSocket listeners
  setupWebSocketListeners() {
    // Try to find existing WebSocket connection
    this.findWebSocketConnection();

    // Setup periodic connection checking
    setInterval(() => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        this.findWebSocketConnection();
      }
    }, 5000);
  }

  // ✅ Find and attach to WebSocket connection
  // ✅ Find and attach to Socket.io connection
  findWebSocketConnection() {
    // Try different possible socket variable names
    const possibleSockets = ["socket", "playerSocket", "gameSocket", "io"];

    for (const socketName of possibleSockets) {
      const socketObj = window[socketName];

      // Check if it's a Socket.io connection
      if (
        socketObj &&
        (socketObj.connected !== undefined || socketObj.socket)
      ) {
        this.attachToSocket(socketObj);
        return;
      }
    }

    console.warn("⚠️ No Socket.io connection found");
    this.updateConnectionStatus("⚠️ Socket.io not connected");
  }

  // ✅ Attach to WebSocket connection
  // ✅ Attach to Socket.io connection
  attachToSocket(socket) {
    if (this.socket === socket) return; // Already attached

    this.socket = socket;
    console.log("📡 Attaching to Socket.io connection");

    // Listen for pause events using Socket.io syntax
    this.socket.on("game_paused", (data) => {
      console.log("⏸️ Received game_paused event via Socket.io");
      this.handleGamePaused(data);
    });

    this.socket.on("game_resumed", (data) => {
      console.log("▶️ Received game_resumed event via Socket.io");
      this.handleGameResumed(data);
    });

    this.socket.on("game_reset", (data) => {
      console.log("🔄 Received game_reset event via Socket.io");
      this.handleGameReset(data);
    });

    this.socket.on("game_stopped", (data) => {
      console.log("🏁 Received game_stopped event via Socket.io");
      this.handleGameStopped(data);
    });

    this.socket.on("game_cancelled", (data) => {
      console.log("🚫 Received game_cancelled event via Socket.io");
      this.handleGameCancelled(data);
    });

    // Check connection status
    if (this.socket.connected) {
      this.updateConnectionStatus("🔗 Socket.io connected");
    } else {
      this.updateConnectionStatus("⏳ Socket.io connecting...");

      // Listen for connection events
      this.socket.on("connect", () => {
        this.updateConnectionStatus("🔗 Socket.io connected");
      });

      this.socket.on("disconnect", () => {
        this.updateConnectionStatus("🔴 Socket.io disconnected");
      });
    }
  }

  // ✅ Start periodic pause status checking
  startPauseChecking() {
    // Check every 30 seconds
    this.pauseCheckInterval = setInterval(async () => {
      await this.checkPauseStatus();
      await this.checkFinishStatus();
    }, 30000);

    // Initial check
    setTimeout(() => this.checkPauseStatus(), 1000);
  }

  // ✅ Check pause status from server
  async checkPauseStatus() {
    try {
      const response = await fetch("/api/pause-status");
      if (!response.ok) throw new Error("Failed to fetch pause status");

      const data = await response.json();

      if (data.isPaused && !this.isPaused) {
        this.handleGamePaused(data);
      } else if (!data.isPaused && this.isPaused) {
        this.handleGameResumed(data);
      }

      this.updateConnectionStatus("✅ Server connected");
    } catch (error) {
      console.error("❌ Failed to check pause status:", error);
      this.updateConnectionStatus("❌ Server connection error");
    }
  }

  // ✅ Check finish status from server
  async checkFinishStatus() {
    try {
      const response = await fetch("/api/finish-status");
      if (!response.ok) throw new Error("Failed to fetch finish status");

      const data = await response.json();
      console.log("🏁 Finish status:", data);

      if (data.isFinished && data.leaderboard) {
        console.log("🏁 Game is finished - showing modal on page load");

        // Wait for showFinishGameModal to be available if not ready yet
        const waitForModal = () => {
          if (window.showFinishGameModal) {
            window.showFinishGameModal(data.leaderboard);
          } else {
            console.log("🏁 Waiting for showFinishGameModal to be available...");
            setTimeout(waitForModal, 500);
          }
        };

        waitForModal();
      }
    } catch (error) {
      console.error("❌ Failed to check finish status:", error);
    }
  }

  // ✅ Handle game paused event
  handleGamePaused(data) {
    console.log("⏸️ Game paused:", data);

    this.isPaused = true;
    this.pauseInfo = data;

    this.showPauseOverlay();
    this.updatePauseDetails(data);
    this.savePauseState();

    // Dispatch custom event
    window.dispatchEvent(new CustomEvent("gamePaused", { detail: data }));
  }

  // ✅ Handle game resumed event
  handleGameResumed(data) {
    console.log("▶️ Game resumed:", data);

    this.isPaused = false;
    this.pauseInfo = null;

    this.hidePauseOverlay();
    this.clearPauseState();

    // Dispatch custom event
    window.dispatchEvent(new CustomEvent("gameResumed", { detail: data }));
  }

  // ✅ Handle game reset event
  handleGameReset(data) {
    console.log("🔄 WEBSOCKET: Game reset received:", data);

    // Clear pause state
    this.isPaused = false;
    this.pauseInfo = null;
    this.hidePauseOverlay();
    this.clearPauseState();

    // Clear finish state
    console.log("🔄 WEBSOCKET: Clearing finish state and hiding overlay");
    this.isFinished = false;
    this.finishInfo = null;
    this.finishStartTime = null;
    this.hideFinishOverlay();
    this.clearFinishState();
    console.log("🔄 WEBSOCKET: Finish state cleared");

    // Show reset notification (if this is from countdown completion)
    if (data.resetBy === "COUNTDOWN_SYSTEM") {
      setTimeout(() => {
        if (window.showToast) {
          showToast("🆕 New game has begun!", "success", 4000);
        }
      }, 500);
    }

    // Dispatch custom event
    window.dispatchEvent(new CustomEvent("gameReset", { detail: data }));
  }

  handleGameStopped(data) {
    console.log("🏁 Game stopped:", data);

    // Set finish state
    this.isFinished = true;
    this.finishInfo = data;

    // Always set finish start time to current time (creates new period each time)
    // Only preserve existing time during state restoration (when data has a special flag)
    if (data.isRestoration && this.finishStartTime) {
      // Keep existing finishStartTime during restoration
      console.log("🔄 Preserving existing finish start time during restoration");
    } else {
      // Set new finish start time for fresh finish game button press
      this.finishStartTime = Date.now();
      console.log("🏁 Setting new finish start time:", new Date(this.finishStartTime).toISOString());
    }

    // Show the finish overlay with leaderboard data
    this.showFinishOverlay();
    if (data.leaderboard) {
      this.updateFinishDetails(data.leaderboard);
    }

    // Store finish state in localStorage for persistence
    localStorage.setItem('gameFinishState', JSON.stringify({
      isFinished: true,
      finishInfo: data,
      timestamp: Date.now(),
      finishStartTime: this.finishStartTime
    }));

    // Dispatch custom event
    window.dispatchEvent(new CustomEvent("gameStopped", { detail: data }));
  }

  // ✅ Handle game cancelled event - hide finish overlay
  handleGameCancelled(data) {
    console.log("🚫 Game cancelled:", data);

    // Clear finish state
    this.isFinished = false;
    this.finishInfo = null;
    this.finishStartTime = null;

    // Hide the finish overlay
    this.hideFinishOverlay();
    this.clearFinishState();

    // Dispatch custom event
    window.dispatchEvent(new CustomEvent("gameCancelled", { detail: data }));
  }

  // ✅ Show pause overlay
  showPauseOverlay() {
    if (this.pauseOverlay) {
      this.pauseOverlay.classList.add("active");

      // Disable page scrolling
      document.body.style.overflow = "hidden";
    }
  }

  // ✅ Hide pause overlay
  hidePauseOverlay() {
    if (this.pauseOverlay) {
      this.pauseOverlay.classList.remove("active");

      // Re-enable page scrolling
      document.body.style.overflow = "";
    }
  }

  // ✅ Show finish overlay
  showFinishOverlay() {
    if (this.finishOverlay) {
      this.finishOverlay.classList.add("active");

      // Disable page scrolling
      document.body.style.overflow = "hidden";

      // Start countdown timer immediately (if not already started)
      setTimeout(() => {
        const countdownEl = document.getElementById('finish-countdown-display');
        if (countdownEl && !this.finishCountdownInterval) {
          this.startFinishCountdownTimer();
        }
      }, 100);
    }
  }

  // ✅ Hide finish overlay
  hideFinishOverlay() {
    console.log("🔄 hideFinishOverlay called, finishOverlay exists:", !!this.finishOverlay);
    if (this.finishOverlay) {
      console.log("🔄 Removing 'active' class from finish overlay");
      this.finishOverlay.classList.remove("active");

      // Re-enable page scrolling
      document.body.style.overflow = "";

      // Clear countdown interval
      if (this.finishCountdownInterval) {
        clearInterval(this.finishCountdownInterval);
        this.finishCountdownInterval = null;
        console.log("🔄 Cleared finish countdown interval");
      }
      console.log("🔄 Finish overlay should now be hidden");
    } else {
      console.log("❌ No finish overlay found to hide");
    }
  }

  // ✅ Update finish overlay with leaderboard
  updateFinishDetails(leaderboard) {
    const contentEl = document.getElementById("finish-leaderboard");
    if (!contentEl || !leaderboard) return;

    const leaderboardHtml = leaderboard.slice(0, 3).map(player => {
      const rankEmoji = player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : '🥉';
      const displayWallet = player.wallet;
      const fullWallet = player.fullWallet || player.wallet;

      return `
        <div class="top-player-row rank-${player.rank}">
          <div class="player-rank">
            <span class="rank-medal">${rankEmoji}</span>
            <span class="rank-number">${player.rank}</span>
          </div>
          <div class="player-wallet">
            <span class="wallet-address" title="Click to copy: ${fullWallet}" onclick="navigator.clipboard.writeText('${fullWallet}')">
              ${displayWallet}
              <svg class="copy-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
              </svg>
            </span>
            <a href="https://solscan.io/account/${fullWallet}" target="_blank" class="solscan-btn" title="View on Solscan">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
              </svg>
            </a>
          </div>
          <div class="player-stats">
            <div class="stat">
              <span class="stat-label">🔥 HIGHEST</span>
              <span class="stat-value">${player.maxStreak}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    contentEl.innerHTML = `
      <div class="top-three-section">
        ${leaderboardHtml}
      </div>
      <div class="next-game-section">
        <p class="next-game-text">The next game will start in:</p>
        <div class="countdown-display" id="finish-countdown-display">01:00:00</div>
      </div>
    `;

    // Start the countdown timer
    this.startFinishCountdownTimer();
  }

  // ✅ Start finish countdown timer (1 hour from finish button press)
  startFinishCountdownTimer() {
    const countdownEl = document.getElementById('finish-countdown-display');
    if (!countdownEl) return;

    // Use the stored finish start time, or current time as fallback
    const startTime = this.finishStartTime || Date.now();
    const countdownEnd = startTime + (60 * 60 * 1000); // 1 hour from finish start time

    const updateCountdown = () => {
      const now = Date.now();
      const timeUntilReset = countdownEnd - now;

      if (timeUntilReset <= 0) {
        countdownEl.textContent = '00:00:00';
        if (this.finishCountdownInterval) {
          clearInterval(this.finishCountdownInterval);
          this.finishCountdownInterval = null;
        }

        // Handle countdown completion - reset everything and start new game period
        console.log("🕐 COUNTDOWN COMPLETED - Triggering reset process");
        this.handleCountdownCompletion();
        return;
      }

      const hours = Math.floor(timeUntilReset / (1000 * 60 * 60));
      const minutes = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeUntilReset % (1000 * 60)) / 1000);

      const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      countdownEl.textContent = timeString;
    };

    // Clear existing timer if any
    if (this.finishCountdownInterval) {
      clearInterval(this.finishCountdownInterval);
    }

    // Start the countdown
    updateCountdown();
    this.finishCountdownInterval = setInterval(updateCountdown, 1000);
  }

  // ✅ Handle countdown completion - reset all data and start new period
  async handleCountdownCompletion() {
    console.log("⏰ Finish countdown completed - resetting all game data");

    // Note: Difficulty will only be reset if streak was actually reset during this period
    // Winners should keep their reduced rows when countdown completes

    // IMMEDIATE LOCAL ACTIONS (always work regardless of backend)

    // 1. Hide the finish overlay immediately (local)
    console.log("🔄 COUNTDOWN: Hiding finish overlay locally");
    this.isFinished = false;
    this.finishInfo = null;
    this.finishStartTime = null;
    this.hideFinishOverlay();
    this.clearFinishState();
    console.log("🔄 COUNTDOWN: Finish overlay hidden and state cleared");

    // 2. Reset all localStorage data for all wallets
    this.resetAllWalletData();

    // 3. Reset difficulty to 6 rows for everyone
    if (window.difficultyManager) {
      window.difficultyManager.resetDifficulty();
      console.log("🎯 COUNTDOWN COMPLETION: Difficulty reset to 6 rows");
    }

    // 4. Reset game state to initial disabled state
    this.resetGameToInitialState();

    // 5. Show immediate notification and update footer streaks
    setTimeout(() => {
      if (window.showToast) {
        showToast("🆕 New game has begun!", "success", 4000);
      }

      // ✅ NEW: Instantly update footer streaks after countdown completion
      if (window.streakManager && window.isWalletConnected && window.isWalletConnected()) {
        const walletAddress = window.getWalletPublicKey()?.toString();
        if (walletAddress) {
          console.log("🔄 COUNTDOWN COMPLETION - Instantly refreshing footer streaks");
          setTimeout(() => {
            window.streakManager.loadStreakData(walletAddress);
          }, 1500); // Delay to let backend reset complete
        }
      }
    }, 500);

    // 5. Dispatch custom event for any listeners
    window.dispatchEvent(new CustomEvent("newGamePeriodStarted", {
      detail: { timestamp: Date.now() }
    }));

    // BACKEND ACTIONS (attempt but don't block local reset)
    try {
      // 6. Try to reset backend database data (async, non-blocking)
      await this.resetAllBackendData();
    } catch (error) {
      console.error("❌ Backend reset failed, but local reset completed:", error);
      // Don't show error to user since local reset worked
    }
  }

  // ✅ Reset all backend database data
  async resetAllBackendData() {
    console.log("🗑️ COUNTDOWN: Starting backend database reset");

    try {
      const response = await fetch('/api/admin/countdown-completion-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: 'countdown_completion',
          timestamp: Date.now()
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Backend data reset successful:", data);

        if (data.playersReset) {
          console.log(`✅ Reset data for ${data.playersReset} players`);
        }
      } else {
        console.error("❌ Backend data reset failed:", response.status, response.statusText);
        throw new Error(`Backend reset failed: ${response.status}`);
      }
    } catch (error) {
      console.error("❌ Error calling backend reset API:", error);
      throw error;
    }
  }

  // ✅ Reset all wallet data from localStorage
  resetAllWalletData() {
    console.log("🗑️ Resetting all wallet data from localStorage");

    try {
      const keysToRemove = [];

      // Find all wallet-related keys in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('lastKnownStreak_') ||
          key.startsWith('currentStreak_') ||
          key.startsWith('maxStreak_') ||
          key.startsWith('avgGuessesPerWin_') ||
          key.startsWith('gamesPlayed_') ||
          key.startsWith('gamesWon_') ||
          key.startsWith('walletStats_') ||
          key.startsWith('streakData_') ||
          key === 'lastWalletAddress' ||
          key === 'gameFinishState' ||
          key === 'gamePauseState'
        )) {
          keysToRemove.push(key);
        }
      }

      // Remove all wallet-related data
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`🗑️ Removed: ${key}`);
      });

      console.log(`✅ Cleared ${keysToRemove.length} wallet data entries from localStorage`);
    } catch (error) {
      console.error("❌ Error clearing wallet data:", error);
    }
  }

  // ✅ Reset game to initial disabled state
  resetGameToInitialState() {
    console.log("🔄 Resetting game to initial state");

    // Reset game variables
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

    // Reset visual game board
    this.resetGameBoard();

    // Reset streak display in footer
    this.resetStreakDisplay();

    // Enable game for new players
    if (window.enableGame) {
      window.enableGame();
    }
  }

  // ✅ Reset game board visual elements
  resetGameBoard() {
    // Clear all tiles
    const squares = document.querySelectorAll(".square");
    squares.forEach((square) => {
      // Store whether this square was disabled before clearing
      const wasDisabled = square.classList.contains('disabled-square');

      square.textContent = "";
      square.style.backgroundColor = "";
      square.style.borderColor = "";
      square.style.transform = "";
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

        console.log(`🎯 Preserved disabled state for square ${square.id} in pause-handler`);
      } else {
        // Reset theme-appropriate styling for enabled squares
        const isLightMode = document.querySelector("html").classList.contains("switch");
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
      const isLightMode = document.querySelector("html").classList.contains("switch");
      if (isLightMode && !button.classList.contains("switch")) {
        button.classList.add("switch");
      }
    });
  }

  // ✅ Reset streak display in footer
  resetStreakDisplay() {
    const streakCounter = document.querySelector(".steak-counter");
    if (streakCounter) {
      streakCounter.textContent = "0";
    }

    const prizeCounter = document.querySelector(".prize-count");
    if (prizeCounter) {
      prizeCounter.textContent = "0";
    }

    // Note: Difficulty is NOT reset here - this function is called during timer resets
    // Difficulty should only be reset when there's an actual streak loss
  }

  // ✅ NEW: Reset difficulty specifically for streak losses
  resetDifficultyForStreakLoss() {
    if (window.difficultyManager) {
      window.difficultyManager.resetDifficulty();
      console.log("🎯 Reset difficulty due to actual streak loss");
    }
  }

  // ✅ Update pause overlay details
  updatePauseDetails(data) {
    // Message is now static, so no need to update it
    // Admin and time elements have been removed
  }

  // ✅ Update connection status
  updateConnectionStatus(status) {
    const statusEl = document.getElementById("connection-status");
    if (statusEl) {
      statusEl.textContent = status;
    }
  }

  // ✅ Show pause notification
  showPauseNotification(message = "Game is paused") {
    // Create temporary notification
    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
      color: white;
      padding: 15px 25px;
      border-radius: 10px;
      font-weight: bold;
      z-index: 1000000;
      box-shadow: 0 4px 20px rgba(244, 67, 54, 0.4);
      transform: translateX(100%);
      transition: all 0.3s ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.style.transform = "translateX(0)";
    }, 10);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.transform = "translateX(100%)";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // ✅ Save pause state to localStorage
  savePauseState() {
    const state = {
      isPaused: this.isPaused,
      pauseInfo: this.pauseInfo,
      timestamp: Date.now(),
    };

    localStorage.setItem("gamePauseState", JSON.stringify(state));
  }

  // ✅ Clear pause state from localStorage
  clearPauseState() {
    localStorage.removeItem("gamePauseState");
  }

  // ✅ Clear finish state from localStorage
  clearFinishState() {
    localStorage.removeItem("gameFinishState");
  }

  // ✅ Restore pause state from localStorage
  restorePauseState() {
    try {
      const storedState = localStorage.getItem("gamePauseState");
      if (!storedState) return;

      const state = JSON.parse(storedState);
      const age = Date.now() - state.timestamp;

      // Only restore if less than 10 minutes old
      if (age < 10 * 60 * 1000 && state.isPaused) {
        console.log("🔄 Restoring pause state from localStorage");
        this.handleGamePaused(
          state.pauseInfo || {
            isPaused: true,
            pausedBy: "System",
            pausedAt: new Date(state.timestamp).toISOString(),
            message: "Game was paused (restored from local storage)",
          }
        );
      } else if (age >= 10 * 60 * 1000) {
        // Clear old state
        this.clearPauseState();
      }
    } catch (error) {
      console.error("❌ Failed to restore pause state:", error);
      this.clearPauseState();
    }
  }

  // ✅ Restore finish state from localStorage
  restoreFinishState() {
    try {
      const storedState = localStorage.getItem("gameFinishState");
      if (!storedState) return;

      const state = JSON.parse(storedState);
      const age = Date.now() - state.timestamp;

      // Only restore if less than 10 minutes old
      if (age < 10 * 60 * 1000 && state.isFinished) {
        console.log("🔄 Restoring finish state from localStorage");

        // Restore the finish start time if available
        if (state.finishStartTime) {
          this.finishStartTime = state.finishStartTime;
        }

        this.handleGameStopped({
          ...state.finishInfo,
          isRestoration: true, // Flag to indicate this is a restoration
          isFinished: true,
          finishedAt: new Date(state.timestamp).toISOString(),
          message: "Game was finished (restored from local storage)",
        });
      } else if (age >= 10 * 60 * 1000) {
        // Clear old state
        this.clearFinishState();
      }
    } catch (error) {
      console.error("❌ Failed to restore finish state:", error);
      this.clearFinishState();
    }
  }

  // ✅ Public API methods
  isGamePaused() {
    return this.isPaused;
  }

  getPauseInfo() {
    return this.pauseInfo;
  }

  isGameFinished() {
    return this.isFinished;
  }

  getFinishInfo() {
    return this.finishInfo;
  }

  shouldBlockAction() {
    return this.isPaused || this.isFinished;
  }

  // ✅ Cleanup method
  destroy() {
    // Clear intervals
    if (this.pauseCheckInterval) {
      clearInterval(this.pauseCheckInterval);
    }
    if (this.finishCountdownInterval) {
      clearInterval(this.finishCountdownInterval);
    }

    // Remove event listeners
    document.removeEventListener("keydown", this.blockKeyInput, true);
    document.removeEventListener("click", this.blockClickInput, true);
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange
    );

    // Remove overlay
    if (this.pauseOverlay && this.pauseOverlay.parentNode) {
      this.pauseOverlay.parentNode.removeChild(this.pauseOverlay);
    }

    // Remove styles
    const styles = document.getElementById("game-pause-styles");
    if (styles && styles.parentNode) {
      styles.parentNode.removeChild(styles);
    }

    // Clear state
    this.clearPauseState();
    this.clearFinishState();

    console.log("🗑️ Game Pause Handler destroyed");
  }
}

// ✅ Auto-initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (!window.gamePauseHandler) {
      window.gamePauseHandler = new GamePauseHandler();

      // Restore state if page was refreshed
      window.gamePauseHandler.restorePauseState();
      window.gamePauseHandler.restoreFinishState();

      console.log("🎮✅ Game Pause Handler auto-initialized");
    }
  }, 1000);
});

// ✅ Additional check when window fully loads (including all scripts)
window.addEventListener("load", () => {
  setTimeout(() => {
    if (window.gamePauseHandler) {
      console.log("🔄 Window loaded - checking finish status again");
      window.gamePauseHandler.checkFinishStatus();
    }
  }, 1000);
});

// ✅ Make available globally
window.GamePauseHandler = GamePauseHandler;

// ✅ Debug functions for console testing
window.debugPauseHandler = {
  // Test pause functionality
  simulatePause() {
    if (window.gamePauseHandler) {
      window.gamePauseHandler.handleGamePaused({
        isPaused: true,
        pausedBy: "Debug Test",
        pausedAt: new Date().toISOString(),
        message: "Testing pause functionality from console",
      });
      console.log("🧪 Simulated game pause");
    } else {
      console.error("❌ Game pause handler not available");
    }
  },

  // Test resume functionality
  simulateResume() {
    if (window.gamePauseHandler) {
      window.gamePauseHandler.handleGameResumed({
        isPaused: false,
        resumedBy: "Debug Test",
        resumedAt: new Date().toISOString(),
        message: "Testing resume functionality from console",
      });
      console.log("🧪 Simulated game resume");
    } else {
      console.error("❌ Game pause handler not available");
    }
  },

  // Test reset functionality
  simulateReset() {
    if (window.gamePauseHandler) {
      window.gamePauseHandler.handleGameReset({
        resetBy: "Debug Test",
        resetAt: new Date().toISOString(),
        message: "Testing reset functionality from console",
      });
      console.log("🧪 Simulated game reset");
    } else {
      console.error("❌ Game pause handler not available");
    }
  },

  // Check current status
  getStatus() {
    if (window.gamePauseHandler) {
      const status = {
        isPaused: window.gamePauseHandler.isGamePaused(),
        pauseInfo: window.gamePauseHandler.getPauseInfo(),
        isFinished: window.gamePauseHandler.isGameFinished(),
        finishInfo: window.gamePauseHandler.getFinishInfo(),
        isInitialized: window.gamePauseHandler.isInitialized,
        hasSocket: !!window.gamePauseHandler.socket,
        hasOverlay: !!document.getElementById("game-pause-overlay"),
        hasFinishOverlay: !!document.getElementById("game-finish-overlay"),
      };
      console.table(status);
      return status;
    } else {
      console.error("❌ Game pause handler not available");
      return null;
    }
  },

  // Force check server
  async checkServer() {
    if (window.gamePauseHandler) {
      await window.gamePauseHandler.checkPauseStatus();
      console.log("🔍 Forced server pause status check");
    } else {
      console.error("❌ Game pause handler not available");
    }
  },

  // Test input blocking
  testBlocking() {
    if (window.gamePauseHandler) {
      const wasBlocked = window.gamePauseHandler.shouldBlockAction();
      console.log(
        `🛡️ Input blocking test: ${wasBlocked ? "BLOCKED" : "ALLOWED"}`
      );

      if (wasBlocked) {
        window.gamePauseHandler.showPauseNotification();
      }

      return wasBlocked;
    } else {
      console.error("❌ Game pause handler not available");
      return false;
    }
  },
};

// ✅ Pause helper functions for easy integration
window.pauseHelper = {
  // Check if actions should be blocked
  shouldBlockAction() {
    return window.gamePauseHandler
      ? window.gamePauseHandler.shouldBlockAction()
      : false;
  },

  // Execute function only if not paused
  executeIfNotPaused(fn, blockedMessage = "Action blocked - game is paused") {
    if (this.shouldBlockAction()) {
      this.showPauseNotification(blockedMessage);
      return false;
    }
    return fn();
  },

  // Show pause notification
  showPauseNotification(message = "Game is paused") {
    if (window.gamePauseHandler) {
      window.gamePauseHandler.showPauseNotification(message);
    }
  },

  // Get current pause status
  isPaused() {
    return window.gamePauseHandler
      ? window.gamePauseHandler.isGamePaused()
      : false;
  },

  // Get pause information
  getPauseInfo() {
    return window.gamePauseHandler
      ? window.gamePauseHandler.getPauseInfo()
      : null;
  },

  // Get current finish status
  isFinished() {
    return window.gamePauseHandler
      ? window.gamePauseHandler.isGameFinished()
      : false;
  },

  // Get finish information
  getFinishInfo() {
    return window.gamePauseHandler
      ? window.gamePauseHandler.getFinishInfo()
      : null;
  },
};

// ✅ Auto-wrap common game functions (add your game-specific functions here)
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    // Wrap game functions to respect pause state
    const functionsToWrap = [
      "startNewGame",
      "submitGuess",
      "makeMove",
      "processInput",
      "handleGameAction",
    ];

    functionsToWrap.forEach((fnName) => {
      if (window[fnName] && typeof window[fnName] === "function") {
        const originalFunction = window[fnName];

        window[fnName] = function (...args) {
          if (window.pauseHelper.shouldBlockAction()) {
            window.pauseHelper.showPauseNotification(
              `Cannot ${fnName} - game is paused`
            );
            return false;
          }
          return originalFunction.apply(this, args);
        };

        console.log(`🛡️ Wrapped function: ${fnName}`);
      }
    });
  }, 2000);
});
