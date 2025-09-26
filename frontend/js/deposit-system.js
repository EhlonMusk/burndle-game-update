// ============================== DEPOSIT SYSTEM FOR BURNDLE ==============================

console.log("🔴🔴🔴 DEPOSIT SYSTEM: BRAND NEW VERSION LOADING! 🔴🔴🔴");
window.DEPOSIT_SYSTEM_NEW_VERSION = true;
console.log("🔴 DEPOSIT SYSTEM: Starting fresh rebuild");

const DEPOSIT_AMOUNT = 100000; // BURN tokens required to play
const SOL_FEE_AMOUNT = 0.01; // SOL for transaction fees
// BURN_TOKEN_ADDRESS is already declared in wallet.js
// Treasury wallet address - will be fetched from backend
let TREASURY_WALLET = null;

let depositModalElement = null;

// Fetch treasury wallet address from backend
async function fetchTreasuryWallet() {
  if (TREASURY_WALLET) return TREASURY_WALLET;

  try {
    const response = await fetch('http://localhost:3000/api/treasury/stats');
    if (response.ok) {
      const data = await response.json();
      TREASURY_WALLET = data.data.treasuryAddress;
      console.log("✅ Treasury wallet fetched:", TREASURY_WALLET);
      return TREASURY_WALLET;
    }
  } catch (error) {
    console.error("❌ Failed to fetch treasury wallet:", error);
  }

  // Fallback to admin wallet if treasury not available
  TREASURY_WALLET = "5M6pX3QczYErjU8MjRKpgWWzXfU69LwvdCmTQpt2Lai5";
  console.warn("⚠️ Using fallback admin wallet:", TREASURY_WALLET);
  return TREASURY_WALLET;
}

// Create deposit system object immediately
window.depositSystem = {
  showModal: null,
  closeModal: null,
  hasDeposited: null,
  isInitialized: () => {
    return !!(window.depositSystem.showModal && window.depositSystem.closeModal && window.depositSystem.hasDeposited);
  }
};

console.log("✅ Initial deposit system object created");

// Show the deposit modal
function showDepositModal() {
  console.log("💰 showDepositModal called");

  // Create modal if it doesn't exist
  if (!depositModalElement) {
    createDepositModal();
  }

  // Reset the modal state each time it's shown
  resetDepositModalForNewPeriod();

  if (depositModalElement) {
    depositModalElement.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    console.log("💰 Deposit modal shown");
  } else {
    console.error("❌ Could not show deposit modal - modal element not found");
  }
}

// Close the deposit modal
function closeDepositModal() {
  console.log("💰 closeDepositModal called");

  if (depositModalElement) {
    depositModalElement.style.display = 'none';
    document.body.style.overflow = 'auto';
    console.log("💰 Deposit modal closed");
  }
}

// Check if player has already deposited for current period
async function hasPlayerDeposited(playerPublicKey) {
  console.log("💰 hasPlayerDeposited called for:", playerPublicKey?.toString?.()?.slice(0,8) + "...");

  try {
    const API_BASE = "http://localhost:3000/api";
    const response = await fetch(`${API_BASE}/game-status/${playerPublicKey}`);

    if (!response.ok) {
      console.warn("💰 Failed to check deposit status, assuming no deposit");
      return false;
    }

    const data = await response.json();
    const hasDeposited = data?.data?.hasDepositedThisPeriod || false;

    console.log(`💰 Deposit check result: ${hasDeposited ? 'deposited' : 'needs deposit'}`);
    return hasDeposited;
  } catch (error) {
    console.error("💰 Error checking deposit status:", error);
    return false; // Assume no deposit on error
  }
}

// Create the deposit modal
function createDepositModal() {
  console.log("💰 createDepositModal called");

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
          <span class="amount">${DEPOSIT_AMOUNT.toLocaleString()} BURN</span>
          <span class="currency">+ 0.01 SOL (transaction and server fee)</span>
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

  if (document.body) {
    document.body.appendChild(modal);
    depositModalElement = modal;
    console.log("✅ Deposit modal created and added to DOM");
  } else {
    console.error("❌ Cannot create modal - document.body not available");
  }

  return modal;
}

