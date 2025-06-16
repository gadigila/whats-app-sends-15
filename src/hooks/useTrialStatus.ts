
import { useMemo } from 'react';
import { useUserProfile } from './useUserProfile';

export const useTrialStatus = () => {
  const { data: profile, isLoading } = useUserProfile();

  const trialStatus = useMemo(() => {
    if (!profile) return null;

    const now = new Date();
    const trialEndsAt = profile.trial_expires_at ? new Date(profile.trial_expires_at) : null;
    const paymentPlan = profile.payment_plan;

    // אם אין תאריך פגיעה או שהסטטוס לא trial
    if (!trialEndsAt || paymentPlan !== 'trial') {
      return {
        isExpired: paymentPlan === 'expired',
        isPaid: ['monthly', 'yearly'].includes(paymentPlan || ''),
        isTrial: paymentPlan === 'trial',
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
