// backend/routes/burn.js
const express = require("express");
const router = express.Router();
const PumpFunScraper = require("../utils/pumpFunScraper");

// Create scraper instance
const pumpFunScraper = new PumpFunScraper();

/**
 * GET /api/burn/creator-fees
 * Get creator fees data from pump.fun
 */
router.get("/creator-fees", async (req, res) => {
  try {
    console.log("📊 Creator fees API endpoint called");

    const forceFresh = req.query.fresh === "true";
    const useMock = req.query.mock === "true";
    const useReal = req.query.real === "true";

    let data;

    if (useMock) {
      console.log("🎭 Using mock data for development");
      data = pumpFunScraper.getMockData();
    } else if (useReal) {
      console.log("📊 Attempting to get real creator data");
      data = await pumpFunScraper.getRealCreatorData();
    } else {
      console.log("🔄 Using enhanced data collection (tries all methods)");
      data = await pumpFunScraper.getCreatorRewards(forceFresh);
    }

    // Add metadata
    const response = {
      success: true,
      data: data,
      metadata: {
        timestamp: new Date().toISOString(),
        cached: !!data.cached,
        cacheAge: data.cacheAge || 0,
        source: data.source || "unknown",
        forceFresh: forceFresh,
        mock: useMock,
        real: useReal,
        note: data.note || null,
      },
    };

    console.log("✅ Creator fees data retrieved successfully");
    res.json(response);
  } catch (error) {
    console.error("❌ Error getting creator fees:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      data: pumpFunScraper.getMockData(), // Fallback to mock data
      metadata: {
        timestamp: new Date().toISOString(),
        fallback: true,
        source: "mock-fallback",
      },
    });
  }
});

/**
 * GET /api/burn/status
 * Get scraper status and diagnostics
 */
router.get("/status", async (req, res) => {
  try {
    const status = pumpFunScraper.getStatus();
    const solPrice = await pumpFunScraper.getSolPrice();

    res.json({
      success: true,
      data: {
        ...status,
        solPrice: solPrice,
        serverTime: new Date().toISOString(),
        uptime: process.uptime(),
      },
    });
  } catch (error) {
    console.error("❌ Error getting burn status:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/burn/refresh
 * Force refresh creator fees data
 */
router.post("/refresh", async (req, res) => {
  try {
    console.log("🔄 Force refreshing creator fees data");

    const data = await pumpFunScraper.getCreatorRewards(true); // Force fresh

    res.json({
      success: true,
      data: data,
      metadata: {
        timestamp: new Date().toISOString(),
        forcedRefresh: true,
        source: data.source || "unknown",
      },
    });
  } catch (error) {
    console.error("❌ Error refreshing creator fees:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/burn/sol-price
 * Get current SOL price
 */
router.get("/sol-price", async (req, res) => {
  try {
    const price = await pumpFunScraper.getSolPrice();

    res.json({
      success: true,
      data: {
        price: price,
        currency: "USD",
        source: "coingecko",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ Error getting SOL price:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      data: {
        price: 150, // Fallback price
        currency: "USD",
        source: "fallback",
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /api/burn/debug
 * Debug endpoint to test scraping
 */
router.get("/debug", async (req, res) => {
  try {
    console.log("🐛 Debug endpoint called");

    // Try enhanced scraping method
    const enhancedData = await pumpFunScraper.getEnhancedCreatorData();
    const status = pumpFunScraper.getStatus();
    const solPrice = await pumpFunScraper.getSolPrice();

    res.json({
      success: true,
      debug: {
        enhancedData: enhancedData,
        scraperStatus: status,
        solPrice: solPrice,
        serverTime: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
      },
    });
  } catch (error) {
    console.error("❌ Debug endpoint error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

/**
 * GET /api/burn/browser-data
 * Get creator fees using browser automation (if available)
 */
router.get("/browser-data", async (req, res) => {
  try {
    console.log("🤖 Browser automation endpoint called");

    const debug = req.query.debug === "true";

    if (debug) {
      const debugData = await pumpFunScraper.getBrowserDataWithDebug();
      res.json({
        success: true,
        data: debugData,
        metadata: {
          timestamp: new Date().toISOString(),
          debug: true,
          method: "browser-automation-debug",
        },
      });
    } else {
      const browserData = await pumpFunScraper.tryBrowserScraping();

      if (browserData) {
        res.json({
          success: true,
          data: browserData,
          metadata: {
            timestamp: new Date().toISOString(),
            method: "browser-automation",
          },
        });
      } else {
        res.status(400).json({
          success: false,
          error: "Browser automation not available or failed",
          fallback: await pumpFunScraper.getRealCreatorData(),
        });
      }
    }
  } catch (error) {
    console.error("❌ Error in browser automation:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/burn/screenshot
 * Take a debug screenshot of the pump.fun profile page
 */
router.post("/screenshot", async (req, res) => {
  try {
    console.log("📸 Screenshot endpoint called");

    const debugData = await pumpFunScraper.getBrowserDataWithDebug();

    res.json({
      success: true,
      message: "Debug screenshot taken",
      data: debugData,
      note: "Screenshot saved as debug-pump-fun-profile.png in the backend directory",
    });
  } catch (error) {
    console.error("❌ Error taking screenshot:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/burn/mock
 * Get mock data for testing
 */
router.get("/mock", (req, res) => {
  try {
    const mockData = pumpFunScraper.getMockData();

    res.json({
      success: true,
      data: mockData,
      metadata: {
        timestamp: new Date().toISOString(),
        mock: true,
        source: "mock",
      },
    });
  } catch (error) {
    console.error("❌ Error getting mock data:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
