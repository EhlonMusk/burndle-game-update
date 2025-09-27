// ============================== FINISH GAME MODAL FUNCTIONALITY ==============================
// frontend/js/finish-game-modal.js - Handle finish game modal display for players

// Show finish game modal when triggered by admin
function showFinishGameModal(leaderboard, endTimestamp = null) {
  console.log("🏁 Showing finish game modal to player");

  // Remove any existing modal
  const existingModal = document.querySelector('.finish-modal-overlay');
  if (existingModal) {
    existingModal.remove();
  }

  // Pause the game when finish modal appears
  pauseGameForFinish();

  const overlay = document.createElement('div');
  overlay.className = 'finish-modal-overlay';
  overlay.innerHTML = `
    <div class="finish-modal">
      <div class="modal-header">
        <h2>🏆 Game Finished!</h2>
        <p class="modal-subtitle">Thanks for playing BURNdle!<br>Prizes will be distributed shortly.<br>Keep an eye on our socials for updates.</p>
      </div>
      <div class="modal-content">
        <div class="top-three-section">
          ${leaderboard && leaderboard.length > 0 ? leaderboard.slice(0, 3).map(player => {
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
                  <span class="wallet-address"
                        title="Click to copy: ${fullWallet}"
                        onclick="copyWalletAddressFinish('${fullWallet}', this)">
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
          }).join('') : `
            <div class="empty-leaderboard">
              <div class="empty-message">
                <span class="empty-icon">🎮</span>
                <h3>No Leaderboard Data Yet</h3>
                <p>Play more games to see the top players appear here!</p>
              </div>
            </div>
          `}
        </div>
        <div class="next-game-section">
          <p class="next-game-text">The next game will start in:</p>
          <div class="countdown-display" id="gameFinishCountdownDisplay">01:00:00</div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Set up the countdown timer
  setupFinishGameCountdownTimer(endTimestamp);

  // Add modal styles if not already present
  if (!document.getElementById('finish-modal-styles')) {
    addFinishModalStyles();
  }
}

// Close finish game modal
function closeFinishModal() {
  const overlay = document.querySelector('.finish-modal-overlay');
  if (overlay) {
    overlay.remove();
  }
  // Clear any running countdown timer
  if (window.finishGameCountdownTimer) {
    clearInterval(window.finishGameCountdownTimer);
    window.finishGameCountdownTimer = null;
  }

  // Resume the game when modal is closed
  resumeGameAfterFinish();
}

// Pause game functionality when finish modal appears
function pauseGameForFinish() {
  console.log("🏁 Pausing game for finish modal");

  // Disable all game inputs
  if (window.gameState) {
    window.gameState.isGameFinished = true;
  }

  // Disable keyboard input and prevent scrolling
  document.body.classList.add('game-finished');
  document.body.style.overflow = 'hidden';

  // Disable all game buttons (keyboard)
  const gameButtons = document.querySelectorAll('.key, .wide-button');
  gameButtons.forEach(button => {
    button.disabled = true;
    button.style.opacity = '0.5';
    button.style.pointerEvents = 'none';
  });

  // Disable all board tiles
  const boardTiles = document.querySelectorAll('.tile');
  boardTiles.forEach(tile => {
    tile.style.pointerEvents = 'none';
  });

  // Disable play button and other interactive elements
  const playButton = document.querySelector('.play-button');
  if (playButton) {
    playButton.style.pointerEvents = 'none';
    playButton.style.opacity = '0.5';
  }

  // Disable all clickable elements in the game area
  const gameContainer = document.getElementById('game');
  if (gameContainer) {
    gameContainer.style.pointerEvents = 'none';
  }

  // Show game finished overlay on the game board
  // showGameFinishedOverlay(); // Removed per user request
}

// Resume game functionality when modal is closed
function resumeGameAfterFinish() {
  console.log("🏁 Resuming game after finish modal closed");

  // Re-enable game inputs
  if (window.gameState) {
    window.gameState.isGameFinished = false;
  }

  // Re-enable keyboard input and restore scrolling
  document.body.classList.remove('game-finished');
  document.body.style.overflow = '';

  // Re-enable all game buttons (keyboard)
  const gameButtons = document.querySelectorAll('.key, .wide-button');
  gameButtons.forEach(button => {
    button.disabled = false;
    button.style.opacity = '';
    button.style.pointerEvents = '';
  });

  // Re-enable all board tiles
  const boardTiles = document.querySelectorAll('.tile');
  boardTiles.forEach(tile => {
    tile.style.pointerEvents = '';
  });

  // Re-enable play button and other interactive elements
  const playButton = document.querySelector('.play-button');
  if (playButton) {
    playButton.style.pointerEvents = '';
    playButton.style.opacity = '';
  }

  // Re-enable all clickable elements in the game area
  const gameContainer = document.getElementById('game');
  if (gameContainer) {
    gameContainer.style.pointerEvents = '';
  }

  // Hide game finished overlay
  hideGameFinishedOverlay();
}

// Show overlay on game board indicating game is finished
function showGameFinishedOverlay() {
  const gameContainer = document.getElementById('game');
  if (!gameContainer) return;

  const overlay = document.createElement('div');
  overlay.className = 'game-finished-overlay';
  overlay.innerHTML = `
    <div class="game-finished-message">
      <h3>🏁 Game Finished</h3>
      <p>Check the results modal for final standings!</p>
    </div>
  `;

  gameContainer.appendChild(overlay);
}

// Hide game finished overlay
function hideGameFinishedOverlay() {
  const overlay = document.querySelector('.game-finished-overlay');
  if (overlay) {
    overlay.remove();
  }
}

// Setup countdown timer
function setupFinishGameCountdownTimer(endTimestamp = null) {
  const countdownEl = document.getElementById('gameFinishCountdownDisplay');
  if (!countdownEl) return;

  // Use provided endTimestamp or create new one (1 hour from now)
  const countdownEnd = endTimestamp ? new Date(endTimestamp) : new Date(Date.now() + 3600 * 1000);
  console.log("🏁⏰ Setting up countdown with end time:", countdownEnd);

  function updateCountdown() {
    const now = new Date();
    const timeDiff = countdownEnd - now;

    if (timeDiff <= 0) {
      countdownEl.textContent = '00:00:00';
      if (window.finishGameCountdownTimer) {
        clearInterval(window.finishGameCountdownTimer);
        window.finishGameCountdownTimer = null;
      }

      console.log('🏁 Finish game countdown expired, triggering automatic start game');

      // Automatically trigger start game after countdown expires
      triggerAutoStartGame();

      return;
    }

    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    countdownEl.textContent = timeString;
  }

  // Clear existing timer if any
  if (window.finishGameCountdownTimer) {
    clearInterval(window.finishGameCountdownTimer);
  }

  // Start the countdown
  updateCountdown();
  window.finishGameCountdownTimer = setInterval(updateCountdown, 1000);
}

// Copy wallet address functionality for finish modal
async function copyWalletAddressFinish(walletAddress, element) {
  if (!walletAddress || walletAddress === "Unknown") {
    console.error("Invalid wallet address");
    return;
  }

  // Visual feedback
  if (element) {
    element.style.background = "rgba(76, 175, 80, 0.3)";
    element.style.borderColor = "#4caf50";
  }

  try {
    // Modern Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(walletAddress);

      if (window.showToast) {
        showToast("Wallet address copied! ✓", "success", 2000);
      }

      // Visual success feedback
      if (element) {
        element.innerHTML = `
          <span>${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}</span>
          <span style="color: #4caf50;">✓ Copied</span>
        `;

        setTimeout(() => {
          element.innerHTML = `
            <span>${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}</span>
            <span class="copy-icon">📋</span>
          `;
          element.style.background = "";
          element.style.borderColor = "";
        }, 2000);
      }
      return;
    }
  } catch (error) {
    console.warn("Clipboard API failed:", error);
  }

  // Fallback method
  try {
    const textArea = document.createElement("textarea");
    textArea.value = walletAddress;
    textArea.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      width: 1px;
      height: 1px;
      padding: 0;
      border: none;
      outline: none;
      background: transparent;
      opacity: 0;
      pointer-events: none;
      z-index: -1;
    `;

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.setSelectionRange(0, textArea.value.length);

    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);

    if (successful) {
      if (window.showToast) {
        showToast("Wallet address copied! ✓", "success", 2000);
      }

      // Visual success feedback
      if (element) {
        element.innerHTML = `
          <span>${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}</span>
          <span style="color: #4caf50;">✓ Copied</span>
        `;

        setTimeout(() => {
          element.innerHTML = `
            <span>${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}</span>
            <span class="copy-icon">📋</span>
          `;
          element.style.background = "";
          element.style.borderColor = "";
        }, 2000);
      }
      return;
    }
  } catch (error) {
    console.error("Fallback copy method failed:", error);
  }

  // Manual copy as last resort
  if (window.showToast) {
    showToast(`Copy manually: ${walletAddress}`, "info", 5000);
  }

  if (element) {
    element.style.background = "rgba(255, 193, 7, 0.3)";
    element.style.borderColor = "#ffc107";
    element.innerHTML = `
      <span>${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}</span>
      <span style="color: #ffc107;">⚠ Manual</span>
    `;

    setTimeout(() => {
      element.innerHTML = `
        <span>${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}</span>
        <span class="copy-icon">📋</span>
      `;
      element.style.background = "";
      element.style.borderColor = "";
    }, 3000);
  }
}

