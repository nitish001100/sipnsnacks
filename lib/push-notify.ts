import { Pool } from 'pg';
import { sendPushToAll } from './firebase-admin';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Notify all registered kitchen devices about a new order
export async function notifyKitchen(orderNumber: string, itemCount: number) {
  try {
    // Get all push tokens
    const { rows } = await pool.query('SELECT token FROM push_tokens');
    if (rows.length === 0) {
      console.log('No push tokens registered');
      return;
    }

    const tokens = rows.map((r: { token: string }) => r.token);
    const title = `🔔 New Order #${orderNumber}`;
    const body = `${itemCount} item${itemCount > 1 ? 's' : ''} received — tap to view in kitchen`;

    const invalidTokens = await sendPushToAll(tokens, title, body);

    // Clean up invalid tokens
    if (invalidTokens.length > 0) {
      for (const token of invalidTokens) {
        await pool.query('DELETE FROM push_tokens WHERE token = $1', [token]);
      }
      console.log(`Removed ${invalidTokens.length} invalid push tokens`);
    }
  } catch (error) {
    console.error('Push notify error:', error);
    // Don't throw - push failure shouldn't break order creation
  }
}
