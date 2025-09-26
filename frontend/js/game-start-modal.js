// Start Game Modal Functionality

/**
 * Show the Start Game countdown modal
 */
function showStartGameModal() {
  const modal = document.getElementById('game-start-modal');
  const content = document.querySelector('.game-start-content');

  if (!modal || !content) {
    console.warn('⚠️ Start Game modal elements not found');
    return;
  }

  // Show the modal
  modal.classList.add('show');

  // After 7 seconds, start the shrink animation and then hide
  setTimeout(() => {
    content.classList.add('shrinking');

    // After the shrink animation completes, hide the modal
    setTimeout(() => {
      modal.classList.remove('show');
      content.classList.remove('shrinking');

      // Flash the rules button to indicate where it "went"
      const rulesButton = document.querySelector('.header-button-rules');
      if (rulesButton) {
        rulesButton.style.animation = 'flash 0.5s ease-in-out 3 alternate';
        setTimeout(() => {
          rulesButton.style.animation = '';
        }, 1500);
      }
    }, 500); // Duration of shrink animation
  }, 7000); // Wait 7 seconds
}

// Add flash animation for rules button
document.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes flash {
      0% { background-color: transparent; }
      100% { background-color: rgba(78, 205, 196, 0.3); }
    }
  `;
  document.head.appendChild(style);
});

// Make the function globally available
window.showStartGameModal = showStartGameModal;

// Socket listener is now handled centrally in wallet.js following the same pattern as pause/resume modals
// This ensures consistent event handling across all game state changes