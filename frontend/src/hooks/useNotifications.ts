import { useState, useEffect, useCallback } from 'react';

const POLL_INTERVAL = 60_000; // 60 seconds

export function useUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshCount = useCallback(async () => {
    try {
      const token = localStorage.getItem('session_token');
      if (!token) return;
      const res = await fetch('/api/notifications/unread-count', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // Silently ignore polling errors
    }
  }, []);

  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [refreshCount]);

  return { unreadCount, refreshCount };
}
