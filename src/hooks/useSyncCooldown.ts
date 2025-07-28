import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const COOLDOWN_DURATION = 60 * 1000; // 1 minute in milliseconds

interface SyncCooldownState {
  isInCooldown: boolean;
  remainingTime: number;
  formattedTime: string;
}

export const useSyncCooldown = () => {
  const { user } = useAuth();
  const [cooldownState, setCooldownState] = useState<SyncCooldownState>({
    isInCooldown: false,
    remainingTime: 0,
    formattedTime: '00:00'
  });

  const getStorageKey = () => `first_sync_cooldown_${user?.id}`;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const updateCooldownState = useCallback(() => {
    if (!user?.id) return;

    const storageKey = getStorageKey();
    const firstSyncTime = localStorage.getItem(storageKey);
    
    if (!firstSyncTime) {
      setCooldownState({
        isInCooldown: false,
        remainingTime: 0,
        formattedTime: '00:00'
      });
      return;
    }

    const syncTimestamp = parseInt(firstSyncTime);
    const now = Date.now();
    const elapsed = now - syncTimestamp;
    const remaining = Math.max(0, COOLDOWN_DURATION - elapsed);

    if (remaining <= 0) {
      // Cooldown expired, clean up
      localStorage.removeItem(storageKey);
      setCooldownState({
        isInCooldown: false,
        remainingTime: 0,
        formattedTime: '00:00'
      });
    } else {
      const remainingSeconds = Math.ceil(remaining / 1000);
      setCooldownState({
        isInCooldown: true,
        remainingTime: remaining,
        formattedTime: formatTime(remainingSeconds)
      });
    }
  }, [user?.id]);

  // Update cooldown state every second when in cooldown
  useEffect(() => {
    updateCooldownState();
    
    const interval = setInterval(updateCooldownState, 1000);
    return () => clearInterval(interval);
  }, [updateCooldownState]);

  const startCooldown = useCallback(() => {
    if (!user?.id) return;

    const storageKey = getStorageKey();
    const existingCooldown = localStorage.getItem(storageKey);
    
    // Only start cooldown for first sync attempt
    if (!existingCooldown) {
      localStorage.setItem(storageKey, Date.now().toString());
      updateCooldownState();
    }
  }, [user?.id, updateCooldownState]);

  const clearCooldown = useCallback(() => {
    if (!user?.id) return;
    
    const storageKey = getStorageKey();
    localStorage.removeItem(storageKey);
    setCooldownState({
      isInCooldown: false,
      remainingTime: 0,
      formattedTime: '00:00'
    });
  }, [user?.id]);

  const isFirstTimeUser = useCallback(() => {
    if (!user?.id) return false;
    
    const storageKey = getStorageKey();
    return !localStorage.getItem(storageKey);
  }, [user?.id]);

  return {
    isInCooldown: cooldownState.isInCooldown,
    remainingTime: cooldownState.remainingTime,
    formattedTime: cooldownState.formattedTime,
    startCooldown,
    clearCooldown,
    isFirstTimeUser: isFirstTimeUser()
  };
};