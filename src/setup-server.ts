import express from "express";
import cookieParser from "cookie-parser";
import open from "open";
import { OAuthManager } from "./oauth";
import { logger } from "./logger.js";

export class OAuthSetupServer {
  private app: express.Application;
  private oauthManager: OAuthManager;
  private port: number;
  private server: any;
  // Cache stylesheet to avoid rebuilding for each request
  private readonly style: string;

  constructor(oauthManager: OAuthManager, port: number) {
    this.oauthManager = oauthManager;
    this.port = port;
    this.app = express();
    // Initialize shared stylesheet once
    this.style = `
            <style>
                :root { --primary: #4285f4; --bg: #f8fafc; --card: #ffffff; --text: #1e293b; }
                body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 600px; margin: 4rem auto; padding: 0 1rem; background: var(--bg); color: var(--text); line-height: 1.5; }
                .card { background: var(--card); padding: 2.5rem; border-radius: 1rem; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
                h1 { margin-top: 0; font-size: 1.875rem; font-weight: 700; color: #0f172a; }
                .field { margin-bottom: 1.5rem; }
                label { display: block; margin-bottom: 0.5rem; font-weight: 600; font-size: 0.875rem; }
                input { width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 0.5rem; font-size: 1rem; transition: border-color 0.2s; }
                input:focus { outline: none; border-color: var(--primary); ring: 2px solid var(--primary); }
                button { background: var(--primary); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 600; cursor: pointer; width: 100%; transition: opacity 0.2s; }
                button:hover { opacity: 0.9; }
                .badge { display: inline-block; padding: 0.25rem 0.75rem; background: #e0e7ff; color: #4338ca; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; margin-bottom: 1rem; }
                .success-icon { font-size: 3rem; color: #10b981; margin-bottom: 1rem; }
                .info-box { background: #f1f5f9; padding: 1rem; border-radius: 0.5rem; border-left: 4px solid var(--primary); margin: 1.5rem 0; font-size: 0.9rem; }
                pre { background: #0f172a; color: #f8fafc; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.85rem; }
                a { color: var(--primary); text-decoration: none; font-weight: 500; }
            </style>
        `;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.json());
    // Middleware for cookie parsing (needed for state validation)
    this.app.use(cookieParser());
  }

  private setupRoutes(): void {
    this.app.get("/", (_req, res) => {
      res.send(`
                <!DOCTYPE html>
                <html><head><title>Relay Setup</title>${this.style}</head>
                <body>
                    <div class="card">
                        <span class="badge">SMTP TO GMAIL RELAY</span>
                        <h1>Account Authorization</h1>
                        <p>Authorize your Gmail account to send emails via this secure SMTP relay.</p>
                        <form action="/authorize" method="GET">
                            <div class="field">
                                <label>Gmail Address</label>
                                <input type="email" name="email" placeholder="user@gmail.com" required autofocus>
                            </div>
                            <button type="submit">Begin Authorization 🚀</button>
                        </form>
                    </div>
                </body></html>
            `);
    });

    this.app.get("/authorize", (req, res) => {
      const email = req.query.email as string;
      if (!email) return res.redirect("/");
      logger.info(`Browser-based auth start: ${email}`);
      const { url, state } = this.oauthManager.generateAuthUrl(email);
      // Store state in cookie for validation on callback
      res.cookie("oauth_state", state, {
        httpOnly: true,
        maxAge: 10 * 60 * 1000,
      });
      res.redirect(url);
    });

    this.app.get("/oauth2callback", async (req, res) => {
      const code = req.query.code as string;
      const state = req.query.state as string;
      const error = req.query.error as string;
      const storedState = req.cookies?.oauth_state;

      if (error) {
        logger.error(`OAuth Callback Error: ${error}`);
        return res.status(400).send(`Auth Failed: ${error}`);
      }

      // Validate state parameter for CSRF protection
      if (!state || state !== storedState) {
        logger.error(
          `CSRF Protection: State mismatch or missing. Expected: ${storedState}, Got: ${state}`,
        );
        return res
          .status(403)
          .send(
            `<h2>Security Error</h2><p>Invalid or missing state parameter. Authorization rejected.</p><a href="/">Try Again</a>`,
          );
      }

      // Extract email from validated state
      const emailFromState = this.oauthManager.validateState(state);
      if (!emailFromState) {
        logger.error(`CSRF Protection: Invalid state token`);
        return res
          .status(403)
          .send(
            `<h2>Security Error</h2><p>Invalid state token. Please start over.</p><a href="/">Try Again</a>`,
          );
      }

      res.send(`
                <!DOCTYPE html>
                <html><head><title>Confirm Identity</title>${this.style}</head>
                <body>
                    <div class="card">
                        <h1>Confirm Email</h1>
                        <p>Google has authorized access for <strong>${emailFromState}</strong>. Finalize setup below.</p>
                        <form action="/complete-auth" method="POST">
                            <input type="hidden" name="code" value="${code}">
                            <input type="hidden" name="email" value="${emailFromState}">
                            <button type="submit">Finalize Connection ✨</button>
                        </form>
                    </div>
                </body></html>
            `);
    });

    this.app.post("/complete-auth", async (req, res) => {
      try {
        const { code, email } = req.body;
        if (!code || !email) throw new Error("Invalid verification request.");

        await this.oauthManager.exchangeCodeForTokens(
          code,
          email.toLowerCase(),
        );

        res.send(`
                    <!DOCTYPE html>
                    <html><head><title>Success!</title>${this.style}</head>
                    <body>
                        <div class="card" style="text-align: center;">
                            <div class="success-icon">Check Circle</div>
                            <h1>Setup Complete!</h1>
                            <p><strong>${email}</strong> is now ready to send mail.</p>
                            
                            <div class="info-box" style="text-align: left;">
                                <strong>Your SMTP Credentials:</strong>
                                <pre>Host: localhost\nPort: 2525\nUser: ${email}\nPass: (any value)</pre>
                            </div>
                            
                            <p><a href="/">Authorize another account</a></p>
                        </div>
                    </body></html>
                `);
      } catch (error) {
        res
          .status(500)
          .send(
            `<h2>Setup Error</h2><p>${error instanceof Error ? error.message : "Unknown error"}</p><a href="/">Try Again</a>`,
          );
      }
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        logger.success(`Setup UI active at http://localhost:${this.port}`);
        open(`http://localhost:${this.port}`).catch(() => {});
        resolve();
      });
      this.server.on("error", reject);
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info("Setup UI stopped.");
          resolve();
        });
      } else resolve();
    });
  }
}
