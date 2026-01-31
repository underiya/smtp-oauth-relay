import { google, gmail_v1 } from "googleapis";
import { EmailMessage, GmailAPIResponse } from "./types";
import { logger } from "./logger.js";

export class GmailClient {
  private gmail: gmail_v1.Gmail;

  constructor() {
    this.gmail = google.gmail({ version: "v1" });
    logger.info("Gmail Client initialized.");
  }

  async sendEmail(
    accessToken: string,
    message: EmailMessage,
  ): Promise<GmailAPIResponse> {
    try {
      const email = this.createEmailMessage(message);

      // Encode email in base64url (RFC 4648)
      const encodedEmail = Buffer.from(email)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      // Create temporary auth context
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      const response = await this.gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: encodedEmail },
        auth: auth,
      });

      if (!response.data.id || !response.data.threadId) {
        throw new Error(
          "UNEXPECTED_GMAIL_API_RESPONSE: Missing ID or ThreadID",
        );
      }

      return {
        id: response.data.id,
        threadId: response.data.threadId,
        labelIds: response.data.labelIds || [],
      };
    } catch (error) {
      logger.error(`GMAIL_API_SEND_ERROR [From: ${message.from}]`, error);
      throw error;
    }
  }

  /**
   * Constructs a raw RFC 2822 email message
   */
  private createEmailMessage(message: EmailMessage): string {
    const boundary = `relay_boundary_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const headers: string[] = [
      `From: ${message.from}`,
      `To: ${message.to.join(", ")}`,
      `Subject: ${message.subject}`,
      "MIME-Version: 1.0",
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${Date.now()}@smtp-relay.local>`,
    ];

    if (message.html) {
      headers.push(
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
      );
      headers.push(""); // End of main headers

      // Text part
      headers.push(`--${boundary}`);
      headers.push("Content-Type: text/plain; charset=UTF-8");
      headers.push("Content-Transfer-Encoding: base64");
      headers.push("");
      headers.push(Buffer.from(message.text).toString("base64"));
      headers.push("");

      // HTML part
      headers.push(`--${boundary}`);
      headers.push("Content-Type: text/html; charset=UTF-8");
      headers.push("Content-Transfer-Encoding: base64");
      headers.push("");
      headers.push(Buffer.from(message.html).toString("base64"));
      headers.push("");

      headers.push(`--${boundary}--`);
    } else {
      headers.push("Content-Type: text/plain; charset=UTF-8");
      headers.push("Content-Transfer-Encoding: base64");
      headers.push("");
      headers.push(Buffer.from(message.text).toString("base64"));
    }

    return headers.join("\r\n");
  }

  // Cache email validation regex for performance
  private static readonly emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  static validateEmail(email: string): boolean {
    return this.emailRegex.test(email);
  }
}
