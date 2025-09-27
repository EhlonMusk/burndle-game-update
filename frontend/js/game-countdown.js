// Global Game Countdown Timer System
// Manages 7-day countdown for both Start Game modal and Rules modal

console.log('⏰ Loading game countdown system...');

let gameCountdownInterval = null;
let gameEndTimestamp = null;

/**
 * Start the global game countdown timer
 * @param {number} endTimestamp - Timestamp when game period ends
 */
function startGameCountdown(endTimestamp) {
  console.log('⏰ Starting global game countdown timer with endTimestamp:', endTimestamp);

  // Clear any existing interval
  if (gameCountdownInterval) {
    clearInterval(gameCountdownInterval);
  }

  gameEndTimestamp = endTimestamp;
  console.log('⏰ Game end timestamp set to:', new Date(gameEndTimestamp));

  // Update immediately
  updateCountdownDisplay();

  // Update every second
  gameCountdownInterval = setInterval(updateCountdownDisplay, 1000);
  console.log('⏰ Countdown interval started');
}

/**
 * Update countdown display in all relevant locations
 */
function updateCountdownDisplay() {
  console.log('⏰ updateCountdownDisplay called, gameEndTimestamp:', gameEndTimestamp);

  if (!gameEndTimestamp) {
    console.log('⏰ No gameEndTimestamp set, returning');
    return;
  }

  const now = new Date().getTime();
  const distance = gameEndTimestamp - now;
  console.log('⏰ Time remaining:', distance, 'ms');

  if (distance < 0) {
    // Countdown finished
    clearInterval(gameCountdownInterval);
    gameCountdownInterval = null;

    // Show "00:00:00:00" and update message
    updateCountdownElements("00", "00", "00", "00", "Game period has ended!");
    localStorage.removeItem('gameEndTime');
    localStorage.removeItem('gameStartedAt');
    console.log('⏰ Game period ended');

    // Automatically trigger finish game functionality
    triggerFinishGame();
    return;
  }

  // Calculate time units
  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);

  // Format with leading zeros
  const formattedDays = days.toString().padStart(2, '0');
  const formattedHours = hours.toString().padStart(2, '0');
  const formattedMinutes = minutes.toString().padStart(2, '0');
  const formattedSeconds = seconds.toString().padStart(2, '0');

  // Update all countdown displays
  updateCountdownElements(formattedDays, formattedHours, formattedMinutes, formattedSeconds, "Until the end of this game period, and the start of a new one");
}

/**
 * Update countdown elements in both modals
 */
function updateCountdownElements(days, hours, minutes, seconds, message) {
  console.log('⏰ Updating countdown elements:', { days, hours, minutes, seconds, message });

  // Update Start Game modal countdown (if visible)
  const startGameDays = document.getElementById("start-game-days");
  const startGameHours = document.getElementById("start-game-hours");
  const startGameMinutes = document.getElementById("start-game-minutes");
  const startGameSeconds = document.getElementById("start-game-seconds");

  console.log('⏰ Start Game modal elements found:', {
    days: !!startGameDays,
    hours: !!startGameHours,
    minutes: !!startGameMinutes,
    seconds: !!startGameSeconds
  });

  if (startGameDays) startGameDays.textContent = days;
  if (startGameHours) startGameHours.textContent = hours;
  if (startGameMinutes) startGameMinutes.textContent = minutes;
  if (startGameSeconds) startGameSeconds.textContent = seconds;

  // Update Rules modal countdown (if visible)
  const rulesDays = document.getElementById("days");
  const rulesHours = document.getElementById("hours");
  const rulesMinutes = document.getElementById("minutes");
  const rulesSeconds = document.getElementById("seconds");

  console.log('⏰ Rules modal elements found:', {
    days: !!rulesDays,
    hours: !!rulesHours,
    minutes: !!rulesMinutes,
    seconds: !!rulesSeconds
  });

  if (rulesDays) rulesDays.textContent = days;
  if (rulesHours) rulesHours.textContent = hours;
  if (rulesMinutes) rulesMinutes.textContent = minutes;
  if (rulesSeconds) rulesSeconds.textContent = seconds;

  // Update countdown message in rules modal
  const countdownMessage = document.querySelector(".countdown-message");
  console.log('⏰ Countdown message element found:', !!countdownMessage);
  if (countdownMessage) {
    countdownMessage.textContent = message;
  }
}

