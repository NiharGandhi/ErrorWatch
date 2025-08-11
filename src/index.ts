import { record } from 'rrweb'

export interface ErrorWatchConfig {
  apiKey: string
  projectId: string
  environment?: 'development' | 'staging' | 'production'
  baseUrl?: string
  enableScreenRecording?: boolean
  maxRecordingDuration?: number
  captureConsole?: boolean
  captureNetwork?: boolean
  beforeSend?: (error: ErrorEvent) => ErrorEvent | null
  redactSelectors?: string[]; // CSS selectors to redact in session replay
  allowPII?: boolean; // If false, redact sensitive fields
  analyticsHooks?: {
    onErrorCaptured?: (error: ErrorData) => void;
    onSessionStart?: (sessionId: string) => void;
    onSessionEnd?: (sessionId: string) => void;
  };
}

export interface ErrorData {
  message: string
  stack?: string
  url: string
  line?: number
  column?: number
  userAgent: string
  timestamp: number
  severity: 'error' | 'warning' | 'info'
  metadata?: Record<string, any>
  screenRecording?: string
}

export interface Breadcrumb {
  type: string;
  message: string;
  data?: any;
  timestamp: number;
}

export interface ErrorEvent {
  message: string
  stack?: string
  url: string
  line?: number
  column?: number
  userAgent: string
  timestamp: number
  severity: 'error' | 'warning' | 'info'
  metadata?: Record<string, any>
  screenRecording?: string
  type?: string
}

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

// Utility for exponential backoff
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Key for localStorage queue
const ERROR_QUEUE_KEY = 'errorwatch_queue_v1';
const BATCH_INTERVAL = 5000; // ms
const BATCH_SIZE = 10;
const BREADCRUMB_LIMIT = 30;