// Assign functions to deposit system
function initializeDepositSystem() {
  console.log("💰 Initializing deposit system...");

  window.depositSystem.showModal = showDepositModal;
  window.depositSystem.closeModal = closeDepositModal;
  window.depositSystem.hasDeposited = hasPlayerDeposited;

  console.log("✅ Deposit system functions assigned");
}

// Handle the deposit and play action
async function handleDepositAndPlay() {
  console.log("💳 Processing BURN token deposit and play...");

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
    setDepositStatus("Preparing deposit transaction...", true);

    // Fetch treasury wallet address
    await fetchTreasuryWallet();

    // Create and send deposit transaction (BURN tokens + SOL fee)
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
    console.error("❌ BURN token deposit failed:", error);

    let errorMessage = "Deposit failed. Please try again.";
    if (error.message.includes("User rejected")) {
      errorMessage = "Transaction was cancelled.";
    } else if (error.message.includes("insufficient")) {
      errorMessage = `Insufficient funds. You need ${DEPOSIT_AMOUNT.toLocaleString()} BURN tokens and ${SOL_FEE_AMOUNT} SOL to play.`;
    } else if (error.message.includes("don't have a BURN token account")) {
      errorMessage = "You don't have BURN tokens in your wallet.";
    }

    setDepositStatus(errorMessage, false, true);
    showToast(errorMessage, "error", 4000);

    setTimeout(() => {
      resetDepositStatus();
    }, 3000);
  }
}

