# ErrorWatch SDK

The official JavaScript SDK for ErrorWatch error monitoring platform.

## Installation

```bash
npm install @errorwatch/sdk
```

Or with yarn:

```bash
yarn add @errorwatch/sdk
```

## Quick Start

```javascript
import { ErrorWatch } from '@errorwatch/sdk'

// Initialize ErrorWatch
const errorWatch = new ErrorWatch({
  apiKey: 'your-api-key',
  projectId: 'your-project-id',
  environment: 'production'
})

// The SDK will automatically capture errors
// You can also manually report errors:
errorWatch.captureError(new Error('Something went wrong'))

// Capture custom events
errorWatch.captureEvent('user_action', {
  action: 'button_click',
  component: 'header'
})
```

## Configuration

```javascript
const errorWatch = new ErrorWatch({
  apiKey: 'your-api-key',                    // Required
  projectId: 'your-project-id',              // Required
  environment: 'production',                 // Optional: 'development' | 'staging' | 'production'
  baseUrl: 'https://api.errorwatch.dev',     // Optional: Custom API endpoint
  enableScreenRecording: true,               // Optional: Enable screen recordings
  maxRecordingDuration: 30000,               // Optional: Max recording duration in ms
  captureConsole: true,                      // Optional: Capture console errors
  captureNetwork: false,                     // Optional: Capture network errors
  beforeSend: (error) => {                   // Optional: Filter/modify errors before sending
    // Return null to skip sending the error
    if (error.message.includes('ignore')) {
      return null
    }
    return error
  }
})
```

## API Methods

### captureError(error, metadata?)

Manually capture an error:

```javascript
try {
  // Some code that might throw
  riskyOperation()
} catch (error) {
  errorWatch.captureError(error, {
    userId: '12345',
    action: 'risky_operation'
  })
}
```

### captureMessage(message, severity?, metadata?)

Capture a custom message:

```javascript
errorWatch.captureMessage('User completed onboarding', 'info', {
  userId: '12345',
  step: 'final'
})
```

### captureEvent(eventName, data?)

Capture custom events:

```javascript
errorWatch.captureEvent('purchase_completed', {
  amount: 99.99,
  currency: 'USD',
  userId: '12345'
})
```

### setUser(user)

Set user context for all future errors:

```javascript
errorWatch.setUser({
  id: '12345',
  email: 'user@example.com',
  name: 'John Doe'
})
```

### setContext(key, value)

Add custom context to all future errors:

```javascript
errorWatch.setContext('version', '1.2.3')
errorWatch.setContext('feature_flags', {
  newUI: true,
  betaFeature: false
})
```

### destroy()

Clean up the ErrorWatch instance:

```javascript
errorWatch.destroy()
```

## Features

- **Automatic Error Capture**: Captures uncaught JavaScript errors and unhandled promise rejections
- **Screen Recordings**: Records user sessions to help debug errors (optional)
- **Console Capture**: Captures console.error and console.warn messages (optional)
- **Custom Events**: Track custom events and user actions
- **User Context**: Associate errors with specific users
- **Environment Support**: Different configurations for development, staging, and production
- **Filtering**: Filter out unwanted errors before sending
- **TypeScript Support**: Full TypeScript definitions included

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## License

MIT License - see LICENSE file for details.