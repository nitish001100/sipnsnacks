import { getPushTokens, deletePushToken } from './db';
import { sendPushToAll } from './firebase-admin';

// Notify all registered kitchen devices about a new order
export async function notifyKitchen(orderNumber: string, itemCount: number) {
  try {
    // Get all push tokens
    const tokens = await getPushTokens();
    if (tokens.length === 0) {
      console.log('No push tokens registered');
      return;
    }

    const title = `🔔 New Order #${orderNumber}`;
    const body = `${itemCount} item${itemCount > 1 ? 's' : ''} received — tap to view in kitchen`;

    const invalidTokens = await sendPushToAll(tokens, title, body);

    // Clean up invalid tokens
    if (invalidTokens.length > 0) {
      for (const token of invalidTokens) {
        await deletePushToken(token);
      }
      console.log(`Removed ${invalidTokens.length} invalid push tokens`);
    }
  } catch (error) {
    console.error('Push notify error:', error);
    // Don't throw - push failure shouldn't break order creation
  }
}
