let burnModal = null;
let lastBurnUpdate = null;
let burnDataCache = null;
let burnUpdateInterval = null;

// Initialize burn modal when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  initializeBurnModal();
});

/**
 * Initialize burn modal functionality
 */
function initializeBurnModal() {
  burnModal = document.getElementById("burn-modal");

  if (!burnModal) {
    console.warn("⚠️ Burn modal element not found");
    return;
  }

  // Set up event listeners
  setupBurnModalEventListeners();
}

/**
 * Set up event listeners for burn modal
 */
function setupBurnModalEventListeners() {
  // Burn button in header
  const burnButton = document.querySelector(".header-right-burn");
  if (burnButton) {
    burnButton.addEventListener("click", openBurnModal);
  }

  // Close modal when clicking outside
  if (burnModal) {
    burnModal.addEventListener("click", function (e) {
      if (e.target === burnModal) {
        closeBurnModal();
      }
    });
  }

  // ESC key to close modal
  document.addEventListener("keydown", function (e) {
    if (
      e.key === "Escape" &&
      burnModal &&
      burnModal.classList.contains("show")
    ) {
      closeBurnModal();
    }
  });
}

/**
 * Open burn modal and load data
 */
async function openBurnModal() {
  if (!burnModal) {
    console.error("❌ Burn modal not found");
    return;
  }

  // Show modal
  burnModal.classList.add("show");
  document.body.style.overflow = "hidden";

  // Apply theme
  applyThemeToBurnModal();

  // Load burn data
  await loadBurnData();

  // Start auto-refresh (every 2 minutes)
  if (burnUpdateInterval) {
    clearInterval(burnUpdateInterval);
  }
  burnUpdateInterval = setInterval(loadBurnData, 2 * 60 * 1000);
}

/**
 * Close burn modal
 */
function closeBurnModal() {
  if (!burnModal) return;

  burnModal.classList.remove("show");
  document.body.style.overflow = "";

  // Stop auto-refresh
  if (burnUpdateInterval) {
    clearInterval(burnUpdateInterval);
    burnUpdateInterval = null;
  }
}

/**
 * ✅ FIXED: Load burn data from working creator-fees API
 */
async function loadBurnData(forceRefresh = false) {
  try {
    // Show loading states
    showBurnLoadingStates();

    // Use the working admin creator-fees endpoint
    const apiUrl = forceRefresh
      ? "/api/admin/creator-fees/fresh" // Force fresh data
      : "/api/admin/creator-fees"; // Use cache if available

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Failed to load creator fees");
    }

    // Transform the data for burn modal format
    const transformedData = {
      totalFeesSOL: result.data.totalFeesSOL || 0,
      totalFeesUSD: result.data.totalFeesUSD || 0,
      coinsCreated: result.data.coinsCreated || 0,
      solPrice: result.data.solPrice || 150,
      lastUpdated: result.data.lastUpdated || new Date().toISOString(),
      source: result.data.source || "unknown",
    };

    const metadata = {
      cached: result.cached || false,
      timestamp: new Date().toISOString(),
      source: result.data.source,
    };

    // Update UI with data
    updateBurnUI(transformedData, metadata);

    // Cache the data
    burnDataCache = { data: transformedData, metadata };
    lastBurnUpdate = new Date();

    // Show success message for manual refresh
    if (forceRefresh) {
      showBurnToast("🔥 Creator fees refreshed successfully!", "success");
    }
  } catch (error) {
    console.error("❌ Error loading creator fees:", error);

    // Show error states
    showBurnErrorStates(error.message);

    // Try to use cached data if available
    if (burnDataCache && burnDataCache.data) {
      updateBurnUI(burnDataCache.data, {
        ...burnDataCache.metadata,
        cached: true,
        error: error.message,
      });
    }

    // Show error message
    showBurnToast(`❌ Failed to load creator fees: ${error.message}`, "error");
  }
}

