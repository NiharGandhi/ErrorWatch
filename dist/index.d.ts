export interface ErrorWatchConfig {
    apiKey: string;
    projectId: string;
    environment?: 'development' | 'staging' | 'production';
    baseUrl?: string;
    enableScreenRecording?: boolean;
    maxRecordingDuration?: number;
    captureConsole?: boolean;
    captureNetwork?: boolean;
    beforeSend?: (error: ErrorEvent) => ErrorEvent | null;
}
export interface ErrorData {
    message: string;
    stack?: string;
    url: string;
    line?: number;
    column?: number;
    userAgent: string;
    timestamp: number;
    severity: 'error' | 'warning' | 'info';
    metadata?: Record<string, any>;
    screenRecording?: string;
}
export declare class ErrorWatch {
    private config;
    private isRecording;
    private recordingEvents;
    private stopRecording?;
    constructor(config: ErrorWatchConfig);
    private init;
    private setupErrorHandlers;
    private setupConsoleCapture;
    private startScreenRecording;
    private restartRecording;
    private handleError;
    private sendError;
    captureError(error: Error, metadata?: Record<string, any>): void;
    captureMessage(message: string, severity?: 'error' | 'warning' | 'info', metadata?: Record<string, any>): void;
    captureEvent(eventName: string, data?: Record<string, any>): void;
    setUser(user: {
        id: string;
        email?: string;
        name?: string;
    }): void;
    setContext(key: string, value: any): void;
    destroy(): void;
}
export default ErrorWatch;
