// SMTP Relay Integration Test

import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { logger } from "./logger.js";

dotenv.config();

async function runTest(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.log("Usage: npm test <recipient> <subject> <body>");
    process.exit(1);
  }

  const [recipient, subject, body] = args;
  const senderEmail = process.env.SENDER_EMAIL;

  if (!senderEmail) {
    logger.error("SENDER_EMAIL not set in .env");
    process.exit(1);
  }

  logger.info(`Test Initiated: ${senderEmail} -> ${recipient}`);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "localhost",
    port: parseInt(process.env.SMTP_PORT || "2525", 10),
    secure: false,
    auth: {
      user: senderEmail,
      pass: "relay-test",
    },
    tls: { rejectUnauthorized: false },
  });

  try {
    const info = await transporter.sendMail({
      from: senderEmail,
      to: recipient,
      subject: subject,
      text: body,
      html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                     <h2 style="color: #4285f4;">Relay Test Message</h2>
                     <p>${body}</p>
                     <hr/>
                     <small>Sent via SMTP-OAuth Relay</small>
                   </div>`,
    });

    logger.success(`Test email accepted by relay!`);
    logger.info(`Relay ID: ${info.messageId}`);
  } catch (error) {
    logger.error("SMTP Test Failed", error);
    process.exit(1);
  }
}

runTest();
