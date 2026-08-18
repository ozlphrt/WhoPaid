/**
 * Web Push & Notification Helper for WhoPaid
 * Uses standard Web Notification API and Service Worker notifications
 */

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notifications.');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn('Error requesting notification permission:', err);
    return 'denied';
  }
}

export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

export function isNotificationGranted(): boolean {
  return isNotificationSupported() && Notification.permission === 'granted';
}

export async function sendLocalNotification(
  title: string,
  options?: NotificationOptions & { url?: string }
): Promise<void> {
  if (!isNotificationGranted()) return;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          icon: '/WhoPaid/favicon.ico',
          badge: '/WhoPaid/favicon.ico',
          ...options
        });
        return;
      }
    }

    // Fallback to standard Notification constructor
    new Notification(title, {
      icon: '/WhoPaid/favicon.ico',
      ...options
    });
  } catch (err) {
    console.warn('[Notification] Failed to display notification:', err);
  }
}
