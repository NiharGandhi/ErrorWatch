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
export interface User {
    id: string;
    email?: string;
    name?: string;
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
    type: string;
}
