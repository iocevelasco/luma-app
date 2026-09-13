import mongoose from 'mongoose';
import { DATABASE_CONFIG, isProduction } from './app.config.js';

// Get MONGODB_URI from configuration
const MONGODB_URI = DATABASE_CONFIG.MONGODB_URI;

// Debug: Log which URI is being used (mask password for security)
if (!isProduction || DATABASE_CONFIG.DEBUG_DB_URI) {
  const uriDisplay = MONGODB_URI.includes('@') 
    ? MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@')
    : MONGODB_URI;
  console.log(`🔍 [DATABASE] Using MONGODB_URI: ${uriDisplay}`);
  console.log(`🔍 [DATABASE] Source: ${DATABASE_CONFIG.MONGODB_URI ? 'environment variable' : 'default (localhost)'}`);
}

let isConnected = false;
let connectionAttempts = 0;
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5 seconds

export async function connectDatabase(retry = true): Promise<boolean> {
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('📊 [DATABASE] Already connected to MongoDB');
    return true;
  }

  try {
    connectionAttempts++;
    const uriDisplay = MONGODB_URI.includes('@') 
      ? MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@') // Mask password
      : MONGODB_URI;
    
    console.log(`🔄 [DATABASE] Attempting to connect to MongoDB (attempt ${connectionAttempts}/${MAX_RETRIES})...`);
    console.log(`📝 [DATABASE] Connection URI: ${uriDisplay}`);
    
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    });
    
    isConnected = true;
    connectionAttempts = 0;
    console.log('✅ [DATABASE] Successfully connected to MongoDB');
    console.log(`📊 [DATABASE] Connection state: ${mongoose.connection.readyState} (1=connected)`);
    console.log(`📊 [DATABASE] Database name: ${mongoose.connection.db?.databaseName || 'unknown'}`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ [DATABASE] Connection error (attempt ${connectionAttempts}/${MAX_RETRIES}):`, errorMessage);
    
    // Check for IP whitelist error specifically
    if (errorMessage.includes('IP') && errorMessage.includes('whitelist')) {
      console.error('');
      console.error('🚨 [DATABASE] IP WHITELIST ERROR DETECTED');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('💡 [DATABASE] SOLUTION: Si la base es externa, habilitar la IP del servidor en su Network Access');
      console.error('');
      console.error('📋 [DATABASE] Steps to fix:');
      console.error('   1. Go to https://cloud.mongodb.com/');
      console.error('   2. Select your project → Network Access');
      console.error('   3. Click "Add IP Address"');
      console.error('   4. Select "Allow Access from Anywhere" (0.0.0.0/0)');
      console.error('   5. Click "Confirm"');
      console.error('');
      console.error('   Using 0.0.0.0/0 is safe because MongoDB requires authentication.');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('');
    }
    
    if (error instanceof Error) {
      console.error(`📋 [DATABASE] Error details:`, {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n'), // First 3 lines of stack
      });
    }
    
    if (retry && connectionAttempts < MAX_RETRIES) {
      console.log(`⏳ [DATABASE] Retrying in ${RETRY_DELAY / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return connectDatabase(true);
    }
    
    console.error('❌ [DATABASE] Failed to connect to MongoDB after all retry attempts');
    console.error('💡 [DATABASE] Check the following:');
    console.error('   - MONGODB_URI environment variable is set correctly');
    console.error('   - MongoDB server is running and accessible');
    console.error('   - Network connectivity to MongoDB server');
    console.error('   - MongoDB credentials are correct');
    console.error('   - IP whitelist configured in MongoDB Atlas (if using Atlas)');
    isConnected = false;
    return false;
  }
}

// Handle connection events
mongoose.connection.on('connected', () => {
  isConnected = true;
  connectionAttempts = 0;
  console.log('✅ [DATABASE] MongoDB connection event: connected');
  console.log(`📊 [DATABASE] Host: ${mongoose.connection.host}:${mongoose.connection.port}`);
  console.log(`📊 [DATABASE] Database: ${mongoose.connection.name}`);
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.log('⚠️  [DATABASE] MongoDB connection event: disconnected');
  console.log('📊 [DATABASE] Connection state changed to disconnected');
  
  // Attempt to reconnect if we're in production
  if (isProduction) {
    console.log('🔄 [DATABASE] Attempting to reconnect to MongoDB in production mode...');
    setTimeout(() => connectDatabase(true), RETRY_DELAY);
  } else {
    console.log('ℹ️  [DATABASE] Reconnection disabled in development mode');
  }
});

mongoose.connection.on('error', (error) => {
  isConnected = false;
  console.error('❌ [DATABASE] MongoDB connection error event:', error);
  console.error('📋 [DATABASE] Error details:', {
    name: error.name,
    message: error.message,
  });
});

// Export connection status
export function isDatabaseConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

