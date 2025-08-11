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
    redactSelectors?: string[];
    allowPII?: boolean;
    analyticsHooks?: {
        onErrorCaptured?: (error: ErrorData) => void;
        onSessionStart?: (sessionId: string) => void;
        onSessionEnd?: (sessionId: string) => void;
    };
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
export interface Breadcrumb {
    type: string;
    message: string;
    data?: any;
    timestamp: number;
}
export interface ErrorEvent {
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
    type?: string;
}
export declare class ErrorWatch {
    private config;
    private isRecording;
    private recordingEvents;
    private stopRecording?;
    private errorQueue;
    private isSendingQueue;
    private batch;
    private batchTimer;
    private breadcrumbs;
    private sessionId;
    private userId;
    private sessionStartTime;
    constructor(config: ErrorWatchConfig);
    private init;
    private setupErrorHandlers;
    private setupConsoleCapture;
    private startScreenRecording;
    private restartRecording;
    private addBreadcrumb;
    private setupBreadcrumbs;
    private redactDom;
    private handleError;
    private addToBatch;
    private flushBatch;
    private sendBatch;
    private queueError;
    private flushQueue;
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
