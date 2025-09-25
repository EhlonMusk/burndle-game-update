// ============================== DEPOSIT SYSTEM FOR BURNDLE ==============================

const DEPOSIT_AMOUNT = 0.01; // SOL amount required to play
const ADMIN_WALLET = "4QyVojMwySu6wwpJATBTBqiTJSqMgov98HGmUaqGAnoR"; // Using your wallet for testing - replace with actual admin wallet

let depositSystemInitialized = false;
let depositModalElement = null;

// Initialize deposit system when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    initializeDepositSystem();
  }, 1000);
});

function initializeDepositSystem() {
  console.log("🏦 Initializing deposit system...");

  createDepositModal();
  setupDepositListeners();

  depositSystemInitialized = true;
  console.log("✅ Deposit system initialized");
}

// Create the deposit modal with the specified UI
function createDepositModal() {
  if (depositModalElement) {
    return depositModalElement;
  }

  const modal = document.createElement("div");
  modal.id = "deposit-modal";
  modal.className = "deposit-modal";

  modal.innerHTML = `
    <div class="deposit-modal-overlay">
      <div class="deposit-modal-content">
        <h3>Game Entry Fee</h3>
        <p>To play BURNdle, you need to deposit:</p>

        <div class="deposit-amount">
          <span class="amount">${DEPOSIT_AMOUNT} SOL</span>
          <span class="currency" id="deposit-usd-equivalent">≈ $1.50 USD</span>
        </div>

        <div class="deposit-rules">
          <p><strong>Process:</strong></p>
          <ul>
            <li><strong>One Transaction:</strong> Deposit the required amount and the game starts automatically</li>
            <li><strong>Confirmation:</strong> Wait for blockchain confirmation</li>
            <li><strong>Win:</strong> Deposit is returned and your streak increases</li>
            <li><strong>Lose:</strong> Deposit is burned and your streak is reset</li>
          </ul>
        </div>

        <div class="confirmation-warning">
          <p><strong>Important:</strong> Please sign all prompted signature requests. This is to ensure your game is submitted correctly. Game starts automatically after deposit confirmation.</p>
        </div>

        <div class="deposit-status" id="deposit-status" style="display: none;">
          <div class="deposit-loading">
            <div class="loading-spinner"></div>
            <span id="deposit-status-text">Processing transaction...</span>
          </div>
        </div>

        <div class="deposit-actions">
          <button class="deposit-confirm-btn" onclick="handleDepositAndPlay()" id="deposit-confirm-btn">Deposit & Play</button>
          <button class="deposit-cancel-btn" onclick="closeDepositModal()">Cancel</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  depositModalElement = modal;

  // Load SOL price for USD equivalent
  updateSolPrice();

  return modal;
}

// Setup event listeners for deposit system
function setupDepositListeners() {
  // Listen for wallet connection changes
  window.addEventListener('wallet-connected', handleDepositWalletConnected);
  window.addEventListener('wallet-disconnected', handleDepositWalletDisconnected);
}

// Show the deposit modal
async function showDepositModal() {
  // Check if there's already a completed game
  if (window.gameComplete && window.gameId) {
    showToast("Game already completed! Wait for next word.", "info", 3000);
    return;
  }

  // Check if there's already an active game
  if (window.gameEnabled && window.gameId) {
    showToast("Game already in progress!", "info", 3000);
    return;
  }

  // Check if player has already deposited for this period
  try {
    const walletPublicKey = window.getWalletPublicKey();
    if (walletPublicKey) {
      const hasDeposited = await hasPlayerDeposited(walletPublicKey);
      if (hasDeposited) {
        showToast("You have already deposited for this period! Click Play Game to start.", "info", 4000);

        // Try to start game directly if function exists
        if (window.startNewGame) {
          setTimeout(() => {
            window.startNewGame(true); // auto-start since deposit exists
          }, 1000);
        }
        return;
      }
    }
  } catch (error) {
    console.warn("💰 Could not check deposit status before showing modal:", error);
    // Continue to show modal if check fails
  }

  if (!depositModalElement) {
    createDepositModal();
  }

  // Update SOL price before showing
  updateSolPrice();

  // ✅ NEW: Reset button states when opening modal to ensure they're enabled
  resetDepositStatus();

  depositModalElement.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  console.log("💰 Showing deposit modal");
}

// Close the deposit modal
function closeDepositModal() {
  if (depositModalElement) {
    depositModalElement.style.display = 'none';
    document.body.style.overflow = 'auto';

    // Reset any loading states
    resetDepositStatus();
  }

  console.log("❌ Deposit modal closed");
}

// Handle the deposit and play action
async function handleDepositAndPlay() {
  console.log("💳 Processing deposit and play...");

  // Check wallet connection
  if (!window.isWalletConnected || !window.isWalletConnected()) {
    showToast("Please connect your wallet first!", "error", 3000);
    closeDepositModal();
    return;
  }

  const walletPublicKey = window.getWalletPublicKey();
  if (!walletPublicKey) {
    showToast("Wallet not properly connected!", "error", 3000);
    return;
  }

  try {
    // Show loading state
    setDepositStatus("Preparing transaction...", true);

    // Create and send deposit transaction
    const signature = await createDepositTransaction(walletPublicKey);

    if (signature) {
      setDepositStatus("Confirming transaction...", true);

      // Wait for confirmation
      const confirmed = await confirmTransaction(signature);

      if (confirmed) {
        setDepositStatus("Recording deposit...", true);

        // Record deposit on backend
        const recorded = await recordDepositOnBackend(walletPublicKey, signature);

        if (recorded) {
          setDepositStatus("Transaction confirmed! Starting game...", false);

          // Close modal and start game
          setTimeout(() => {
            closeDepositModal();
            startGameAfterDeposit();
          }, 2000);

          showToast("Deposit successful! Game starting...", "success", 3000);
        } else {
          throw new Error("Failed to record deposit on backend");
        }
      } else {
        throw new Error("Transaction confirmation failed");
      }
    }
  } catch (error) {
    console.error("❌ Deposit failed:", error);

    let errorMessage = "Deposit failed. Please try again.";
    if (error.message.includes("User rejected")) {
      errorMessage = "Transaction was cancelled.";
    } else if (error.message.includes("insufficient")) {
      errorMessage = "Insufficient SOL balance.";
    }

    setDepositStatus(errorMessage, false, true);
    showToast(errorMessage, "error", 4000);

    setTimeout(() => {
      resetDepositStatus();
    }, 3000);
  }
}

// Create and send deposit transaction to PDA
async function createDepositTransaction(fromPublicKey) {
  // Check for different possible global variable names (unpkg version uses 'solanaWeb3')
  const solanaWeb3 = window.solanaWeb3 || window.solana || window.web3;

  if (!solanaWeb3) {
    console.error("Available globals:", Object.keys(window).filter(k => k.toLowerCase().includes('solana') || k.toLowerCase().includes('web3')));
    throw new Error("Solana Web3 library not loaded");
  }

  const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = solanaWeb3;

  // Connect to Solana devnet for testing
  const connection = new Connection("https://api.devnet.solana.com");

  // Generate PDA for the game deposit
  const pdaAddress = await generateGamePDA(fromPublicKey);

  // Calculate lamports for deposit
  const lamports = DEPOSIT_AMOUNT * LAMPORTS_PER_SOL;

  // Create transaction
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromPublicKey,
      toPubkey: pdaAddress,
      lamports: lamports,
    })
  );

  // Get recent blockhash
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromPublicKey;

  // Sign and send transaction
  if (window.solana && window.solana.signAndSendTransaction) {
    const { signature } = await window.solana.signAndSendTransaction(transaction);
    console.log("📝 Transaction signature:", signature);
    console.log("🔍 View transaction on Solana Explorer:", `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    return signature;
  } else {
    throw new Error("Wallet does not support signing transactions");
  }
}

