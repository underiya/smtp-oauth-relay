/**
 * Type definitions for the SMTP to OAuth Relay
 */

export interface EmailMessage {
    from: string;
    to: string[];
    subject: string;
    text: string;
    html?: string;
}

export interface OAuthCredentials {
    email: string;
    refreshToken: string;
    accessToken?: string;
    expiryDate?: number;
}

export interface SMTPAuthData {
    username: string;
    password: string;
}

export interface DatabaseSchema {
    credentials: {
        email: string;
        refresh_token: string;
        access_token: string | null;
        expiry_date: number | null;
        created_at: number;
        updated_at: number;
    };
}

export interface GmailAPIResponse {
    id: string;
    threadId: string;
    labelIds: string[];
}

export interface SMTPServerConfig {
    port: number;
    host: string;
    secure: boolean;
    authOptional: boolean;
}

export interface OAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}