// Add modal styles
function addFinishModalStyles() {
  const styles = document.createElement('style');
  styles.id = 'finish-modal-styles';
  styles.textContent = `
    .finish-modal-overlay {
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
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 999999;
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
    .modal-close-x {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      z-index: 10001;
    }
    .modal-close-x:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.1);
    }
    .modal-header {
      padding: 40px 40px 30px 40px;
      text-align: center;
    }
    .modal-header h2 {
      margin: 0 0 15px 0;
      font-size: 2.5rem;
      font-weight: 700;
      color: white;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }
    .modal-subtitle {
      margin: 0;
      font-size: 1rem;
      color: rgba(255, 255, 255, 0.85);
      line-height: 1.5;
    }
    .modal-content {
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
      background: rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.3s ease;
    }
    .top-player-row:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.2);
      transform: translateY(-2px);
    }
    .top-player-row:last-child {
      margin-bottom: 0;
    }
    .player-rank {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 70px;
      margin-right: 15px;
    }
    .rank-medal {
      font-size: 1.5rem;
    }
    .rank-number {
      font-size: 1.4rem;
      font-weight: bold;
      color: white;
      width: 20px;
    }
    .player-wallet {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-right: 15px;
    }
    .wallet-address {
      background: rgba(255, 255, 255, 0.1);
      color: white;
      padding: 10px 16px;
      border-radius: 8px;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.95rem;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-block;
      border: 1px solid rgba(255, 255, 255, 0.2);
      min-width: 120px;
      text-align: center;
    }
    .wallet-address:hover {
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.3);
    }
    .wallet-address .copy-icon {
      margin-left: 8px;
      opacity: 0.7;
      font-size: 0.8rem;
    }
    .wallet-address:hover .copy-icon {
      opacity: 1;
    }
    .solscan-btn {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: rgba(255, 255, 255, 0.8);
      padding: 6px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      text-decoration: none;
      margin-left: 8px;
    }
    .solscan-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.3);
      color: white;
      transform: scale(1.05);
    }
    .player-stats {
      display: flex;
      gap: 20px;
      align-items: center;
    }
    .stat {
      text-align: center;
      min-width: 60px;
    }
    .stat-label {
      font-size: 0.7rem;
      color: rgba(255, 255, 255, 0.6);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      display: block;
    }
    .stat-value {
      font-size: 1.2rem;
      font-weight: bold;
      color: #ff6b35;
      display: block;
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

    /* Game finished overlay styles */
    .game-finished-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      border-radius: 8px;
    }

    .game-finished-message {
      text-align: center;
      color: white;
      background: rgba(76, 99, 210, 0.9);
      padding: 20px;
      border-radius: 12px;
      border: 2px solid rgba(255, 255, 255, 0.2);
    }

    .game-finished-message h3 {
      margin: 0 0 10px 0;
      font-size: 1.5rem;
    }

    .game-finished-message p {
      margin: 0;
      opacity: 0.9;
    }

    /* Disable game inputs when finished */
    .game-finished .key,
    .game-finished .wide-button {
      opacity: 0.5 !important;
      pointer-events: none !important;
      cursor: not-allowed !important;
    }

    /* Empty leaderboard styles */
    .empty-leaderboard {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 40px 20px;
      min-height: 120px;
    }

    .empty-message {
      text-align: center;
      color: rgba(255, 255, 255, 0.8);
    }

    .empty-icon {
      display: block;
      font-size: 3rem;
      margin-bottom: 15px;
      opacity: 0.7;
    }

    .empty-message h3 {
      margin: 0 0 10px 0;
      font-size: 1.2rem;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
    }

    .empty-message p {
      margin: 0;
      font-size: 0.9rem;
      opacity: 0.7;
      line-height: 1.4;
    }
  `;
  document.head.appendChild(styles);
}

