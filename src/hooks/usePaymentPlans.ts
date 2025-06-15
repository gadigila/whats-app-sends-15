
import { useState } from 'react';

export type PaymentPlan = {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  period: 'monthly' | 'yearly';
  features: string[];
  popular?: boolean;
};

export const usePaymentPlans = () => {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const plans: PaymentPlan[] = [
    {
      id: 'premium-monthly',
      name: 'Reecher Premium',
      price: 99,
      period: 'monthly',
      features: [
        'הודעות ללא הגבלה',
        'שליחה לכל הקבוצות בבת אחת',
        'תזמון הודעות מתקדם',
        'העלאת קבצים ותמונות',
        'ניהול קבוצות וסגמנטים',
        'תמיכה טכנית מהירה',
        'גיבוי אוטומטי של ההודעות',
        'דוחות וסטטיסטיקות'
      ],
    },
    {
      id: 'premium-yearly',
      name: 'Reecher Premium',
      price: 990,
      originalPrice: 1188,
      period: 'yearly',
      popular: true,
      features: [
        'הודעות ללא הגבלה',
        'שליחה לכל הקבוצות בבת אחת',
        'תזמון הודעות מתקדם',
        'העלאת קבצים ותמונות',
        'ניהול קבוצות וסגמנטים',
        'תמיכה טכנית מהירה',
        'גיבוי אוטומטי של ההודעות',
        'דוחות וסטטיסטיקות',
        'חיסכון של 17% בתשלום שנתי'
      ],
    },
  ];

  const currentPlan = plans.find(plan => plan.period === billingPeriod);

  return {
    plans,
    currentPlan,
    billingPeriod,
    setBillingPeriod,
  };
};
