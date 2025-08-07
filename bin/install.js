#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('🚀 Welcome to ErrorWatch!')
console.log('Setting up error monitoring for your project...\n')

// Check if we're in a Node.js project
const packageJsonPath = path.join(process.cwd(), 'package.json')
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ No package.json found. Please run this command in a Node.js project directory.')
  process.exit(1)
}

// Install the ErrorWatch SDK
console.log('📦 Installing @errorwatch/sdk...')
try {
  execSync('npm install @errorwatch/sdk', { stdio: 'inherit' })
  console.log('✅ ErrorWatch SDK installed successfully!\n')
} catch (error) {
  console.error('❌ Failed to install ErrorWatch SDK:', error.message)
  process.exit(1)
}

// Create example configuration file
const exampleConfig = `// ErrorWatch Configuration Example
import { ErrorWatch } from '@errorwatch/sdk'

const errorWatch = new ErrorWatch({
  apiKey: 'YOUR_API_KEY_HERE',
  projectId: 'YOUR_PROJECT_ID_HERE',
  environment: process.env.NODE_ENV || 'development',
  enableScreenRecording: true,
  captureConsole: true
})

// Optional: Set user context
errorWatch.setUser({
  id: 'user-123',
  email: 'user@example.com',
  name: 'John Doe'
})

// Optional: Add custom context
errorWatch.setContext('version', '1.0.0')

export default errorWatch
`

const configPath = path.join(process.cwd(), 'errorwatch.config.js')
if (!fs.existsSync(configPath)) {
  fs.writeFileSync(configPath, exampleConfig)
  console.log('📝 Created errorwatch.config.js with example configuration')
}

// Create .env example
const envExample = `# ErrorWatch Configuration
ERRORWATCH_API_KEY=your_api_key_here
ERRORWATCH_PROJECT_ID=your_project_id_here
`

const envExamplePath = path.join(process.cwd(), '.env.example')
if (!fs.existsSync(envExamplePath)) {
  fs.writeFileSync(envExamplePath, envExample)
  console.log('📝 Created .env.example with ErrorWatch environment variables')
}

console.log('\n🎉 ErrorWatch setup complete!')
console.log('\nNext steps:')
console.log('1. Get your API key and Project ID from https://errorwatch.dev/dashboard')
console.log('2. Update errorwatch.config.js with your credentials')
console.log('3. Import and initialize ErrorWatch in your app:')
console.log('   import errorWatch from "./errorwatch.config.js"')
console.log('\n📚 Documentation: https://docs.errorwatch.dev')
console.log('💬 Support: https://errorwatch.dev/support')