// Create and send deposit transaction (BURN tokens + SOL fee)
async function createDepositTransaction(fromPublicKey) {
  console.log("💳 Creating deposit transaction (BURN tokens + SOL fee)...");

  // Check for Solana Web3 library
  const solanaWeb3 = window.solanaWeb3 || window.solana || window.web3;
  if (!solanaWeb3) {
    throw new Error("Solana Web3 library not loaded");
  }

  const { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram, LAMPORTS_PER_SOL } = solanaWeb3;

  // Connect to Solana devnet
  const connection = new Connection("https://api.devnet.solana.com");

  try {
    // Token program constants
    const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
    const tokenMintAddress = new PublicKey(BURN_TOKEN_ADDRESS);
    const destinationWallet = new PublicKey(TREASURY_WALLET);

    // Calculate associated token accounts
    const [fromTokenAccount] = await PublicKey.findProgramAddress(
      [
        fromPublicKey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        tokenMintAddress.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const [toTokenAccount] = await PublicKey.findProgramAddress(
      [
        destinationWallet.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        tokenMintAddress.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Check if source account exists and has sufficient balance
    const fromAccountInfo = await connection.getAccountInfo(fromTokenAccount);
    if (!fromAccountInfo) {
      throw new Error("You don't have a BURN token account. Please make sure you have BURN tokens in your wallet.");
    }

    // Check if destination account exists, create if not
    const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
    const transaction = new Transaction();

    // Create destination token account if it doesn't exist
    if (!toAccountInfo) {
      const createAccountInstruction = new TransactionInstruction({
        programId: ASSOCIATED_TOKEN_PROGRAM_ID,
        keys: [
          { pubkey: fromPublicKey, isSigner: true, isWritable: true },
          { pubkey: toTokenAccount, isSigner: false, isWritable: true },
          { pubkey: destinationWallet, isSigner: false, isWritable: false },
          { pubkey: tokenMintAddress, isSigner: false, isWritable: false },
          { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
        ],
        data: new Uint8Array(0), // Empty data for ATA creation
      });
      transaction.add(createAccountInstruction);
    }

    // Convert deposit amount to token units (BURN token has 9 decimals)
    const tokenAmount = DEPOSIT_AMOUNT * Math.pow(10, 9);

    // Create SPL token transfer instruction using browser-compatible approach
    const transferData = new Uint8Array(9);
    transferData[0] = 3; // Transfer instruction opcode

    // Convert amount to little-endian bytes (8 bytes for u64)
    const amountBytes = new ArrayBuffer(8);
    const amountView = new DataView(amountBytes);
    amountView.setBigUint64(0, BigInt(tokenAmount), true); // true = little endian
    transferData.set(new Uint8Array(amountBytes), 1);

    const transferInstruction = new TransactionInstruction({
      programId: TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: fromTokenAccount, isSigner: false, isWritable: true },
        { pubkey: toTokenAccount, isSigner: false, isWritable: true },
        { pubkey: fromPublicKey, isSigner: true, isWritable: false },
      ],
      data: transferData,
    });

    transaction.add(transferInstruction);

    // Add SOL transfer for transaction fees
    const solTransferAmount = SOL_FEE_AMOUNT * LAMPORTS_PER_SOL;
    const solTransferInstruction = SystemProgram.transfer({
      fromPubkey: fromPublicKey,
      toPubkey: destinationWallet,
      lamports: solTransferAmount,
    });
    transaction.add(solTransferInstruction);

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPublicKey;

    // Sign and send transaction using Phantom wallet
    if (window.solana && window.solana.signAndSendTransaction) {
      const { signature } = await window.solana.signAndSendTransaction(transaction);
      console.log("📝 Deposit Transaction signature:", signature);
      console.log(`📝 Transferred: ${DEPOSIT_AMOUNT.toLocaleString()} BURN + ${SOL_FEE_AMOUNT} SOL`);
      console.log("🔍 View transaction on Solana Explorer:", `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
      return signature;
    } else {
      throw new Error("Wallet does not support signing transactions");
    }
  } catch (error) {
    console.error("❌ Error creating BURN token transaction:", error);

    // Provide user-friendly error messages
    if (error.message.includes("don't have a BURN token account")) {
      throw error;
    } else if (error.message.includes("insufficient")) {
      throw new Error(`Insufficient funds. You need ${DEPOSIT_AMOUNT.toLocaleString()} BURN tokens and ${SOL_FEE_AMOUNT} SOL to play.`);
    } else {
      throw new Error("Failed to create deposit transaction. Please try again.");
    }
  }
}

// Confirm transaction on blockchain
async function confirmTransaction(signature) {
  console.log("🔄 Confirming transaction:", signature);

  const solanaWeb3 = window.solanaWeb3 || window.solana || window.web3;
  if (!solanaWeb3) {
    return false;
  }

  const { Connection } = solanaWeb3;
  const connection = new Connection("https://api.devnet.solana.com");

  try {
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    const success = !confirmation.value.err;
    console.log("✅ Transaction confirmation result:", success);
    return success;
  } catch (error) {
    console.error("❌ Transaction confirmation error:", error);
    return false;
  }
}

// Record deposit on backend
async function recordDepositOnBackend(walletPublicKey, transactionSignature) {
  console.log("📝 Recording deposit on backend...");

  try {
    const API_BASE = "http://localhost:3000/api";

    const response = await fetch(`${API_BASE}/record-deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress: walletPublicKey.toString(),
        transactionSignature,
        amount: DEPOSIT_AMOUNT,
        tokenType: 'BURN',
        tokenAddress: BURN_TOKEN_ADDRESS,
        solAmount: SOL_FEE_AMOUNT,
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
  console.log("🎮 Starting game after deposit...");

  try {
    if (window.startNewGame) {
      await window.startNewGame(true); // auto-start after deposit

      // Apply difficulty restrictions after game setup
      setTimeout(() => {
        if (window.difficultyManager) {
          console.log("🎯 Applying difficulty for new game after deposit");
          window.difficultyManager.applyDifficultyForNewGame();
        }
      }, 500);

      showToast("🎮 Game started! Good luck!", "success", 3000);
    } else {
      showToast("🎮 Deposit complete! Click Play Game to start.", "info", 4000);
    }
  } catch (error) {
    console.error("❌ Error starting game after deposit:", error);
    showToast("Deposit complete, but failed to start game. Please try again.", "warning", 4000);
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

  // Disable both buttons during processing or after transaction confirmation
  const isTransactionConfirmed = message.includes('Transaction confirmed') || message.includes('Starting game');
  const shouldDisable = isLoading || isTransactionConfirmed;

  if (confirmBtn) {
    confirmBtn.disabled = shouldDisable;
    confirmBtn.style.opacity = shouldDisable ? '0.6' : '1';
  }

  // Also disable cancel button when transaction is confirmed
  if (cancelBtn) {
    cancelBtn.disabled = isTransactionConfirmed; // Only disable cancel on transaction success, not during loading
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

  if (cancelBtn) {
    cancelBtn.disabled = false;
    cancelBtn.style.opacity = '1';
  }
}

// Reset deposit modal for new game period
function resetDepositModalForNewPeriod() {
  console.log("🔄 Resetting deposit modal for new period");
  resetDepositStatus();

  // Also reset any loading states in the modal
  const confirmBtn = document.getElementById('deposit-confirm-btn');
  const cancelBtn = document.querySelector('.deposit-cancel-btn');

  if (confirmBtn) {
    confirmBtn.textContent = "Deposit & Play";
    confirmBtn.disabled = false;
    confirmBtn.style.opacity = '1';
  }

  if (cancelBtn) {
    cancelBtn.disabled = false;
    cancelBtn.style.opacity = '1';
  }
}

// Simple burn success modal
function showBurnSuccessModal() {
  // Remove any existing modal
  const existingModal = document.getElementById('burn-success-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement("div");
  modal.id = "burn-success-modal";
  modal.style.cssText = `
    position: fixed;
    top: calc(60px + 1rem);
    right: 20px;
    background: #1a1a2e;
    border: 2px solid #ff6b6b;
    border-radius: 10px;
    padding: 20px;
    color: white;
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 15px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease-out;
  `;

  modal.innerHTML = `
    <div style="
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: #ff6b6b;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: checkmark 0.6s ease-in-out;
    ">
      <span style="color: white; font-weight: bold; font-size: 16px;">🔥</span>
    </div>
    <div>
      <div style="font-weight: bold; font-size: 14px;">Deposit burned!</div>
      <div style="font-size: 12px; color: #ccc; margin-top: 2px;">100,000 BURN tokens</div>
    </div>
  `;

  document.body.appendChild(modal);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (modal && modal.parentNode) {
      modal.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => modal.remove(), 300);
    }
  }, 3000);
}

// Simple return success modal
function showReturnSuccessModal() {
  // Remove any existing modal
  const existingModal = document.getElementById('return-success-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement("div");
  modal.id = "return-success-modal";
  modal.style.cssText = `
    position: fixed;
    top: calc(60px + 1rem);
    right: 20px;
    background: #1a1a2e;
    border: 2px solid #4ecdc4;
    border-radius: 10px;
    padding: 20px;
    color: white;
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 15px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease-out;
  `;

  modal.innerHTML = `
    <div style="
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: #4ecdc4;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: checkmark 0.6s ease-in-out;
    ">
      <span style="color: white; font-weight: bold; font-size: 16px;">✓</span>
    </div>
    <div>
      <div style="font-weight: bold; margin-bottom: 2px;">Deposit Returned!</div>
      <div style="font-size: 12px; color: #ccc;">${DEPOSIT_AMOUNT.toLocaleString()} BURN tokens</div>
    </div>
  `;

  // Add CSS animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes checkmark {
      0% {
        transform: scale(0);
      }
      50% {
        transform: scale(1.2);
      }
      100% {
        transform: scale(1);
      }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(modal);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (modal && modal.parentNode) {
      modal.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => modal.remove(), 300);
    }
  }, 3000);
}

// Make functions globally available
window.handleDepositAndPlay = handleDepositAndPlay;
window.resetDepositModalForNewPeriod = resetDepositModalForNewPeriod;
window.showReturnSuccessModal = showReturnSuccessModal;
window.showBurnSuccessModal = showBurnSuccessModal;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeDepositSystem);
} else {
  initializeDepositSystem();
}

console.log("✅ Deposit system script loaded successfully");