/**
 * Update burn modal UI with data
 */
function updateBurnUI(data, metadata) {
  try {
    // Update fees data
    updateFeesDisplay(data);

    // Update burn percentage
    updateBurnPercentage(data);

    // Update last updated time
    updateLastUpdatedTime(data, metadata);

    // Hide loading states
    hideBurnLoadingStates();
  } catch (error) {
    console.error("❌ Error updating burn UI:", error);
    showBurnErrorStates(error.message);
  }
}

/**
 * Update fees display
 */
function updateFeesDisplay(data) {
  // Update USD fees
  const feesUsdElement = document.getElementById("fees-usd-value");
  if (feesUsdElement) {
    const usdFormatted = data.totalFeesUSD
      ? `$${data.totalFeesUSD.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "$0.00";
    feesUsdElement.textContent = usdFormatted;

    if (data.mock) {
      feesUsdElement.title = "Mock data for development";
    }
  }

  // Update SOL fees
  const feesSolElement = document.getElementById("fees-sol-value");
  if (feesSolElement) {
    const solFormatted = data.totalFeesSOL
      ? `${data.totalFeesSOL.toLocaleString("en-US", {
          minimumFractionDigits: 4,
          maximumFractionDigits: 4,
        })} SOL`
      : "0.0000 SOL";
    feesSolElement.textContent = solFormatted;

    if (data.mock) {
      feesSolElement.title = "Mock data for development";
    }
  }
}

async function updateBurnPercentage(data) {
  // Try to get real token burn data if token address is configured
  try {
    const tokenAddress = await getConfiguredTokenAddress();

    if (tokenAddress) {
      const burnResponse = await fetch(
        `/api/admin/token-burn?tokenAddress=${tokenAddress}`
      );
      const burnResult = await burnResponse.json();

      if (burnResult.success) {
        const burnData = burnResult.data;

        // Update burn percentage
        const burnPercentageElement = document.getElementById(
          "burn-percentage-value"
        );
        if (burnPercentageElement) {
          burnPercentageElement.textContent = `${burnData.burnPercentage.toFixed(
            2
          )}%`;
        }

        // Update progress bar
        const burnProgressFill = document.getElementById("burn-progress-fill");
        if (burnProgressFill) {
          burnProgressFill.style.width = `${Math.min(
            burnData.burnPercentage,
            100
          )}%`;
        }

        // Update token details with real data
        const tokensBurnedElement = document.getElementById(
          "tokens-burned-value"
        );
        if (tokensBurnedElement) {
          const burnedFormatted = burnData.burnedAmount.toLocaleString(
            "en-US",
            {
              maximumFractionDigits: 0,
            }
          );
          tokensBurnedElement.textContent = burnedFormatted;
        }

        const totalSupplyElement =
          document.getElementById("total-supply-value");
        if (totalSupplyElement) {
          const supplyFormatted = burnData.initialSupply.toLocaleString(
            "en-US",
            {
              maximumFractionDigits: 0,
            }
          );
          totalSupplyElement.textContent = supplyFormatted;
        }

        return; // Exit early if we got real data
      }
    }
  } catch (error) {
    console.warn("Error fetching real burn data, using placeholder:", error);
  }

  // Fallback to placeholder data if no token configured or error occurred
  const burnPercentageElement = document.getElementById(
    "burn-percentage-value"
  );
  if (burnPercentageElement) {
    burnPercentageElement.textContent = "0.00%";
  }

  const burnProgressFill = document.getElementById("burn-progress-fill");
  if (burnProgressFill) {
    burnProgressFill.style.width = "0%";
  }

  const tokensBurnedElement = document.getElementById("tokens-burned-value");
  if (tokensBurnedElement) {
    tokensBurnedElement.textContent = "0";
  }

  const totalSupplyElement = document.getElementById("total-supply-value");
  if (totalSupplyElement) {
    totalSupplyElement.textContent = "1,000,000,000";
  }
}

async function getConfiguredTokenAddress() {
  try {
    // You might store this in localStorage, fetch from API, or have it configured
    // For now, return null - you'll need to implement token address storage

    // Option 1: Get from localStorage
    return localStorage.getItem("configuredTokenAddress");

    // Option 2: Get from API endpoint
    // const response = await fetch('/api/admin/token-config');
    // const result = await response.json();
    // return result.success ? result.data.tokenAddress : null;
  } catch (error) {
    console.error("Error getting configured token address:", error);
    return null;
  }
}

/**
 * Update last updated time
 */
function updateLastUpdatedTime(data, metadata) {
  const lastUpdatedElement = document.getElementById("last-updated");
  if (lastUpdatedElement) {
    const updateTime = new Date(data.lastUpdated || metadata.timestamp);
    const timeString = updateTime.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    let statusText = `Last updated: ${timeString}`;


    if (metadata.mock) {
      statusText += " (mock data)";
    }


    lastUpdatedElement.textContent = statusText;
  }
}

/**
 * Show loading states
 */
function showBurnLoadingStates() {
  const loadingElements = [
    "fees-usd-loading",
    "fees-sol-loading",
    "burn-percentage-loading",
    "tokens-burned-loading",
    "total-supply-loading",
  ];

  const valueElements = [
    "fees-usd-value",
    "fees-sol-value",
    "burn-percentage-value",
    "tokens-burned-value",
    "total-supply-value",
  ];

  // Show loading spinners
  loadingElements.forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.style.display = "inline-block";
    }
  });

  // Show loading text
  valueElements.forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = "Loading...";
      element.className = "loading-text";
    }
  });

  // Disable refresh button
  const refreshBtn = document.getElementById("refresh-btn");
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = "🔄 Loading...";
  }
}

/**
 * Hide loading states
 */
function hideBurnLoadingStates() {
  const loadingElements = [
    "fees-usd-loading",
    "fees-sol-loading",
    "burn-percentage-loading",
    "tokens-burned-loading",
    "total-supply-loading",
  ];

  // Hide loading spinners
  loadingElements.forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.style.display = "none";
    }
  });

  // Remove loading class from value elements
  const valueElements = [
    "fees-usd-value",
    "fees-sol-value",
    "burn-percentage-value",
    "tokens-burned-value",
    "total-supply-value",
  ];

  valueElements.forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.className = "";
    }
  });

  // Re-enable refresh button
  const refreshBtn = document.getElementById("refresh-btn");
  if (refreshBtn) {
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = "🔄 Refresh Data";
  }
}

/**
 * Show error states
 */
function showBurnErrorStates(errorMessage) {
  const valueElements = [
    { id: "fees-usd-value", fallback: "$0.00" },
    { id: "fees-sol-value", fallback: "0.0000 SOL" },
    { id: "burn-percentage-value", fallback: "0.00%" },
    { id: "tokens-burned-value", fallback: "0" },
    { id: "total-supply-value", fallback: "1,000,000,000" },
  ];

  valueElements.forEach(({ id, fallback }) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = fallback;
      element.className = "error-text";
      element.title = `Error: ${errorMessage}`;
    }
  });

  // Hide loading states
  hideBurnLoadingStates();

  // Update last updated with error
  const lastUpdatedElement = document.getElementById("last-updated");
  if (lastUpdatedElement) {
    lastUpdatedElement.textContent = `Error: ${errorMessage}`;
    lastUpdatedElement.className = "error-text";
  }
}

/**
 * Manual refresh function (called by refresh button)
 */
async function refreshBurnData() {
  await loadBurnData(true); // Force refresh
}

/**
 * Show burn-specific toast messages
 */
function showBurnToast(message, type = "info") {
  // Remove any existing burn toasts
  const existingToast = document.querySelector(".leaderboard-toast");
  if (existingToast) {
    existingToast.remove();
  }

  // Create new toast
  const toast = document.createElement("div");
  toast.className = `leaderboard-toast ${type}`;
  toast.textContent = message;

  // Add to document
  document.body.appendChild(toast);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (toast && toast.parentNode) {
      toast.style.animation = "slideOutRight 0.3s ease-in forwards";
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }
  }, 3000);
}

/**
 * Apply theme to burn modal
 */
function applyThemeToBurnModal() {
  if (!burnModal) return;

  const isDarkMode = !document.body.classList.contains("switch");

  if (isDarkMode) {
    burnModal.classList.remove("switch");
  } else {
    burnModal.classList.add("switch");
  }

  console.log(
    `🎨 Applied ${isDarkMode ? "dark" : "light"} theme to burn modal`
  );
}

/**
 * Get burn data for external use
 */
function getBurnData() {
  return burnDataCache;
}

/**
 * Get burn status for debugging
 */
async function getBurnStatus() {
  try {
    const response = await fetch("/api/admin/creator-fees");
    const result = await response.json();

    return result;
  } catch (error) {
    console.error("❌ Error getting burn status:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Debug burn data loading
 */
async function debugBurnData() {
  try {
    // Test main endpoint
    const mainResponse = await fetch("/api/admin/creator-fees");
    const mainResult = await mainResponse.json();

    // Test fresh endpoint
    const freshResponse = await fetch("/api/admin/creator-fees/fresh");
    const freshResult = await freshResponse.json();

    // Test health endpoint
    const healthResponse = await fetch("/api/admin/scraper-health");
    const healthResult = await healthResponse.json();

    return {
      main: mainResult,
      fresh: freshResult,
      health: healthResult,
    };
  } catch (error) {
    console.error("❌ Error in debug burn data:", error);
    return { error: error.message };
  }
}

/**
 * Force update burn data from external call
 */
async function updateBurnData() {
  if (burnModal && burnModal.classList.contains("show")) {
    await loadBurnData();
  }
}

/**
 * Auto-refresh burn data when modal is visible
 */
function startBurnAutoRefresh() {
  if (burnUpdateInterval) {
    clearInterval(burnUpdateInterval);
  }

  burnUpdateInterval = setInterval(() => {
    if (burnModal && burnModal.classList.contains("show")) {
      loadBurnData();
    }
  }, 2 * 60 * 1000); // 2 minutes

  console.log("⏰ Burn auto-refresh started (2 minutes interval)");
}

/**
 * Stop burn auto-refresh
 */
function stopBurnAutoRefresh() {
  if (burnUpdateInterval) {
    clearInterval(burnUpdateInterval);
    burnUpdateInterval = null;
  }
}

/**
 * Handle WebSocket updates for burn data (if needed)
 */
function handleBurnWebSocketUpdate(data) {
  if (burnModal && burnModal.classList.contains("show")) {
    // Update UI with WebSocket data if modal is open
    updateBurnUI(data, { timestamp: new Date().toISOString(), realtime: true });
    showBurnToast("🔥 Burn data updated in real-time!", "info");
  }
}

// Global functions for external access
window.openBurnModal = openBurnModal;
window.closeBurnModal = closeBurnModal;
window.refreshBurnData = refreshBurnData;
window.getBurnData = getBurnData;
window.getBurnStatus = getBurnStatus;
window.debugBurnData = debugBurnData;
window.updateBurnData = updateBurnData;
window.handleBurnWebSocketUpdate = handleBurnWebSocketUpdate;

// Listen for theme changes
document.addEventListener("themeChanged", function () {
  if (burnModal && burnModal.classList.contains("show")) {
    applyThemeToBurnModal();
  }
});

// Listen for WebSocket updates (if implemented)
if (typeof window.socket !== "undefined") {
  window.socket.on("burn-data-updated", handleBurnWebSocketUpdate);
}
