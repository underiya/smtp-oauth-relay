import { OAuth2Client } from "google-auth-library";
import { OAuthConfig, OAuthCredentials } from "./types";
import { DatabaseManager } from "./database";
import { logger } from "./logger.js";

export class OAuthManager {
  private oauth2Client: OAuth2Client;
  private db: DatabaseManager;
  private cache: Map<string, OAuthCredentials> = new Map();
  private refreshPromises: Map<string, Promise<string>> = new Map();
  private stateTokens: Map<string, string> = new Map(); // For CSRF protection

  constructor(config: OAuthConfig, db: DatabaseManager) {
    this.db = db;
    this.oauth2Client = new OAuth2Client(
      config.clientId,
      config.clientSecret,
      config.redirectUri,
    );
    logger.info("OAuth Manager initialized.");
  }

  generateAuthUrl(email: string): { url: string; state: string } {
    // Generate a cryptographically secure random state for CSRF protection
    const now = Date.now();
    const state = Buffer.from(`${email}:${now}:${Math.random()}`).toString(
      "base64",
    );
    this.stateTokens.set(state, email);

    // Periodic cleanup of expired state tokens (every 10 tokens)
    if (this.stateTokens.size % 10 === 0) {
      const expiryTime = 10 * 60 * 1000;
      for (const [token, _] of this.stateTokens.entries()) {
        try {
          const tokenTime = parseInt(
            Buffer.from(token, "base64").toString().split(":")[1],
          );
          if (now - tokenTime > expiryTime) {
            this.stateTokens.delete(token);
          }
        } catch (_) {
          // Ignore parsing errors and delete malformed tokens
          this.stateTokens.delete(token);
        }
      }
    }

    const url = this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/gmail.send"],
      prompt: "consent",
      login_hint: email,
      state: state,
    });

    return { url, state };
  }

  validateState(state: string): string | null {
    const email = this.stateTokens.get(state);
    if (email) {
      this.stateTokens.delete(state);
    }
    return email || null;
  }

  async exchangeCodeForTokens(
    code: string,
    email: string,
  ): Promise<OAuthCredentials> {
    const lowerEmail = email.toLowerCase();
    try {
      logger.info(`Exchanging code for tokens: ${lowerEmail}`);
      const { tokens } = await this.oauth2Client.getToken(code);

      if (!tokens.refresh_token) {
        throw new Error(
          "No refresh token received. User might already be authorized. Try revoking at https://myaccount.google.com/permissions",
        );
      }

      const credentials: OAuthCredentials = {
        email: lowerEmail,
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token || undefined,
        expiryDate: tokens.expiry_date || undefined,
      };

      this.db.storeCredentials(credentials);
      this.cache.set(lowerEmail, credentials);

      logger.success(`Authentication completed for ${lowerEmail}`);
      return credentials;
    } catch (error) {
      logger.error(`OAUTH_EXCHANGE_ERROR [${lowerEmail}]`, error);
      throw error;
    }
  }

  async getAccessToken(email: string): Promise<string> {
    const lowerEmail = email.toLowerCase();

    // Check cache first (fast path)
    let credentials = this.cache.get(lowerEmail);
    if (!credentials) {
      // Load from database if not in memory
      const dbCreds = this.db.getCredentials(lowerEmail);
      if (!dbCreds) {
        throw new Error(`NO_CREDENTIALS: ${lowerEmail} is not authorized.`);
      }
      credentials = dbCreds;
      this.cache.set(lowerEmail, credentials);
    }

    // Check if token is still valid (avoid refresh if possible)
    const now = Date.now();
    const buffer = 5 * 60 * 1000; // 5 mins buffer

    if (
      credentials.accessToken &&
      credentials.expiryDate &&
      credentials.expiryDate > now + buffer
    ) {
      logger.debug(`Using cached access token for ${lowerEmail}`);
      return credentials.accessToken;
    }

    // Avoid multiple simultaneous refreshes for the same account
    let refreshPromise = this.refreshPromises.get(lowerEmail);
    if (!refreshPromise) {
      logger.info(`Refreshing access token for ${lowerEmail}`);
      refreshPromise = this.refreshAccessToken(
        lowerEmail,
        credentials.refreshToken,
      ).finally(() => {
        this.refreshPromises.delete(lowerEmail);
      });
      this.refreshPromises.set(lowerEmail, refreshPromise);
    }

    return await refreshPromise;
  }

  private async refreshAccessToken(
    email: string,
    refreshToken: string,
  ): Promise<string> {
    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error("Refresh failed: No access token returned.");
      }

      const expiryDate = credentials.expiry_date || Date.now() + 3600 * 1000;
      this.db.updateAccessToken(email, credentials.access_token, expiryDate);

      // Update cache atomicity
      const current = this.cache.get(email);
      if (current) {
        this.cache.set(email, {
          ...current,
          accessToken: credentials.access_token,
          expiryDate: expiryDate,
        });
      } else {
        this.cache.set(email, {
          email,
          refreshToken,
          accessToken: credentials.access_token,
          expiryDate,
        });
      }

      logger.success(`Token refreshed for ${email}`);
      return credentials.access_token;
    } catch (error) {
      logger.error(`TOKEN_REFRESH_ERROR [${email}]`, error);
      throw error;
    }
  }

  hasCredentials(email: string): boolean {
    const lowerEmail = email.toLowerCase();
    return (
      this.cache.has(lowerEmail) || this.db.getCredentials(lowerEmail) !== null
    );
  }

  async revokeAccess(email: string): Promise<void> {
    const lowerEmail = email.toLowerCase();
    const credentials =
      this.cache.get(lowerEmail) || this.db.getCredentials(lowerEmail);

    if (!credentials) {
      logger.warn(`Revocation requested for unknown email: ${lowerEmail}`);
      return;
    }

    try {
      if (credentials.accessToken) {
        await this.oauth2Client.revokeToken(credentials.accessToken);
      }
      this.db.deleteCredentials(lowerEmail);
      this.cache.delete(lowerEmail);
      logger.success(
        `Access revoked and credentials deleted for ${lowerEmail}`,
      );
    } catch (error) {
      logger.error(`REVOCATION_ERROR [${lowerEmail}]`, error);
      throw error;
    }
  }
}
