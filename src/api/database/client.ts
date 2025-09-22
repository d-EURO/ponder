import { Pool } from 'pg';
import { config } from 'dotenv';

config({ path: '.env.api' });

// PostgreSQL connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/bapps_campaign',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Initialize database schema
export async function initializeDatabase(): Promise<void> {
  try {
    // Read schema file
    const fs = await import('fs/promises');
    const path = await import('path');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf-8');

    // Execute schema
    await pool.query(schema);
    console.log('Database schema initialized');
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
    throw error;
  }
}

// Helper function to handle transactions
export async function withTransaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Cleanup expired cache entries
export async function cleanupExpiredCache(): Promise<void> {
  try {
    const result = await pool.query(
      'DELETE FROM transaction_cache WHERE expires_at < NOW()'
    );
    if (result.rowCount > 0) {
      console.log(`Cleaned up ${result.rowCount} expired cache entries`);
    }
  } catch (error) {
    console.error('Failed to cleanup cache:', error);
  }
}

// Don't start cleanup on import - call manually when needed