function loadQueue(): ErrorData[] {
  if (!isBrowser) return [];
  try {
    const raw = localStorage.getItem(ERROR_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: ErrorData[]) {
  if (!isBrowser) return;
  try {
    localStorage.setItem(ERROR_QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

function generateSessionId() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2)
  );
}

export class ErrorWatch {
  private config: Required<ErrorWatchConfig>
  private isRecording = false
  private recordingEvents: any[] = []
  private stopRecording?: () => void
  private errorQueue: ErrorData[] = [];
  private isSendingQueue = false;
  private batch: ErrorData[] = [];
  private batchTimer: any = null;
  private breadcrumbs: Breadcrumb[] = [];
  private sessionId: string = '';
  private userId: string | undefined;
  private sessionStartTime: number = 0;

  constructor(config: ErrorWatchConfig) {
    const analyticsHooks = { ...config.analyticsHooks };
    this.config = {
      environment: 'production',
      baseUrl: 'http://localhost:8000/errors',
      enableScreenRecording: true,
      maxRecordingDuration: 30000,
      captureConsole: true,
      captureNetwork: false,
      beforeSend: (error) => error,
      redactSelectors: [],
      allowPII: false,
      analyticsHooks,
      ...config,
    };

    this.errorQueue = loadQueue();
    
    if (isBrowser) {
      window.addEventListener('online', () => this.flushQueue());
    }

    this.sessionId = generateSessionId();
    this.sessionStartTime = Date.now();
    if (this.config.analyticsHooks?.onSessionStart) {
      this.config.analyticsHooks.onSessionStart(this.sessionId);
    }
    
    if (isBrowser) {
      window.addEventListener('beforeunload', () => {
        if (this.config.analyticsHooks?.onSessionEnd) {
          this.config.analyticsHooks.onSessionEnd(this.sessionId);
        }
      });
    }

    this.init()
  }

  private init() {
    // Set up global error handlers
    this.setupErrorHandlers()
    
    // Start screen recording if enabled and in browser
    if (this.config.enableScreenRecording && isBrowser) {
      this.startScreenRecording()
    }

    // Set up console capture if enabled
    if (this.config.captureConsole) {
      this.setupConsoleCapture()
    }

    this.setupBreadcrumbs();
    this.flushQueue();
  }

  private setupErrorHandlers() {
    if (!isBrowser) return;
    
    // Handle uncaught JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError({
        message: event.message,
        stack: event.error?.stack,
        url: event.filename || window.location.href,
        line: event.lineno,
        column: event.colno,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        severity: 'error'
      })
    })

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        severity: 'error',
        metadata: {
          type: 'unhandledrejection',
          reason: event.reason
        }
      })
    })
  }

  private setupConsoleCapture() {
    if (!isBrowser) return;
    
    const originalConsoleError = console.error
    const originalConsoleWarn = console.warn

    console.error = (...args) => {
      this.handleError({
        message: args.join(' '),
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        severity: 'error',
        metadata: {
          type: 'console.error',
          args
        }
      })
      originalConsoleError.apply(console, args)
    }

    console.warn = (...args) => {
      this.handleError({
        message: args.join(' '),
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        severity: 'warning',
        metadata: {
          type: 'console.warn',
          args
        }
      })
      originalConsoleWarn.apply(console, args)
    }
  }

  private startScreenRecording() {
    if (!isBrowser || this.isRecording) return;
    this.recordingEvents = [];
    this.isRecording = true;
    this.stopRecording = record({
      emit: (event) => {
        // For privacy, recommend using rrweb's maskTextClass option for sensitive fields
        // Do not mutate rrweb node objects directly
        this.recordingEvents.push(event);
        
        // Limit recording duration
        if (this.recordingEvents.length > 0) {
          const firstEvent = this.recordingEvents[0]
          const currentTime = Date.now()
          if (currentTime - firstEvent.timestamp > this.config.maxRecordingDuration) {
            this.restartRecording()
          }
        }
      },
      recordCanvas: true,
      collectFonts: true,
      plugins: [],
      maskTextClass: this.config.redactSelectors?.join(',') || undefined,
    })
  }

  private restartRecording() {
    if (this.stopRecording) {
      this.stopRecording()
    }
    this.startScreenRecording()
  }

  private addBreadcrumb(breadcrumb: Breadcrumb) {
    this.breadcrumbs.push(breadcrumb);
    if (this.breadcrumbs.length > BREADCRUMB_LIMIT) {
      this.breadcrumbs.shift();
    }
  }

  private setupBreadcrumbs() {
    if (!isBrowser) return;
    
    // Navigation
    window.addEventListener('popstate', () => {
      this.addBreadcrumb({
        type: 'navigation',
        message: 'popstate',
        data: { url: window.location.href },
        timestamp: Date.now()
      });
    });
    window.addEventListener('hashchange', () => {
      this.addBreadcrumb({
        type: 'navigation',
        message: 'hashchange',
        data: { url: window.location.href },
        timestamp: Date.now()
      });
    });
    // Clicks
    window.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      this.addBreadcrumb({
        type: 'ui',
        message: 'click',
        data: { tag: target?.tagName, id: target?.id, class: target?.className },
        timestamp: Date.now()
      });
    }, true);
    // Console
    const origLog = console.log;
    console.log = (...args) => {
      this.addBreadcrumb({
        type: 'console',
        message: 'log',
        data: { args },
        timestamp: Date.now()
      });
      origLog.apply(console, args);
    };
  }

  private redactDom(domString: string): string {
    if (!isBrowser || !this.config.redactSelectors || this.config.allowPII) return domString;
    let doc = new DOMParser().parseFromString(domString, 'text/html');
    for (const selector of this.config.redactSelectors) {
      doc.querySelectorAll(selector).forEach(el => {
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          el.value = '[REDACTED]';
        } else {
          el.textContent = '[REDACTED]';
        }
      });
    }
    return doc.documentElement.outerHTML;
  }

  private async handleError(errorData: ErrorData) {
    try {
      // Apply beforeSend filter
      const processedError = this.config.beforeSend({
        ...errorData,
        type: 'error'
      } as any)

      if (!processedError) return

      // Add screen recording if available
      if (this.config.enableScreenRecording && this.recordingEvents.length > 0) {
        errorData.screenRecording = JSON.stringify(this.recordingEvents)
        // Log the screen recording for testing and replay
        console.log('[ErrorWatch] screenRecording:', errorData.screenRecording)
      }

      errorData.metadata = {
        ...errorData.metadata,
        breadcrumbs: this.breadcrumbs.slice(),
        sessionId: this.sessionId,
        userId: this.userId,
        sessionStart: this.sessionStartTime,
      };
      if (this.config.analyticsHooks?.onErrorCaptured) {
        this.config.analyticsHooks.onErrorCaptured(errorData);
      }
      this.addToBatch(errorData);
    } catch (err) {
      this.queueError(errorData);
      console.warn('ErrorWatch: Failed to queue error for batch', err);
    }
  }

  private addToBatch(errorData: ErrorData) {
    this.batch.push(errorData);
    if (this.batch.length >= BATCH_SIZE) {
      this.flushBatch();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flushBatch(), BATCH_INTERVAL);
    }
  }

  private async flushBatch() {
    if (this.batch.length === 0) return;
    const batchToSend = this.batch.slice();
    this.batch = [];
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    try {
      await this.sendBatch(batchToSend);
    } catch (err) {
      // If batch send fails, queue all errors for retry
      batchToSend.forEach(e => this.queueError(e));
      console.warn('ErrorWatch: Failed to send batch, queued for retry', err);
    }
  }

  private async sendBatch(errors: ErrorData[]) {
    const response = await fetch(this.config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'X-ErrorWatch-Project': this.config.projectId,
        'X-ErrorWatch-Batch': '1'
      },
      body: JSON.stringify({
        batch: errors.map(e => ({
          project_id: this.config.projectId,
          message: e.message,
          level: e.severity,
          environment: this.config.environment,
          exception_type: e.metadata?.type || 'error',
          stacktrace: e.stack || '',
          user_id: e.metadata?.user?.id || '',
          ip_address: '',
          sdk: 'errorwatch-js/1.0.0',
          breadcrumbs: e.metadata?.breadcrumbs ? JSON.stringify(e.metadata.breadcrumbs) : '',
          timestamp: new Date(e.timestamp).toISOString()
        }))
      })
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  private queueError(errorData: ErrorData) {
    this.errorQueue.push(errorData);
    saveQueue(this.errorQueue);
  }

  private async flushQueue() {
    if (this.isSendingQueue) return;
    this.isSendingQueue = true;
    try {
      while (this.errorQueue.length > 0) {
        // Instead of sending one by one, batch up to BATCH_SIZE
        const batch = this.errorQueue.splice(0, BATCH_SIZE);
        try {
          await this.sendBatch(batch);
          saveQueue(this.errorQueue);
        } catch {
          // If batch fails, put errors back and stop
          this.errorQueue = batch.concat(this.errorQueue);
          saveQueue(this.errorQueue);
          break;
        }
      }
    } finally {
      this.isSendingQueue = false;
    }
  }

  private async sendError(errorData: ErrorData) {
    const response = await fetch(this.config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'X-ErrorWatch-Project': this.config.projectId
      },
      body: JSON.stringify({
        project_id: this.config.projectId,
        message: errorData.message,
        level: errorData.severity,
        environment: this.config.environment,
        exception_type: errorData.metadata?.type || 'error',
        stacktrace: errorData.stack || '',
        user_id: errorData.metadata?.user?.id || '',
        ip_address: '',
        sdk: 'errorwatch-js/1.0.0',
        breadcrumbs: errorData.metadata?.breadcrumbs ? JSON.stringify(errorData.metadata.breadcrumbs) : '',
        timestamp: new Date(errorData.timestamp).toISOString()
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  // Public API methods
  public captureError(error: Error, metadata?: Record<string, any>) {
    this.handleError({
      message: error.message,
      stack: error.stack,
      url: isBrowser ? window.location.href : 'nodejs',
      userAgent: isBrowser ? navigator.userAgent : 'nodejs',
      timestamp: Date.now(),
      severity: 'error',
      metadata: {
        ...metadata,
        type: 'manual'
      }
    })
  }

  public captureMessage(message: string, severity: 'error' | 'warning' | 'info' = 'info', metadata?: Record<string, any>) {
    this.handleError({
      message,
      url: isBrowser ? window.location.href : 'nodejs',
      userAgent: isBrowser ? navigator.userAgent : 'nodejs',
      timestamp: Date.now(),
      severity,
      metadata: {
        ...metadata,
        type: 'message'
      }
    })
  }

  public captureEvent(eventName: string, data?: Record<string, any>) {
    this.handleError({
      message: `Event: ${eventName}`,
      url: isBrowser ? window.location.href : 'nodejs',
      userAgent: isBrowser ? navigator.userAgent : 'nodejs',
      timestamp: Date.now(),
      severity: 'info',
      metadata: {
        ...data,
        type: 'event',
        eventName
      }
    })
  }

  public setUser(user: { id: string; email?: string; name?: string }) {
    this.userId = user.id;
    // Store user context for future errors
    const originalBeforeSend = this.config.beforeSend;
    this.config.beforeSend = (error) => {
      const processed = originalBeforeSend(error);
      if (!processed) return processed;
      
      return {
        ...processed,
        metadata: {
          ...processed.metadata,
          user
        }
      };
    };
  }

  public setContext(key: string, value: any) {
    const originalBeforeSend = this.config.beforeSend;
    this.config.beforeSend = (error) => {
      const processed = originalBeforeSend(error);
      if (!processed) return processed;
      
      return {
        ...processed,
        metadata: {
          ...processed.metadata,
          [key]: value
        }
      };
    };
  }

  public destroy() {
    if (this.stopRecording) {
      this.stopRecording();
    }
    this.isRecording = false;
    this.recordingEvents = [];
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.flushBatch();
  }
}

// Default export for easy importing
export default ErrorWatch

// Browser global for script tag usage
if (typeof window !== 'undefined') {
  (window as any).ErrorWatch = ErrorWatch
}