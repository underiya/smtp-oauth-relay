/**
 * Professional Logger Utility
 */

export enum LogLevel {
  INFO = "INFO",
  SUCCESS = "SUCCESS",
  WARN = "WARN",
  ERROR = "ERROR",
  DEBUG = "DEBUG",
}

class Logger {
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const icon = this.getIcon(level);
    return `[${timestamp}] ${icon} ${level.padEnd(7)} | ${message}`;
  }

  private getIcon(level: LogLevel): string {
    switch (level) {
      case LogLevel.SUCCESS:
        return "✅";
      case LogLevel.ERROR:
        return "❌";
      case LogLevel.WARN:
        return "⚠️";
      case LogLevel.INFO:
        return "ℹ️ ";
      case LogLevel.DEBUG:
        return " ⚙️ ";
      default:
        return " 📝 ";
    }
  }

  info(message: string): void {
    console.log(this.formatMessage(LogLevel.INFO, message));
  }

  success(message: string): void {
    console.log(this.formatMessage(LogLevel.SUCCESS, message));
  }

  warn(message: string): void {
    console.warn(this.formatMessage(LogLevel.WARN, message));
  }

  error(message: string, error?: any): void {
    console.error(this.formatMessage(LogLevel.ERROR, message));
    if (error) {
      if (error instanceof Error) {
        console.error(`   └─ Memory: ${error.stack}`);
      } else {
        console.error(`   └─ Detail: ${JSON.stringify(error)}`);
      }
    }
  }

  debug(message: string): void {
    if (process.env.DEBUG === "true") {
      console.log(this.formatMessage(LogLevel.DEBUG, message));
    }
  }

  /**
   * Specialized relay logger
   */
  relay(from: string, to: string[], subject: string, result: string): void {
    console.log(`\n📬 [RELAY] From: ${from}`);
    console.log(`   └─ To     : ${to.join(", ")}`);
    console.log(`   └─ Subject: ${subject}`);
    console.log(`   └─ Status : ${result}\n`);
  }
}

export const logger = new Logger();
