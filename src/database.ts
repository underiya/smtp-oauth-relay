import Database from "better-sqlite3";
import { OAuthCredentials } from "./types.js";
import { logger } from "./logger.js";

export class DatabaseManager {
  private db: Database.Database;
  private stmts: {
    store: Database.Statement;
    get: Database.Statement;
    update: Database.Statement;
    list: Database.Statement;
    delete: Database.Statement;
  };

  constructor(dbPath: string) {
    try {
      this.db = new Database(dbPath);
      // Performance optimizations for SQLite
      this.db.pragma("journal_mode = WAL");
      this.db.pragma("synchronous = NORMAL");
      this.db.pragma("cache_size = -64000"); // 64MB cache
      this.db.pragma("foreign_keys = ON");
      this.db.pragma("temp_store = MEMORY");
      this.initializeDatabase();

      this.stmts = {
        store: this.db.prepare(`
                    INSERT OR REPLACE INTO credentials 
                    (email, refresh_token, access_token, expiry_date, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                `),
        get: this.db.prepare(`
                    SELECT email, refresh_token, access_token, expiry_date
                    FROM credentials
                    WHERE email = ?
                `),
        update: this.db.prepare(`
                    UPDATE credentials
                    SET access_token = ?, expiry_date = ?, updated_at = ?
                    WHERE email = ?
                `),
        list: this.db.prepare(`
                    SELECT email, refresh_token, access_token, expiry_date
                    FROM credentials
                `),
        delete: this.db.prepare("DELETE FROM credentials WHERE email = ?"),
      };
      logger.info("Database manager initialized successfully.");
    } catch (error) {
      logger.error("Failed to initialize database", error);
      throw error;
    }
  }

  private initializeDatabase(): void {
    const createTableSQL = `
            CREATE TABLE IF NOT EXISTS credentials (
                email TEXT PRIMARY KEY,
                refresh_token TEXT NOT NULL,
                access_token TEXT,
                expiry_date INTEGER,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `;
    this.db.exec(createTableSQL);
  }

  storeCredentials(credentials: OAuthCredentials): void {
    const now = Date.now();
    this.stmts.store.run(
      credentials.email.toLowerCase(),
      credentials.refreshToken,
      credentials.accessToken || null,
      credentials.expiryDate || null,
      now,
      now,
    );
    logger.success(`Stored/Updated credentials for ${credentials.email}`);
  }

  getCredentials(email: string): OAuthCredentials | null {
    try {
      const row = this.stmts.get.get(email.toLowerCase()) as any;
      if (!row) return null;

      return {
        email: row.email,
        refreshToken: row.refresh_token,
        accessToken: row.access_token || undefined,
        expiryDate: row.expiry_date || undefined,
      };
    } catch (error) {
      logger.error(`Error fetching credentials for ${email}`, error);
      return null;
    }
  }

  updateAccessToken(
    email: string,
    accessToken: string,
    expiryDate: number,
  ): void {
    this.stmts.update.run(
      accessToken,
      expiryDate,
      Date.now(),
      email.toLowerCase(),
    );
  }

  listAllCredentials(): OAuthCredentials[] {
    const rows = this.stmts.list.all() as any[];
    return rows.map((row) => ({
      email: row.email,
      refreshToken: row.refresh_token,
      accessToken: row.access_token || undefined,
      expiryDate: row.expiry_date || undefined,
    }));
  }

  deleteCredentials(email: string): void {
    this.stmts.delete.run(email.toLowerCase());
    logger.warn(`Deleted credentials for ${email}`);
  }

  close(): void {
    if (this.db) {
      this.db.close();
      logger.info("Database connection closed.");
    }
  }
}