// Automatically trigger start game when finish countdown expires
function triggerAutoStartGame() {
  console.log('🚀 Automatically triggering start game functionality');
  console.log('🚀 Available socket types:', {
    'typeof socket': typeof socket,
    'typeof window.socket': typeof window.socket,
    'window.pauseHandler?.socket': typeof window.pauseHandler?.socket
  });

  try {
    // First close the finish game modal
    if (typeof closeFinishModal === 'function') {
      console.log('🚀 Closing finish game modal');
      closeFinishModal();
    }

    // Try different socket references
    let socketToUse = null;
    if (window.playerSocket && window.playerSocket.emit) {
      socketToUse = window.playerSocket;
      console.log('🚀 Using window.playerSocket');
    } else if (typeof socket !== 'undefined' && socket && socket.emit) {
      socketToUse = socket;
      console.log('🚀 Using global socket');
    } else if (typeof window.socket !== 'undefined' && window.socket && window.socket.emit) {
      socketToUse = window.socket;
      console.log('🚀 Using window.socket');
    } else if (window.pauseHandler && window.pauseHandler.socket && window.pauseHandler.socket.emit) {
      socketToUse = window.pauseHandler.socket;
      console.log('🚀 Using pauseHandler socket');
    }

    if (socketToUse) {
      console.log('🚀 Socket found, emitting auto-start-game event');
      console.log('🚀 Socket connected:', socketToUse.connected);

      socketToUse.emit('auto-start-game', {
        triggeredBy: 'auto-restart',
        reason: 'finish-countdown-expired',
        timestamp: new Date().toISOString()
      });

      console.log('🚀 auto-start-game event emitted successfully');
    } else {
      console.log('🚀 No socket available for auto start game');

      // Fallback: reload the page to restart the game
      console.log('🚀 Fallback: reloading page to restart game in 2 seconds');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }

  } catch (error) {
    console.error('🚀 Error triggering auto start game:', error);

    // Ultimate fallback
    console.log('🚀 Error occurred, falling back to page reload');
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  }
}

// Make functions globally available
window.showFinishGameModal = showFinishGameModal;
window.closeFinishModal = closeFinishModal;
window.copyWalletAddressFinish = copyWalletAddressFinish;
window.triggerAutoStartGame = triggerAutoStartGame;