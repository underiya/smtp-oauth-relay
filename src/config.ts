/**
 * Configuration Manager
 */

import dotenv from "dotenv";
import { SMTPServerConfig, OAuthConfig } from "./types.js";

dotenv.config();

export class Config {
  static get smtp(): SMTPServerConfig {
    return {
      port: parseInt(process.env.SMTP_PORT || "2525", 10),
      host: process.env.SMTP_HOST || "0.0.0.0",
      secure: process.env.SMTP_SECURE === "true",
      authOptional: process.env.SMTP_AUTH_OPTIONAL === "true",
    };
  }

  static get oauth(): OAuthConfig {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const redirectUri =
      process.env.REDIRECT_URI || "http://localhost:3001/oauth2callback";

    if (!clientId || !clientSecret) {
      throw new Error(
        "MISSING_OAUTH_CREDENTIALS: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in .env",
      );
    }

    return {
      clientId,
      clientSecret,
      redirectUri,
    };
  }

  static get databasePath(): string {
    return process.env.DATABASE_PATH || "./relay.db";
  }

  static get setupPort(): number {
    return parseInt(process.env.OAUTH_SETUP_PORT || "3001", 10);
  }
}
