/**
 * SMTP to OAuth Relay - Main Entry Point
 * Optimized for performance and readability
 */

import { Config } from "./config.js";
import { DatabaseManager } from "./database.js";
import { OAuthManager } from "./oauth.js";
import { SMTPRelay } from "./smtp-server.js";
import { OAuthSetupServer } from "./setup-server.js";
import { logger } from "./logger.js";

async function bootstrap(): Promise<void> {
  logger.info("Starting SMTP-OAuth Relay bootstrap sequence...");

  let db: DatabaseManager | undefined;
  let smtpRelay: SMTPRelay | undefined;
  let setupServer: OAuthSetupServer | undefined;

  try {
    // 1. Initialize Core Components
    db = new DatabaseManager(Config.databasePath);
    const oauthManager = new OAuthManager(Config.oauth, db);

    // 2. Setup Mode Detection
    if (process.argv.includes("--setup")) {
      logger.info("Setup-only mode enabled.");
      setupServer = new OAuthSetupServer(oauthManager, Config.setupPort);
      await setupServer.start();
      return;
    }

    // 3. Start Primary Services
    smtpRelay = new SMTPRelay(Config.smtp, oauthManager);
    setupServer = new OAuthSetupServer(oauthManager, Config.setupPort);

    await Promise.all([smtpRelay.start(), setupServer.start()]);

    logger.success("System fully operational / READY");
  } catch (error) {
    logger.error("CRITICAL_STARTUP_ERROR", error);
    process.exit(1);
  }

  // 4. Graceful Shutdown Handler
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);

    try {
      await Promise.all([smtpRelay?.stop(), setupServer?.stop()]);
      db?.close();
      logger.success("Shutdown finalized. Goodbye!");
      process.exit(0);
    } catch (err) {
      logger.error("Error during shutdown", err);
      process.exit(1);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

// Global error handlers
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Promise Rejection", reason);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", error);
  process.exit(1);
});

bootstrap();