/**
 * Initialize countdown on page load (if game is already running)
 */
function initializeGameCountdown() {
  const storedEndTime = localStorage.getItem('gameEndTime');
  console.log('⏰ initializeGameCountdown - stored end time:', storedEndTime);

  if (storedEndTime) {
    const endTimestamp = parseInt(storedEndTime, 10);
    const now = new Date().getTime();

    console.log('⏰ Stored end timestamp:', endTimestamp, new Date(endTimestamp));
    console.log('⏰ Current time:', now, new Date(now));
    console.log('⏰ Time remaining:', endTimestamp - now, 'ms');

    if (endTimestamp > now) {
      // Game is still running, start countdown
      console.log('⏰ Resuming game countdown from localStorage');
      startGameCountdown(endTimestamp);
    } else {
      // Game period ended, cleanup
      console.log('⏰ Game period ended while offline, cleaning up');
      localStorage.removeItem('gameEndTime');
      localStorage.removeItem('gameStartedAt');

      // Set default display to show no countdown
      updateCountdownElements("00", "00", "00", "00", "No active game period");
    }
  } else {
    console.log('⏰ No stored end time found');
    // Set default display to show no countdown
    updateCountdownElements("00", "00", "00", "00", "No active game period");
  }
}

/**
 * Stop the countdown timer
 */
function stopGameCountdown() {
  if (gameCountdownInterval) {
    clearInterval(gameCountdownInterval);
    gameCountdownInterval = null;
  }
  gameEndTimestamp = null;
}

/**
 * Force clear all countdown data and reset display
 */
function clearGameCountdown() {
  console.log('⏰ Force clearing all countdown data');

  // Stop any running timer
  stopGameCountdown();

  // Clear localStorage
  localStorage.removeItem('gameEndTime');
  localStorage.removeItem('gameStartedAt');

  // Reset display
  updateCountdownElements("00", "00", "00", "00", "No active game period");

  console.log('⏰ Countdown cleared and reset');
}

/**
 * Automatically trigger finish game functionality when countdown reaches zero
 */
async function triggerFinishGame() {
  console.log('⏰ Automatically triggering finish game functionality');
  console.log('⏰ Available functions check:');
  console.log('  - toggleFinishGame:', typeof toggleFinishGame);
  console.log('  - showFinishGameModal:', typeof showFinishGameModal);
  console.log('  - window.showFinishGameModal:', typeof window.showFinishGameModal);
  console.log('  - socket:', typeof socket);

  try {
    // Always use socket approach for auto-finish since we're in player context
    if (typeof socket !== 'undefined' && socket && socket.emit) {
      console.log('⏰ Socket available, emitting auto-finish-game event');
      socket.emit('auto-finish-game', {
        reason: 'countdown-expired',
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('⏰ Socket not available, trying direct modal call');

      // Fallback: try to call finish game modal directly
      if (window.showFinishGameModal) {
        console.log('⏰ Calling window.showFinishGameModal directly');
        window.showFinishGameModal([]);
      } else if (typeof showFinishGameModal === 'function') {
        console.log('⏰ Calling global showFinishGameModal directly');
        showFinishGameModal([]);
      } else {
        console.log('⏰ No finish game methods available');
      }
    }
  } catch (error) {
    console.error('⏰ Error triggering finish game automatically:', error);
  }
}

// Make functions globally available
window.startGameCountdown = startGameCountdown;
window.stopGameCountdown = stopGameCountdown;
window.clearGameCountdown = clearGameCountdown;
window.initializeGameCountdown = initializeGameCountdown;

// Initialize countdown when page loads
document.addEventListener('DOMContentLoaded', initializeGameCountdown);

console.log('⏰ Global game countdown system loaded');