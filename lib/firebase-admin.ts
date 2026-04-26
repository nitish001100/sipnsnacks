import admin from 'firebase-admin';

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccount)),
    });
  } else {
    console.warn('FIREBASE_SERVICE_ACCOUNT_JSON not set - push notifications disabled');
  }
}

// Send push notification to a device token
export async function sendPushNotification(
  token: string,
  title: string = '🔔 New Order!',
  body: string = 'A new order has been received in kitchen'
): Promise<boolean> {
  if (!admin.apps.length) {
    console.warn('Firebase Admin not initialized');
    return false;
  }

  try {
    await admin.messaging().send({
      token,
      notification: { title, body },
      data: { title, body, url: '/kitchen' },
      webpush: {
        notification: {
          icon: '/logo.png',
          badge: '/logo.png',
          vibrate: [200, 100, 200],
          tag: 'kitchen-order',
          renotify: true,
        },
        fcmOptions: {
          link: '/kitchen',
        },
      },
    });
    console.log('Push notification sent successfully');
    return true;
  } catch (error: unknown) {
    const err = error as { code?: string };
    console.error('Failed to send push:', err);
    // Remove invalid tokens
    if (err.code === 'messaging/invalid-registration-token' ||
        err.code === 'messaging/registration-token-not-registered') {
      return false; // Token is invalid, caller should remove it
    }
    return false;
  }
}

// Send to multiple tokens
export async function sendPushToAll(
  tokens: string[],
  title: string = '🔔 New Order!',
  body: string = 'A new order has been received in kitchen'
): Promise<string[]> {
  const invalidTokens: string[] = [];

  for (const token of tokens) {
    const success = await sendPushNotification(token, title, body);
    if (!success) {
      invalidTokens.push(token);
    }
  }

  return invalidTokens; // Return invalid tokens for cleanup
}
