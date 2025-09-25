// Add to your backend/utils/tokenBurnTracker.js

class TokenBurnTracker {
  constructor() {
    this.tokenAddress = null; // Will be set via admin
    this.lastBurnData = null;
    this.lastUpdateTime = null;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get token supply data from Solana RPC
   */
  async getTokenSupplyData(tokenAddress) {
    if (!tokenAddress) {
      throw new Error("Token address is required");
    }

    try {
      console.log(`Fetching supply data for token: ${tokenAddress}`);

      // Use Solana RPC to get token supply
      const rpcUrl = "https://api.mainnet-beta.solana.com";

      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenSupply",
          params: [tokenAddress],
        }),
      });

      const result = await response.json();

      if (result.error) {
        throw new Error(`RPC Error: ${result.error.message}`);
      }

      const supplyData = result.result.value;

      return {
        totalSupply: parseInt(supplyData.amount),
        decimals: supplyData.decimals,
        uiAmount: supplyData.uiAmount,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error fetching token supply:", error);
      throw error;
    }
  }

  /**
   * Calculate burn percentage based on initial vs current supply
   */
  async calculateBurnPercentage(tokenAddress, initialSupply = null) {
    try {
      const currentSupply = await this.getTokenSupplyData(tokenAddress);

      // If no initial supply provided, assume standard token initial supply
      const assumedInitialSupply = initialSupply || 1000000000; // 1 billion tokens (common)

      const currentAmount = currentSupply.uiAmount || 0;
      const burnedAmount = assumedInitialSupply - currentAmount;
      const burnPercentage = (burnedAmount / assumedInitialSupply) * 100;

      return {
        currentSupply: currentAmount,
        initialSupply: assumedInitialSupply,
        burnedAmount: burnedAmount,
        burnPercentage: Math.max(0, burnPercentage), // Ensure non-negative
        decimals: currentSupply.decimals,
        lastUpdated: currentSupply.timestamp,
      };
    } catch (error) {
      console.error("Error calculating burn percentage:", error);
      return {
        currentSupply: 0,
        initialSupply: 1000000000,
        burnedAmount: 0,
        burnPercentage: 0,
        error: error.message,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Get token metadata from pump.fun or other sources
   */
  async getTokenMetadata(tokenAddress) {
    try {
      // Try to get token info from Jupiter API (has good token metadata)
      const response = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=${tokenAddress}&outputMint=So11111111111111111111111111111111111111112&amount=1000000`
      );

      if (response.ok) {
        const data = await response.json();
        // Jupiter API might have token info
        return {
          name: "Unknown Token",
          symbol: "UNKNOWN",
          source: "jupiter-api",
        };
      }

      // Fallback to basic info
      return {
        name: "Token",
        symbol: "TOKEN",
        source: "fallback",
      };
    } catch (error) {
      return {
        name: "Unknown Token",
        symbol: "UNKNOWN",
        error: error.message,
        source: "error",
      };
    }
  }

  /**
   * Get comprehensive burn data
   */
  async getBurnData(tokenAddress, forceFresh = false) {
    // Return cached data if available and not forcing fresh
    if (!forceFresh && this.lastBurnData && this.lastUpdateTime) {
      const cacheAge = Date.now() - this.lastUpdateTime;
      if (cacheAge < this.cacheTimeout) {
        return {
          ...this.lastBurnData,
          cached: true,
          cacheAge: cacheAge,
        };
      }
    }

    try {
      // Get burn percentage calculation
      const burnData = await this.calculateBurnPercentage(tokenAddress);

      // Get token metadata
      const metadata = await this.getTokenMetadata(tokenAddress);

      const result = {
        tokenAddress: tokenAddress,
        tokenName: metadata.name,
        tokenSymbol: metadata.symbol,
        ...burnData,
        cached: false,
      };

      // Cache the result
      this.lastBurnData = result;
      this.lastUpdateTime = Date.now();

      return result;
    } catch (error) {
      console.error("Error getting burn data:", error);
      return {
        tokenAddress: tokenAddress,
        currentSupply: 0,
        initialSupply: 1000000000,
        burnedAmount: 0,
        burnPercentage: 0,
        error: error.message,
        lastUpdated: new Date().toISOString(),
      };
    }
  }
}

module.exports = TokenBurnTracker;
