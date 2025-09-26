// ============================== AUTOMATED TREASURY SYSTEM ==============================
// Handles automated BURN token burns and returns with full transparency

const {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL
} = require('@solana/web3.js');

const fs = require('fs');
const path = require('path');

// Configuration
const BURN_TOKEN_ADDRESS = "D1jpDVeZSbAKKfscWZfE5FVrpfyrCGk3aPDz9Jdsm1r4";
const SOLANA_RPC = "https://api.devnet.solana.com";
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

// Initialize Solana connection
const connection = new Connection(SOLANA_RPC, 'confirmed');

// Treasury state
let treasuryKeypair = null;
let treasuryTokenAccount = null;
let transactionLog = [];

// Load treasury keypair (create if doesn't exist)
async function initializeTreasury() {
  const keyPath = path.join(__dirname, '.treasury-key.json');

  try {
    if (fs.existsSync(keyPath)) {
      console.log("🏦 Loading existing treasury keypair...");
      const keyData = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      treasuryKeypair = Keypair.fromSecretKey(new Uint8Array(keyData));
    } else {
      console.log("🏦 Creating new treasury keypair...");
      treasuryKeypair = Keypair.generate();

      // Save keypair securely
      fs.writeFileSync(
        keyPath,
        JSON.stringify(Array.from(treasuryKeypair.secretKey)),
        { mode: 0o600 } // Readable only by owner
      );
      console.log("🔐 Treasury keypair saved securely");
    }

    // Calculate treasury token account address
    const [tokenAccount] = await PublicKey.findProgramAddress(
      [
        treasuryKeypair.publicKey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        new PublicKey(BURN_TOKEN_ADDRESS).toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    treasuryTokenAccount = tokenAccount;

    console.log("✅ Treasury initialized:");
    console.log(`   Treasury Wallet: ${treasuryKeypair.publicKey.toString()}`);
    console.log(`   Token Account: ${treasuryTokenAccount.toString()}`);
    console.log(`   🔍 View on Solana Explorer: https://explorer.solana.com/address/${treasuryKeypair.publicKey.toString()}?cluster=devnet`);

    // Check balances
    await checkTreasuryBalances();

    return true;
  } catch (error) {
    console.error("❌ Failed to initialize treasury:", error);
    return false;
  }
}

// Check treasury balances
async function checkTreasuryBalances() {
  try {
    // SOL balance
    const solBalance = await connection.getBalance(treasuryKeypair.publicKey);
    console.log(`💰 Treasury SOL Balance: ${(solBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

    // BURN token balance
    try {
      const tokenAccountInfo = await connection.getAccountInfo(treasuryTokenAccount);
      if (tokenAccountInfo) {
        const tokenBalance = await connection.getTokenAccountBalance(treasuryTokenAccount);
        console.log(`🔥 Treasury BURN Balance: ${Number(tokenBalance.value.amount).toLocaleString()} BURN`);
      } else {
        console.log(`🔥 Treasury BURN Balance: 0 BURN (account not created)`);
      }
    } catch (tokenError) {
      console.log(`🔥 Treasury BURN Balance: 0 BURN (${tokenError.message})`);
    }

  } catch (error) {
    console.error("❌ Error checking treasury balances:", error);
  }
}

// Return tokens to winner
async function returnTokensToWinner(winnerAddress, amount) {
  console.log(`🎉 Processing winner return: ${amount.toLocaleString()} BURN → ${winnerAddress}`);

  try {
    const winnerPublicKey = new PublicKey(winnerAddress);
    const tokenMint = new PublicKey(BURN_TOKEN_ADDRESS);

    // Calculate winner's token account
    const [winnerTokenAccount] = await PublicKey.findProgramAddress(
      [
        winnerPublicKey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        tokenMint.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Check if winner's token account exists
    const winnerAccountInfo = await connection.getAccountInfo(winnerTokenAccount);
    const transaction = new Transaction();

    // Create winner's token account if it doesn't exist
    if (!winnerAccountInfo) {
      console.log("🔧 Creating token account for winner...");
      const createAccountInstruction = new TransactionInstruction({
        programId: ASSOCIATED_TOKEN_PROGRAM_ID,
        keys: [
          { pubkey: treasuryKeypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: winnerTokenAccount, isSigner: false, isWritable: true },
          { pubkey: winnerPublicKey, isSigner: false, isWritable: false },
          { pubkey: tokenMint, isSigner: false, isWritable: false },
          { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
        ],
        data: Buffer.alloc(0),
      });
      transaction.add(createAccountInstruction);
    }

    // Create token transfer instruction
    const transferAmount = amount * Math.pow(10, 9); // Convert to token units (9 decimals)
    const transferData = Buffer.alloc(9);
    transferData[0] = 3; // Transfer instruction
    transferData.writeBigUInt64LE(BigInt(transferAmount), 1);

    const transferInstruction = new TransactionInstruction({
      programId: TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: treasuryTokenAccount, isSigner: false, isWritable: true },
        { pubkey: winnerTokenAccount, isSigner: false, isWritable: true },
        { pubkey: treasuryKeypair.publicKey, isSigner: true, isWritable: false },
      ],
      data: transferData,
    });

    transaction.add(transferInstruction);

    // Sign and send transaction
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = treasuryKeypair.publicKey;

    const signature = await connection.sendTransaction(transaction, [treasuryKeypair]);
    console.log(`✅ Return transaction sent: ${signature}`);

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    console.log(`🎉 Successfully returned ${amount.toLocaleString()} BURN to winner`);

    // Log transaction for transparency
    logTransaction({
      type: 'RETURN',
      recipient: winnerAddress,
      amount: amount,
      signature: signature,
      timestamp: new Date().toISOString(),
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`
    });

    return { success: true, signature, amount };

  } catch (error) {
    console.error(`❌ Failed to return tokens to winner:`, error);

    // Log failed transaction
    logTransaction({
      type: 'RETURN_FAILED',
      recipient: winnerAddress,
      amount: amount,
      error: error.message,
      timestamp: new Date().toISOString()
    });

    return { success: false, error: error.message };
  }
}

// Burn tokens (send to burn address)
async function burnTokens(amount) {
  console.log(`🔥 Processing token burn: ${amount.toLocaleString()} BURN`);

  try {
    // For burning, we'll send tokens to a known burn address
    const BURN_ADDRESS = "1nc1nerator11111111111111111111111111111111"; // Solana's standard burn address
    const burnPublicKey = new PublicKey(BURN_ADDRESS);
    const tokenMint = new PublicKey(BURN_TOKEN_ADDRESS);

    // Calculate burn token account
    const [burnTokenAccount] = await PublicKey.findProgramAddress(
      [
        burnPublicKey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        tokenMint.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const transaction = new Transaction();

    // Check if burn token account exists
    const burnAccountInfo = await connection.getAccountInfo(burnTokenAccount);
    if (!burnAccountInfo) {
      console.log("🔧 Creating burn token account...");
      const createAccountInstruction = new TransactionInstruction({
        programId: ASSOCIATED_TOKEN_PROGRAM_ID,
        keys: [
          { pubkey: treasuryKeypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: burnTokenAccount, isSigner: false, isWritable: true },
          { pubkey: burnPublicKey, isSigner: false, isWritable: false },
          { pubkey: tokenMint, isSigner: false, isWritable: false },
          { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
        ],
        data: Buffer.alloc(0),
      });
      transaction.add(createAccountInstruction);
    }

    // Create burn transfer instruction
    const transferAmount = amount * Math.pow(10, 9); // Convert to token units
    const transferData = Buffer.alloc(9);
    transferData[0] = 3; // Transfer instruction
    transferData.writeBigUInt64LE(BigInt(transferAmount), 1);

    const transferInstruction = new TransactionInstruction({
      programId: TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: treasuryTokenAccount, isSigner: false, isWritable: true },
        { pubkey: burnTokenAccount, isSigner: false, isWritable: true },
        { pubkey: treasuryKeypair.publicKey, isSigner: true, isWritable: false },
      ],
      data: transferData,
    });

    transaction.add(transferInstruction);

    // Sign and send transaction
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = treasuryKeypair.publicKey;

    const signature = await connection.sendTransaction(transaction, [treasuryKeypair]);
    console.log(`✅ Burn transaction sent: ${signature}`);

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');
    console.log(`🔥 Successfully burned ${amount.toLocaleString()} BURN tokens`);

    // Log transaction for transparency
    logTransaction({
      type: 'BURN',
      amount: amount,
      signature: signature,
      timestamp: new Date().toISOString(),
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`
    });

    return { success: true, signature, amount };

  } catch (error) {
    console.error(`❌ Failed to burn tokens:`, error);

    // Log failed transaction
    logTransaction({
      type: 'BURN_FAILED',
      amount: amount,
      error: error.message,
      timestamp: new Date().toISOString()
    });

    return { success: false, error: error.message };
  }
}

// Log transaction for transparency
function logTransaction(transactionData) {
  transactionLog.push(transactionData);

  // Also write to file for persistence
  const logPath = path.join(__dirname, 'treasury-log.json');
  try {
    let existingLog = [];
    if (fs.existsSync(logPath)) {
      existingLog = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    }
    existingLog.push(transactionData);
    fs.writeFileSync(logPath, JSON.stringify(existingLog, null, 2));

    console.log(`📝 Transaction logged: ${transactionData.type} - ${transactionData.amount ? transactionData.amount.toLocaleString() + ' BURN' : 'N/A'}`);
  } catch (error) {
    console.error("❌ Failed to log transaction:", error);
  }
}

// Get transaction log for transparency dashboard
function getTransactionLog(limit = 100) {
  return transactionLog.slice(-limit).reverse(); // Most recent first
}

// Get treasury stats
async function getTreasuryStats() {
  await checkTreasuryBalances();

  const stats = {
    treasuryAddress: treasuryKeypair?.publicKey?.toString(),
    tokenAccountAddress: treasuryTokenAccount?.toString(),
    totalTransactions: transactionLog.length,
    totalBurned: transactionLog
      .filter(tx => tx.type === 'BURN' && !tx.error)
      .reduce((sum, tx) => sum + tx.amount, 0),
    totalReturned: transactionLog
      .filter(tx => tx.type === 'RETURN' && !tx.error)
      .reduce((sum, tx) => sum + tx.amount, 0),
    recentTransactions: getTransactionLog(10)
  };

  return stats;
}

// Export functions
module.exports = {
  initializeTreasury,
  returnTokensToWinner,
  burnTokens,
  checkTreasuryBalances,
  getTransactionLog,
  getTreasuryStats,
  logTransaction
};

console.log("🏦 Treasury system loaded");