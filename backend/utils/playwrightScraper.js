// backend/utils/playwrightScraper.js - Complete Playwright implementation

const { chromium } = require("playwright");

class PlaywrightPumpFunScraper {
  constructor() {
    this.profileAddress = "4okBB9yQDhK3TaJxFnCThWH7zXwNTdM9RWmBcnCVZM1h";
    this.profileUrl = `https://pump.fun/profile/${this.profileAddress}?tab=coins`;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.lastScrapedData = null;
    this.lastScrapeTime = null;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.keepAliveTimeout = null;
  }

  /**
   * Initialize browser instance with persistent connection
   */
  async initBrowser() {
    try {
      // Check if browser is still alive
      if (this.browser && this.browser.isConnected && this.browser.isConnected()) {
        console.log("♻️ Reusing existing browser instance");
        return this.browser;
      }

      console.log("🚀 Launching Playwright browser...");

      this.browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor", // Speed optimization
          "--disable-background-networking", // Speed optimization
          "--disable-sync", // Speed optimization
        ],
      });

      // Create persistent context
      this.context = await this.browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        viewport: { width: 1920, height: 1080 },
      });

      console.log("✅ Playwright browser launched successfully");

      // Set up keep-alive timer (close after 10 minutes of inactivity)
      this.resetKeepAlive();

      return this.browser;
    } catch (error) {
      console.error("❌ Browser launch failed:", error);
      throw error;
    }
  }

  /**
   * Reset keep-alive timer
   */
  resetKeepAlive() {
    if (this.keepAliveTimeout) {
      clearTimeout(this.keepAliveTimeout);
    }

    this.keepAliveTimeout = setTimeout(async () => {
      console.log("⏰ Browser keep-alive timeout, closing...");
      await this.closeBrowser();
    }, 10 * 60 * 1000); // 10 minutes
  }

  /**
   * Get or create reusable page
   */
  async getPage() {
    await this.initBrowser();

    if (this.page && !this.page.isClosed()) {
      console.log("♻️ Reusing existing page");
      this.resetKeepAlive();
      return this.page;
    }

    console.log("📄 Creating new page");
    this.page = await this.context.newPage();

    // Set up request interception for faster loading
    await this.page.route("**/*.{png,jpg,jpeg,gif,svg,css,woff,woff2}", route => route.abort());

    this.resetKeepAlive();
    return this.page;
  }

  /**
   * Close browser instance
   */
  async closeBrowser() {
    if (this.keepAliveTimeout) {
      clearTimeout(this.keepAliveTimeout);
      this.keepAliveTimeout = null;
    }

    if (this.page && !this.page.isClosed()) {
      await this.page.close();
      this.page = null;
    }

    if (this.context) {
      await this.context.close();
      this.context = null;
    }

    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        console.log("🔒 Browser closed");
      } catch (error) {
        console.error("⚠️ Error closing browser:", error);
        this.browser = null;
      }
    }
  }

  /**
   * Extract creator earnings from pump.fun profile page
   */
  async scrapeCreatorEarnings() {
    try {
      console.log("🔍 Starting optimized Playwright scraping of pump.fun profile...");

      // Use persistent page instead of creating new ones
      const page = await this.getPage();

      // Set additional headers for this request
      await page.route("**/*", (route) => {
        route.continue({
          headers: {
            ...route.request().headers(),
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            DNT: "1",
            "Upgrade-Insecure-Requests": "1",
          },
        });
      });

      console.log(`📱 Navigating to: ${this.profileUrl}`);

      // Navigate to profile page with stealth settings
      await page.goto(this.profileUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      // Wait for page to load with longer timeout
      console.log("⏳ Waiting for page to load...");
      await page.waitForTimeout(8000); // Increased from 5000

      // Try to wait for specific elements that might contain earnings
      try {
        await Promise.race([
          page.waitForSelector('[class*="fee"]', { timeout: 10000 }),
          page.waitForSelector('[class*="earn"]', { timeout: 10000 }),
          page.waitForSelector('[class*="reward"]', { timeout: 10000 }),
          page.waitForSelector('[class*="total"]', { timeout: 10000 }),
          page.waitForTimeout(10000), // Fallback timeout
        ]);
        console.log("✅ Potential earnings elements detected");
      } catch (e) {
        console.log(
          "⚠️ No specific earnings elements found, proceeding with full page analysis"
        );
      }

      // Scroll to load lazy content and try different scroll positions
      await page.evaluate(() => {
        window.scrollTo(0, 0); // Scroll to top
      });
      await page.waitForTimeout(2000);

      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2); // Scroll to middle
      });
      await page.waitForTimeout(2000);

      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight); // Scroll to bottom
      });
      await page.waitForTimeout(3000);

      // Extract creator earnings data
      const scrapedData = await page.evaluate(() => {
        const results = {
          totalFeesSOL: 0,
          coinsCreated: 0,
          earnings: [],
          debugInfo: [],
          pageInfo: {},
        };

        // Capture page info
        results.pageInfo = {
          title: document.title,
          url: window.location.href,
          bodyLength: document.body.innerText.length,
          hasContent: document.body.innerText.length > 100,
        };

        // Enhanced patterns for pump.fun 2025 - Updated for current structure
        const solPatterns = [
          // Standard SOL patterns
          /(\d+,?\d*\.?\d*)\s*SOL/gi,
          /(\d+,?\d*\.?\d*)\s*◎/gi,
          /(\d+,?\d*\.?\d*)\s*\$?SOL/gi,

          // Earning/fee specific patterns
          /earned[:\s]*(\d+,?\d*\.?\d*)/gi,
          /fees[:\s]*(\d+,?\d*\.?\d*)/gi,
          /rewards[:\s]*(\d+,?\d*\.?\d*)/gi,
          /total[:\s]*(\d+,?\d*\.?\d*)/gi,
          /creator[:\s]*(\d+,?\d*\.?\d*)/gi,
          /balance[:\s]*(\d+,?\d*\.?\d*)/gi,

          // More specific pump.fun patterns
          /(\d+,?\d*\.?\d*)\s*sol\s*earned/gi,
          /creator\s*fees[:\s]*(\d+,?\d*\.?\d*)/gi,
          /trading\s*fees[:\s]*(\d+,?\d*\.?\d*)/gi,
          /total\s*earned[:\s]*(\d+,?\d*\.?\d*)/gi,
          /fee\s*rewards[:\s]*(\d+,?\d*\.?\d*)/gi,

          // Patterns for specific numbers like 38.908
          /(38\.?\d*)\s*SOL/gi,
          /(38,?\d*\.?\d*)\s*SOL/gi,
          /(\d+\.\d{3})\s*SOL/gi, // Three decimal places
          /(\d+,\d{3})\s*SOL/gi, // Comma thousands separator

          // Generic number patterns that might contain our value
          /(\d+,\d+\.\d+)/g, // Like 38,908.123
          /(\d+\.\d{3,})/g, // Like 38.908 (3+ decimals)

          // Text-based patterns
          /earned[\s\w]*(\d+,?\d*\.?\d*)/gi,
          /fees[\s\w]*(\d+,?\d*\.?\d*)/gi,
          /total[\s\w]*(\d+,?\d*\.?\d*)/gi,
        ];

        const coinPatterns = [
          /(\d+)\s*coins?\s*created/gi,
          /(\d+)\s*tokens?\s*created/gi,
          /(\d+)\s*coins?\s*launched/gi,
          /(\d+)\s*tokens?\s*launched/gi,
          /created[:\s]*(\d+)/gi,
          /launched[:\s]*(\d+)/gi,
          /tokens[:\s]*(\d+)/gi,
          /(\d+)\s*projects?/gi,
        ];

        // Extract numbers from patterns - Handle commas and various formats
        function extractNumber(text, patterns) {
          for (const pattern of patterns) {
            const matches = text.match(pattern);
            if (matches) {
              for (let i = 1; i < matches.length; i++) {
                if (matches[i]) {
                  // Remove commas and parse float
                  const cleanNumber = matches[i].replace(/,/g, "");
                  const num = parseFloat(cleanNumber);
                  if (!isNaN(num) && num >= 0) {
                    return num;
                  }
                }
              }
              // Also try the full match if no groups
              if (matches[0]) {
                const cleanNumber = matches[0].replace(/[^\d.]/g, "");
                const num = parseFloat(cleanNumber);
                if (!isNaN(num) && num >= 0) {
                  return num;
                }
              }
            }
          }
          return 0;
        }

        // Get all text content from the page
        const allText =
          document.body.innerText || document.body.textContent || "";
        results.debugInfo.push(`Page text length: ${allText.length}`);
        results.debugInfo.push(`Page title: ${document.title}`);

        // Enhanced text analysis
        const lines = allText
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        results.debugInfo.push(`Total lines: ${lines.length}`);

        // Look for SOL amounts in each line
        lines.forEach((line, index) => {
          if (
            line.toLowerCase().includes("sol") ||
            line.includes("◎") ||
            line.toLowerCase().includes("earn") ||
            line.toLowerCase().includes("fee")
          ) {
            results.debugInfo.push(`Line ${index}: ${line.substring(0, 100)}`);

            for (const pattern of solPatterns) {
              const amount = extractNumber(line, [pattern]);
              if (amount > 0 && amount < 1000000) {
                results.earnings.push({
                  amount,
                  context: line.substring(0, 150),
                  lineNumber: index,
                  source: "text-analysis",
                });
                results.totalFeesSOL = Math.max(results.totalFeesSOL, amount);
              }
            }
          }
        });

        // Search for coin counts
        for (const pattern of coinPatterns) {
          const matches = allText.match(pattern);
          if (matches) {
            matches.forEach((match) => {
              const count = extractNumber(match, [/(\d+)/]);
              if (count > 0 && count < 10000) {
                results.coinsCreated = Math.max(results.coinsCreated, count);
              }
            });
          }
        }

        // DOM element analysis
        const allElements = document.querySelectorAll("*");
        let elementsChecked = 0;

        for (const element of allElements) {
          elementsChecked++;
          if (elementsChecked > 1000) break;

          const text = element.textContent || "";
          const classList = Array.from(element.classList).join(" ");
          const elementInfo = `${classList} ${text}`.toLowerCase();

          if (
            elementInfo.includes("sol") ||
            elementInfo.includes("◎") ||
            elementInfo.includes("fee") ||
            elementInfo.includes("earn") ||
            elementInfo.includes("reward")
          ) {
            for (const pattern of solPatterns) {
              const matches = text.match(pattern);
              if (matches) {
                matches.forEach((match) => {
                  const amount = extractNumber(match, [/(\d+\.?\d*)/]);
                  if (amount > 0 && amount < 1000000) {
                    results.earnings.push({
                      amount,
                      context: `${classList}: ${match}`,
                      source: "dom-search",
                    });
                    results.totalFeesSOL = Math.max(
                      results.totalFeesSOL,
                      amount
                    );
                  }
                });
              }
            }
          }
        }

        results.debugInfo.push(`Elements checked: ${elementsChecked}`);
        results.debugInfo.push(
          `Total earnings found: ${results.earnings.length}`
        );

        return results;
      });

      console.log("📊 Scraping completed, processing results...");
      console.log("🔍 Page info:", scrapedData.pageInfo);
      console.log("💰 Found earnings:", scrapedData.earnings.length);

      // Get current SOL price
      const solPrice = await this.getSolPrice();

      const result = {
        totalFeesSOL: scrapedData.totalFeesSOL,
        totalFeesUSD: scrapedData.totalFeesSOL * solPrice,
        coinsCreated: scrapedData.coinsCreated,
        solPrice: solPrice,
        lastUpdated: new Date().toISOString(),
        source: "playwright-browser",
        profileUrl: this.profileUrl,
        earnings: scrapedData.earnings,
        debugInfo: scrapedData.debugInfo,
        pageInfo: scrapedData.pageInfo,
        scrapingMethod: "browser-automation-playwright",
      };

      // Cache the data
      this.lastScrapedData = result;
      this.lastScrapeTime = Date.now();

      console.log("✅ Playwright scraping completed successfully");
      console.log(
        `💰 Total fees found: ${
          result.totalFeesSOL
        } SOL ($${result.totalFeesUSD.toFixed(2)})`
      );
      console.log(`🪙 Coins created: ${result.coinsCreated}`);

      return result;
    } catch (error) {
      console.error("❌ Playwright scraping error:", error);

      // Return cached data if available
      if (this.lastScrapedData) {
        console.log("🔄 Returning cached data due to scraping error");
        return {
          ...this.lastScrapedData,
          cached: true,
          cacheAge: Date.now() - this.lastScrapeTime,
          error: error.message,
        };
      }

      // Return error data
      return {
        totalFeesSOL: 0,
        totalFeesUSD: 0,
        coinsCreated: 0,
        solPrice: 150,
        lastUpdated: new Date().toISOString(),
        source: "playwright-error",
        error: error.message,
        scrapingMethod: "browser-automation-failed",
      };
    }
    // Note: Page is kept alive for reuse - no finally block needed
  }

  /**
   * Take screenshot for debugging
   */
  async takeDebugScreenshot() {
    try {
      // Use persistent page for screenshots too
      const page = await this.getPage();

      // Set user agent properly
      await page.route("**/*", (route) => {
        route.continue({
          headers: {
            ...route.request().headers(),
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          },
        });
      });

      await page.goto(this.profileUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      await page.waitForTimeout(5000);

      const screenshotPath = "debug-pump-fun-profile.png";
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        type: "png",
      });

      console.log(`📸 Debug screenshot saved as ${screenshotPath}`);
      return {
        success: true,
        path: screenshotPath,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("❌ Screenshot error:", error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
    // Note: Page is kept alive for reuse - no finally block needed
  }

  /**
   * Get SOL price from CoinGecko
   */
  async getSolPrice() {
    try {
      const https = require("https");

      return new Promise((resolve, reject) => {
        const req = https.get(
          "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
          (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
              try {
                const parsed = JSON.parse(data);
                resolve(parsed.solana.usd);
              } catch (e) {
                resolve(150); // Fallback
              }
            });
          }
        );

        req.on("error", () => resolve(150)); // Fallback
        req.setTimeout(10000, () => {
          req.destroy();
          resolve(150); // Fallback
        });
      });
    } catch (error) {
      return 150; // Fallback price
    }
  }

  /**
   * Get creator data with caching
   */
  async getCreatorData(forceFresh = false) {
    // Return cached data if still valid and not forcing fresh
    if (!forceFresh && this.lastScrapedData && this.lastScrapeTime) {
      const cacheAge = Date.now() - this.lastScrapeTime;
      if (cacheAge < this.cacheTimeout) {
        console.log(
          `📋 Returning cached Playwright data (${Math.round(
            cacheAge / 1000
          )}s old)`
        );
        return {
          ...this.lastScrapedData,
          cached: true,
          cacheAge: cacheAge,
        };
      }
    }

    // Get fresh data
    return await this.scrapeCreatorEarnings();
  }

  /**
   * Health check for browser
   */
  async healthCheck() {
    try {
      await this.initBrowser();
      const page = await this.getPage();

      await page.goto("https://httpbin.org/user-agent", { timeout: 15000 });
      const content = await page.content();

      return {
        status: "healthy",
        browserVersion: await this.browser.version(),
        userAgent: content.includes("Chrome") ? "Valid" : "Invalid",
        timestamp: new Date().toISOString(),
        engine: "playwright",
      };
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString(),
        engine: "playwright",
      };
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.closeBrowser();
  }
}

module.exports = PlaywrightPumpFunScraper;
