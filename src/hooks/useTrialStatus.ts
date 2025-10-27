
import { useMemo } from 'react';
import { useUserProfile } from './useUserProfile';

export const useTrialStatus = () => {
  const { data: profile, isLoading } = useUserProfile();

  const trialStatus = useMemo(() => {
    if (!profile) return null;

    const now = new Date();
    const subscriptionStatus = profile.subscription_status;
    const subscriptionExpiresAt = profile.subscription_expires_at ? new Date(profile.subscription_expires_at) : null;
    const gracePeriodEndsAt = profile.grace_period_ends_at ? new Date(profile.grace_period_ends_at) : null;
    const trialEndsAt = profile.trial_expires_at ? new Date(profile.trial_expires_at) : null;
    const paymentPlan = profile.payment_plan;

    // Check subscription status first
    if (subscriptionStatus === 'active') {
      return {
        isExpired: false,
        isPaid: true,
        isTrial: false,
        isCancelled: false,
        isGracePeriod: false,
        daysLeft: 0,
        status: 'active',
        expiresAt: subscriptionExpiresAt,
        planType: paymentPlan,
      };
    }

    if (subscriptionStatus === 'cancelled') {
      const daysLeft = subscriptionExpiresAt ? Math.ceil((subscriptionExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      return {
        isExpired: daysLeft <= 0,
        isPaid: daysLeft > 0, // Still has access
        isTrial: false,
        isCancelled: true,
        isGracePeriod: false,
        daysLeft: Math.max(0, daysLeft),
        status: 'cancelled',
        expiresAt: subscriptionExpiresAt,
        planType: paymentPlan,
      };
    }

    if (subscriptionStatus === 'grace_period') {
      const daysLeft = gracePeriodEndsAt ? Math.ceil((gracePeriodEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      return {
        isExpired: false,
        isPaid: true, // Still has access during grace period
        isTrial: false,
        isCancelled: false,
        isGracePeriod: true,
        daysLeft: Math.max(0, daysLeft),
        status: 'grace_period',
        gracePeriodEndsAt,
        expiresAt: subscriptionExpiresAt,
        planType: paymentPlan,
      };
    }

    if (subscriptionStatus === 'expired' || paymentPlan === 'expired') {
      return {
        isExpired: true,
        isPaid: false,
        isTrial: false,
        isCancelled: false,
        isGracePeriod: false,
        daysLeft: 0,
        status: 'expired',
        expiresAt: subscriptionExpiresAt,
      };
    }

    // Trial status (no subscription)
    if (!trialEndsAt || paymentPlan !== 'trial') {
      return {
        isExpired: paymentPlan === 'expired',
        isPaid: ['monthly', 'yearly'].includes(paymentPlan || ''),
        isTrial: paymentPlan === 'trial',
        isCancelled: false,
        isGracePeriod: false,
        daysLeft: 0,
        status: paymentPlan,
      };
    }

    const diffTime = trialEndsAt.getTime() - now.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      isExpired: daysLeft <= 0,
      isPaid: false,
      isTrial: true,
      isCancelled: false,
      isGracePeriod: false,
      daysLeft: Math.max(0, daysLeft),
      status: daysLeft <= 0 ? 'expired' : 'trial',
      trialEndsAt,
    };
  }, [profile]);

  return {
    trialStatus,
    isLoading,
    profile,
  };
};
