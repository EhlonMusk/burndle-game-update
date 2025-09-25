// ============================== TOAST SYSTEM ==============================
function showToast(message, type = "default", duration = 2000) {
  const container = document.getElementById("toast-container");

  // Create toast element
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  // Add to container
  container.appendChild(toast);

  // Auto-remove after duration
  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => {
      if (container.contains(toast)) {
        container.removeChild(toast);
      }
    }, 200); // Match fade-out animation duration
  }, duration);
}

// Make showToast globally available
window.showToast = showToast;
