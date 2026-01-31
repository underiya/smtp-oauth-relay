// Type definitions for smtp-server
declare module 'smtp-server' {
    import { Readable } from 'stream';

    export interface SMTPServerAddress {
        address: string;
        args?: Record<string, string>;
    }

    export interface SMTPServerEnvelope {
        mailFrom: SMTPServerAddress | false;
        rcptTo: SMTPServerAddress[];
    }

    export interface SMTPServerSession {
        id: string;
        remoteAddress?: string;
        clientHostname?: string;
        openingCommand?: string;
        hostNameAppearsAs?: string;
        envelope: SMTPServerEnvelope;
        transaction?: number;
        user?: string;
        transmissionType?: string;
    }

    export interface SMTPServerDataStream extends Readable {
        sizeExceeded?: boolean;
    }

    export interface SMTPServerOptions {
        secure?: boolean;
        authOptional?: boolean;
        banner?: string;
        size?: number;
        hideSize?: boolean;
        disabledCommands?: string[];
        onAuth?: (
            auth: { method: string; username: string; password: string },
            session: SMTPServerSession,
            callback: (err: Error | null | undefined, response?: { user: string }) => void
        ) => void;
        onData?: (
            stream: SMTPServerDataStream,
            session: SMTPServerSession,
            callback: (err?: Error | null) => void
        ) => void;
        onConnect?: (
            session: SMTPServerSession,
            callback: (err?: Error | null) => void
        ) => void;
        onError?: (error: Error) => void;
    }

    export class SMTPServer {
        constructor(options: SMTPServerOptions);
        listen(port: number, host?: string, callback?: () => void): void;
        close(callback?: () => void): void;
        on(event: string, listener: (...args: any[]) => void): this;
    }
}
