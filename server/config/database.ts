import mongoose from 'mongoose';

let isConnected = false;
let isShutdownRegistered = false;

export const DEFAULT_DB_NAME = 'arthobachao';

/**
 * Connect to MongoDB safely without crashing the server if disconnected.
 * Ensures the target database is explicitly configured or safely defaults to 'arthobachao'.
 * Prevents duplicate connections if already connected.
 */
export async function connectDB(): Promise<boolean> {
  // If already connected, reuse existing active connection
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return true;
  }

  // If connection is in progress, wait for it
  if (mongoose.connection.readyState === 2) {
    await new Promise((res) => setTimeout(res, 200));
    return (mongoose.connection.readyState as number) === 1;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri || uri.trim() === '' || uri.includes('your_mongodb_connection_string')) {
    console.warn('[Database] MONGODB_URI is not configured in environment. Running in standalone fallback mode.');
    isConnected = false;
    return false;
  }

  const targetDbName = process.env.MONGODB_DB_NAME || DEFAULT_DB_NAME;

  try {
    // Mask credentials before logging to prevent exposing secrets
    const maskedUri = uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
    console.log(`[Database] Connecting to MongoDB (${targetDbName}) at ${maskedUri}...`);

    await mongoose.connect(uri, {
      dbName: targetDbName,
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
    });

    isConnected = true;
    console.log(`[Database] MongoDB connected successfully to database "${mongoose.connection.name}".`);

    mongoose.connection.on('error', (err) => {
      console.error('[Database] MongoDB runtime connection error:', err.message);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[Database] MongoDB disconnected. Falling back to standalone mode.');
      isConnected = false;
    });

    // Register graceful shutdown once
    if (!isShutdownRegistered) {
      isShutdownRegistered = true;
      const handleShutdown = async (signal: string) => {
        console.log(`[Database] Received ${signal}. Closing MongoDB connection gracefully...`);
        await disconnectDB();
      };
      process.once('SIGINT', () => handleShutdown('SIGINT'));
      process.once('SIGTERM', () => handleShutdown('SIGTERM'));
    }

    return true;
  } catch (error: any) {
    console.warn('[Database] Unable to connect to MongoDB:', error?.message || error);
    console.warn('[Database] The server will continue running using in-memory / local fallback data.');
    isConnected = false;
    return false;
  }
}

/**
 * Disconnect from MongoDB gracefully
 */
export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.disconnect();
    } catch (err: any) {
      console.warn('[Database] Error while disconnecting:', err?.message || err);
    }
  }
  isConnected = false;
}

/**
 * Check if MongoDB connection is currently active
 */
export function isDbConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

/**
 * Get active database name
 */
export function getDatabaseName(): string | undefined {
  return isDbConnected() ? mongoose.connection.name : undefined;
}
