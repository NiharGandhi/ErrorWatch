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

export class ErrorWatch {
  private config: Required<ErrorWatchConfig>
  private isRecording = false
  private recordingEvents: any[] = []
  private stopRecording?: () => void

  constructor(config: ErrorWatchConfig) {
    this.config = {
      environment: 'production',
      baseUrl: 'https://jprla2e0--error-ingestion.functions.blink.new',
      enableScreenRecording: true,
      maxRecordingDuration: 30000, // 30 seconds
      captureConsole: true,
      captureNetwork: false,
      beforeSend: (error) => error,
      ...config
    }

    this.init()
  }

  private init() {
    // Set up global error handlers
    this.setupErrorHandlers()
    
    // Start screen recording if enabled
    if (this.config.enableScreenRecording) {
      this.startScreenRecording()
    }

    // Set up console capture if enabled
    if (this.config.captureConsole) {
      this.setupConsoleCapture()
    }
  }

  private setupErrorHandlers() {
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
    if (this.isRecording) return

    this.recordingEvents = []
    this.isRecording = true

    this.stopRecording = record({
      emit: (event) => {
        this.recordingEvents.push(event)
        
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
      plugins: []
    })
  }

  private restartRecording() {
    if (this.stopRecording) {
      this.stopRecording()
    }
    this.startScreenRecording()
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
      }

      // Send error to ErrorWatch API
      await this.sendError(errorData)
    } catch (err) {
      console.warn('ErrorWatch: Failed to send error', err)
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
        ...errorData,
        environment: this.config.environment,
        projectId: this.config.projectId
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
      url: window.location.href,
      userAgent: navigator.userAgent,
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
      url: window.location.href,
      userAgent: navigator.userAgent,
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
      url: window.location.href,
      userAgent: navigator.userAgent,
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
    // Store user context for future errors
    this.config.beforeSend = (error) => ({
      ...error,
      metadata: {
        ...error.error.metadata,
        user
      }
    })
  }

  public setContext(key: string, value: any) {
    const originalBeforeSend = this.config.beforeSend
    this.config.beforeSend = (error) => {
      const processed = originalBeforeSend(error)
      if (!processed) return processed
      
      return {
        ...processed,
        metadata: {
          ...processed.error.metadata,
          [key]: value
        }
      }
    }
  }

  public destroy() {
    if (this.stopRecording) {
      this.stopRecording()
    }
    this.isRecording = false
    this.recordingEvents = []
  }
}

// Default export for easy importing
export default ErrorWatch

// Browser global for script tag usage
if (typeof window !== 'undefined') {
  (window as any).ErrorWatch = ErrorWatch
}