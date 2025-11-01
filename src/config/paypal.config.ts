// PayPal Configuration - Switch between Sandbox and Live easily
export const PAYPAL_CONFIG = {
  // 🔧 Change this line to switch environments
  mode: 'live' as 'sandbox' | 'live',
  
  sandbox: {
    clientId: 'AcaSanosVJM-vrExYYaL5mbfFtNS-WVY9Bl5ybGXHFioClYh_7C7z64ZSkMhYGP3H7wqsOYty9Bo30S6',
    monthlyPlanId: 'P-9MX89524P2411903TNEC6NXI',
    yearlyPlanId: 'P-9J3184758D142252LNEC6UMA'
  },
  
  live: {
    clientId: 'AR10sbKefx7DpNKT7y827_fC8tsV53kBseOQxhx-qFxE1b10ODFkFuQYYeTRHYiyKjBuuLFh7F9cuIe1',
    monthlyPlanId: 'P-8AN74902GS080034XNEB4T6Y',
    yearlyPlanId: 'P-1SD395240G565594LNEB5QQA'
  }
};

// Helper functions
export const getClientId = () => 
  PAYPAL_CONFIG.mode === 'sandbox' 
    ? PAYPAL_CONFIG.sandbox.clientId 
    : PAYPAL_CONFIG.live.clientId;

export const getPlanId = (period: 'monthly' | 'yearly') =>
  PAYPAL_CONFIG.mode === 'sandbox'
    ? (period === 'monthly' ? PAYPAL_CONFIG.sandbox.monthlyPlanId : PAYPAL_CONFIG.sandbox.yearlyPlanId)
    : (period === 'monthly' ? PAYPAL_CONFIG.live.monthlyPlanId : PAYPAL_CONFIG.live.yearlyPlanId);

export const getPayPalMode = () => PAYPAL_CONFIG.mode;

export const isLiveMode = () => PAYPAL_CONFIG.mode === 'live';