// Generate PDA address for game deposits
async function generateGamePDA(playerPublicKey) {
  const solanaWeb3 = window.solanaWeb3 || window.solana || window.web3;

  if (!solanaWeb3) {
    throw new Error("Solana Web3 library not loaded");
  }

  const { PublicKey } = solanaWeb3;

  // For simplicity, we'll just use the admin wallet as the destination
  // In production, you'd generate a proper PDA with a Solana program

  // Validate the admin wallet address
  try {
    return new PublicKey(ADMIN_WALLET);
  } catch (error) {
    console.error("❌ Invalid admin wallet address:", ADMIN_WALLET);
    throw new Error("Invalid admin wallet address configured");
  }
}

// Confirm transaction on blockchain
async function confirmTransaction(signature) {
  const solanaWeb3 = window.solanaWeb3 || window.solana || window.web3;

  if (!solanaWeb3) {
    return false;
  }

  const { Connection } = solanaWeb3;
  const connection = new Connection("https://api.devnet.solana.com");

  try {
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    return !confirmation.value.err;
  } catch (error) {
    console.error("❌ Transaction confirmation error:", error);
    return false;
  }
}

// Record deposit on backend
async function recordDepositOnBackend(walletPublicKey, transactionSignature) {
  try {
    const API_BASE = "http://localhost:3000/api";

    // Simplified deposit recording - only transaction signature needed
    const response = await fetch(`${API_BASE}/record-deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress: walletPublicKey.toString(),
        transactionSignature,
        amount: DEPOSIT_AMOUNT,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Failed to record deposit:", errorData);

      // Handle specific case where player already deposited
      if (response.status === 409 && errorData.hasDeposited) {
        console.log("✅ Player already deposited for this period");
        return true; // Treat as success since deposit exists
      }

      return false;
    }

    const data = await response.json();
    console.log("✅ Deposit recorded on backend:", data);
    return true;
  } catch (error) {
    console.error("❌ Error recording deposit on backend:", error);
    return false;
  }
}

// Start game after successful deposit
async function startGameAfterDeposit() {
  try {
    if (window.startNewGame) {
      await window.startNewGame(true); // auto-start after deposit

      // ✅ NEW: Apply difficulty restrictions AFTER the game has started and board is ready
      setTimeout(() => {
        if (window.difficultyManager) {
          console.log("🎯 Applying difficulty for new game after deposit confirmation and game setup");
          window.difficultyManager.applyDifficultyForNewGame();
        }
      }, 500); // Give time for game setup to complete

      showToast("🎮 Game started! Good luck!", "success", 3000);
    } else {
      showToast("🎮 Deposit complete! Click Play Game to start.", "info", 4000);
    }
  } catch (error) {
    console.error("❌ Error starting game after deposit:", error);
    showToast("Deposit complete, but failed to start game. Please try again.", "warning", 4000);
  }
}

// Update SOL price for USD equivalent display
async function updateSolPrice() {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data = await response.json();
    const solPrice = data.solana?.usd || 0;

    const usdEquivalent = (DEPOSIT_AMOUNT * solPrice).toFixed(2);
    const usdElement = document.getElementById('deposit-usd-equivalent');

    if (usdElement) {
      usdElement.textContent = `(~$${usdEquivalent} USD)`;
    }
  } catch (error) {
    console.warn("⚠️ Failed to fetch SOL price:", error);
  }
}

// Set deposit status (loading, success, error)
function setDepositStatus(message, isLoading = false, isError = false) {
  const statusElement = document.getElementById('deposit-status');
  const statusText = document.getElementById('deposit-status-text');
  const confirmBtn = document.getElementById('deposit-confirm-btn');
  const cancelBtn = document.querySelector('.deposit-cancel-btn');

  if (statusElement && statusText) {
    statusElement.style.display = 'block';
    statusText.textContent = message;

    statusElement.className = 'deposit-status';
    if (isError) {
      statusElement.classList.add('error');
    } else if (!isLoading) {
      statusElement.classList.add('success');
    }

    // Update loading spinner visibility
    const spinner = statusElement.querySelector('.loading-spinner');
    if (spinner) {
      spinner.style.display = isLoading ? 'block' : 'none';
    }
  }

  // Check if this is the "Transaction confirmed" message
  const isTransactionConfirmed = message.includes('Transaction confirmed') || message.includes('Starting game');

  // Disable both buttons during processing or after transaction confirmation
  if (confirmBtn) {
    confirmBtn.disabled = isLoading || isTransactionConfirmed;
    confirmBtn.style.opacity = (isLoading || isTransactionConfirmed) ? '0.6' : '1';
  }

  // ✅ NEW: Also disable Cancel button after transaction confirmation to prevent errors
  if (cancelBtn) {
    cancelBtn.disabled = isTransactionConfirmed;
    cancelBtn.style.opacity = isTransactionConfirmed ? '0.6' : '1';
  }
}

// Reset deposit status
function resetDepositStatus() {
  const statusElement = document.getElementById('deposit-status');
  const confirmBtn = document.getElementById('deposit-confirm-btn');
  const cancelBtn = document.querySelector('.deposit-cancel-btn');

  if (statusElement) {
    statusElement.style.display = 'none';
    statusElement.className = 'deposit-status';
  }

  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.style.opacity = '1';
  }

  // ✅ NEW: Also reset Cancel button state
  if (cancelBtn) {
    cancelBtn.disabled = false;
    cancelBtn.style.opacity = '1';
  }
}

// Handle wallet connection events
function handleDepositWalletConnected(event) {
  console.log("💰 Wallet connected, deposit system ready");
}

function handleDepositWalletDisconnected(event) {
  console.log("💰 Wallet disconnected, closing deposit modal");
  closeDepositModal();
}

// Check if player has already deposited for current period
async function hasPlayerDeposited(playerPublicKey) {
  try {
    const API_BASE = "http://localhost:3000/api";
    const response = await fetch(`${API_BASE}/game-status/${playerPublicKey}`);

    if (!response.ok) {
      console.warn("💰 Failed to check deposit status, assuming no deposit");
      return false;
    }

    const data = await response.json();
    const hasDeposited = data?.data?.hasDepositedThisPeriod || false;

    console.log(`💰 Deposit check for ${playerPublicKey.slice(0, 8)}...: ${hasDeposited ? 'deposited' : 'needs deposit'}`);
    return hasDeposited;
  } catch (error) {
    console.error("💰 Error checking deposit status:", error);
    return false; // Assume no deposit on error
  }
}

// Global functions for use by other scripts
window.depositSystem = {
  showModal: showDepositModal,
  closeModal: closeDepositModal,
  hasDeposited: hasPlayerDeposited,
  isInitialized: () => depositSystemInitialized
};

// Make functions globally available
window.showDepositModal = showDepositModal;
window.closeDepositModal = closeDepositModal;
window.handleDepositAndPlay = handleDepositAndPlay;

// Debug: Check available Solana Web3 globals
setTimeout(() => {
  const solanaKeys = Object.keys(window).filter(k => k.toLowerCase().includes('solana') || k.toLowerCase().includes('web3'));
  console.log("💰 Available Solana/Web3 globals:", solanaKeys);

  // Test direct access
  if (typeof window.solanaWeb3 !== 'undefined') {
    console.log("✅ window.solanaWeb3 is available");
  } else {
    console.log("❌ window.solanaWeb3 not found, checking alternatives...");

    // Check if it's just 'solana'
    if (typeof window.solana !== 'undefined' && window.solana.Connection) {
      console.log("✅ Found Solana Web3 under window.solana");
    }
  }
}, 1000);

console.log("💰 Deposit system loaded");