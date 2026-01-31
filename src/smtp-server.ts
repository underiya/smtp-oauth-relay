import {
  SMTPServer,
  SMTPServerSession,
  SMTPServerDataStream,
} from "smtp-server";
import { simpleParser, ParsedMail } from "mailparser";
import { EmailMessage, SMTPServerConfig } from "./types.js";
import { OAuthManager } from "./oauth.js";
import { GmailClient } from "./gmail-client.js";
import { logger } from "./logger.js";

export class SMTPRelay {
  private server: SMTPServer;
  private oauthManager: OAuthManager;
  private gmailClient: GmailClient;
  private config: SMTPServerConfig;

  constructor(config: SMTPServerConfig, oauthManager: OAuthManager) {
    this.config = config;
    this.oauthManager = oauthManager;
    this.gmailClient = new GmailClient();

    this.server = new SMTPServer({
      secure: config.secure,
      authOptional: config.authOptional,
      onAuth: this.handleAuth.bind(this),
      onData: this.handleData.bind(this),
      onConnect: this.handleConnect.bind(this),
      onError: this.handleError.bind(this),
      disabledCommands: ["STARTTLS"],
      banner: "Gmail SMTP-OAuth Relay v1.1",
    });
  }

  private handleConnect(
    session: SMTPServerSession,
    callback: (err?: Error | null) => void,
  ): void {
    logger.debug(`Incoming SMTP connection from ${session.remoteAddress}`);
    callback();
  }

  private handleAuth(
    auth: { method: string; username: string; password: string },
    _session: SMTPServerSession,
    callback: (
      err: Error | null | undefined,
      response?: { user: string },
    ) => void,
  ): void {
    const email = auth.username.toLowerCase();

    if (!GmailClient.validateEmail(email)) {
      logger.warn(`Auth failed: Invalid email format [${email}]`);
      return callback(new Error("Invalid email address format"));
    }

    if (!this.oauthManager.hasCredentials(email)) {
      logger.warn(`Auth failed: Email not authorized [${email}]`);
      return callback(
        new Error(`Account ${email} is not authorized. Visit the setup UI.`),
      );
    }

    logger.info(`Auth success: ${email}`);
    callback(null, { user: email });
  }

  private async handleData(
    stream: SMTPServerDataStream,
    session: SMTPServerSession,
    callback: (err?: Error | null) => void,
  ): Promise<void> {
    const startTime = Date.now();
    try {
      const parsed = await simpleParser(stream);
      const senderEmail = (
        session.user ||
        (session.envelope.mailFrom && session.envelope.mailFrom.address) ||
        ""
      ).toLowerCase();

      if (!senderEmail) {
        logger.error("Data phase failed: Missing sender email context");
        throw new Error("No sender email found in session.");
      }

      const message = this.buildEmailMessage(parsed, senderEmail);
      logger.info(
        `Processing relay: ${senderEmail} -> ${message.to[0]}${message.to.length > 1 ? ` (+${message.to.length - 1} more)` : ""}`,
      );

      const accessToken = await this.oauthManager.getAccessToken(senderEmail);
      const response = await this.gmailClient.sendEmail(accessToken, message);

      const duration = Date.now() - startTime;
      logger.relay(
        senderEmail,
        message.to,
        message.subject,
        `Success (ID: ${response.id}, Time: ${duration}ms)`,
      );

      callback();
    } catch (error) {
      const duration = Date.now() - startTime;
      const errMsg =
        error instanceof Error ? error.message : "Unknown Relay Error";
      logger.error(`RELAY_FAILED after ${duration}ms`, error);
      callback(new Error(`SMTP_RELAY_ERROR: ${errMsg}`));
    }
  }

  private buildEmailMessage(
    parsed: ParsedMail,
    senderEmail: string,
  ): EmailMessage {
    const to: string[] = [];

    const extractAddresses = (field: any) => {
      if (!field) return;
      const values = Array.isArray(field) ? field : [field];
      values.forEach((v) => {
        if (typeof v === "string") to.push(v);
        else if (v.value)
          v.value.forEach((item: any) => {
            if (item.address) to.push(item.address);
          });
        else if (v.address) to.push(v.address);
      });
    };

    extractAddresses(parsed.to);
    extractAddresses(parsed.cc);

    if (to.length === 0)
      throw new Error("No valid recipients found (check To/Cc fields)");

    return {
      from: senderEmail,
      to,
      subject: parsed.subject || "(No Subject)",
      text: parsed.text || "",
      html: parsed.html ? String(parsed.html) : undefined,
    };
  }

  private handleError(error: Error): void {
    // Filter common noise but log real errors
    if (!["ECONNRESET", "EPIPE"].includes((error as any).code)) {
      logger.error("SMTP server internal error", error);
    }
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host, () => {
        logger.success(
          `SMTP Relay Listening on ${this.config.host}:${this.config.port}`,
        );
        resolve();
      });
      this.server.on("error", (err) => {
        logger.error("SMTP Startup Failure", err);
        reject(err);
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        logger.info("SMTP Relay Server stopped.");
        resolve();
      });
    });
  }
}
