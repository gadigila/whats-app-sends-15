
import { useState, useCallback } from 'react';
import { WHAPIService } from '@/services/whapi';

export interface WhapiInstance {
  id: string;
  name: string;
  status: string;
  phone?: string;
  created_at?: string;
}

export interface WhapiGroup {
  id: string;
  name: string;
  participants_count?: number;
}

export const useWhapiService = (apiKey?: string) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = apiKey ? new WHAPIService(apiKey) : null;

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Check connection to WHAPI
  const checkConnection = useCallback(async () => {
    if (!service) {
      setError('API Key not configured');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await service.checkConnection();
      if (result.success) {
        return true;
      } else {
        setError(result.error || result.message);
        return false;
      }
    } catch (err) {
      setError(err.message || 'Unexpected error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [service]);

  // Get QR Code
  const getQRCode = useCallback(async (instanceId: string) => {
    if (!service) {
      setError('API Key not configured');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await service.getQRCode(instanceId);
      if (result.success) {
        return result.qrCode;
      } else {
        setError(result.error || result.message);
        return null;
      }
    } catch (err) {
      setError(err.message || 'Error getting QR Code');
      return null;
    } finally {
      setLoading(false);
    }
  }, [service]);

  // Check instance status
  const checkInstanceStatus = useCallback(async (instanceId: string) => {
    if (!service) return null;

    try {
      const result = await service.getInstanceStatus(instanceId);
      return result;
    } catch (err) {
      console.error('Error checking status:', err);
      return null;
    }
  }, [service]);

  // Get groups
  const getGroups = useCallback(async (instanceId: string) => {
    if (!service) {
      setError('API Key not configured');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const result = await service.getGroups(instanceId);
      if (result.success) {
        return result.groups;
      } else {
        setError(result.error || result.message);
        return [];
      }
    } catch (err) {
      setError(err.message || 'Error loading groups');
      return [];
    } finally {
      setLoading(false);
    }
  }, [service]);

  return {
    loading,
    error,
    clearError,
    checkConnection,
    getQRCode,
    checkInstanceStatus,
    getGroups,
  };
};
