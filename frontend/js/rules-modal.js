let rulesModal = null;
let countdownInterval = null;

// Initialize rules modal when DOM is ready
document.addEventListener("DOMContentLoaded", function() {
  initializeRulesModal();
});

/**
 * Initialize rules modal functionality
 */
function initializeRulesModal() {
  rulesModal = document.getElementById("rules-modal");

  if (!rulesModal) {
    console.warn("⚠️ Rules modal element not found");
    return;
  }

  setupRulesModalEventListeners();
}

/**
 * Set up event listeners for rules modal
 */
function setupRulesModalEventListeners() {
  // Rules button click handler
  const rulesButton = document.querySelector(".header-button-rules");
  if (rulesButton) {
    rulesButton.addEventListener("click", openRulesModal);
  }

  // Click outside modal to close
  if (rulesModal) {
    rulesModal.addEventListener("click", function (e) {
      if (e.target === rulesModal) {
        closeRulesModal();
      }
    });
  }

  // ESC key to close
  document.addEventListener("keydown", function (e) {
    if (
      e.key === "Escape" &&
      rulesModal &&
      rulesModal.classList.contains("show")
    ) {
      closeRulesModal();
    }
  });
}

/**
 * Open rules modal and start countdown
 */
function openRulesModal() {
  if (!rulesModal) {
    console.error("❌ Rules modal not found");
    return;
  }

  console.log("📋 Opening rules modal");
  rulesModal.classList.add("show");
  document.body.style.overflow = "hidden";

  // Apply theme
  applyThemeToRulesModal();

  // Initialize the global countdown system (will resume if a game is running)
  if (window.initializeGameCountdown) {
    console.log("📋 Initializing global countdown system for rules modal");
    window.initializeGameCountdown();
  } else {
    console.warn("⚠️ Global countdown system not available");
  }
}

/**
 * Close rules modal
 */
function closeRulesModal() {
  if (!rulesModal) return;

  rulesModal.classList.remove("show");
  document.body.style.overflow = "";

  // Don't stop the global countdown - it should keep running for both modals
  console.log("📋 Rules modal closed (keeping global countdown running)");
}

/**
 * Apply theme to rules modal
 */
function applyThemeToRulesModal() {
  if (!rulesModal) return;

  const isDarkMode = !document.documentElement.classList.contains("switch");

  if (isDarkMode) {
    rulesModal.classList.remove("switch");
  } else {
    rulesModal.classList.add("switch");
  }

  console.log(
    `🎨 Applied ${isDarkMode ? "dark" : "light"} theme to rules modal`
  );
}

/**
 * Legacy function - now handled by global countdown system
 * @deprecated Use the global countdown system from game-countdown.js
 */
function startGameCountdown_DEPRECATED() {
  console.warn("⚠️ Using deprecated local startGameCountdown - should use global system");
  // Set static 7-day countdown (frozen) - for backwards compatibility only
  document.getElementById("days").textContent = "07";
  document.getElementById("hours").textContent = "00";
  document.getElementById("minutes").textContent = "00";
  document.getElementById("seconds").textContent = "00";
}

/**
 * Legacy function - now handled by global countdown system
 * @deprecated Use the global countdown system from game-countdown.js
 */
function stopGameCountdown_DEPRECATED() {
  console.warn("⚠️ Using deprecated local stopGameCountdown - should use global system");
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

/**
 * Update countdown display
 */
function updateCountdown(targetDate) {
  const now = new Date().getTime();
  const distance = targetDate.getTime() - now;

  if (distance < 0) {
    // Countdown finished
    document.getElementById("days").textContent = "0";
    document.getElementById("hours").textContent = "0";
    document.getElementById("minutes").textContent = "0";
    document.getElementById("seconds").textContent = "0";
    document.querySelector(".countdown-message").textContent = "Game period has ended!";
    stopGameCountdown();
    return;
  }

  // Calculate time units
  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);

  // Update display
  document.getElementById("days").textContent = days.toString().padStart(2, '0');
  document.getElementById("hours").textContent = hours.toString().padStart(2, '0');
  document.getElementById("minutes").textContent = minutes.toString().padStart(2, '0');
  document.getElementById("seconds").textContent = seconds.toString().padStart(2, '0');
}

// Make functions available globally
window.openRulesModal = openRulesModal;
window.closeRulesModal = closeRulesModal;

// Apply theme when theme changes
document.addEventListener("themeChanged", function() {
  if (rulesModal && rulesModal.classList.contains("show")) {
    applyThemeToRulesModal();
  }
});