// Facebook Pixel tracking helper functions

declare global {
  interface Window {
    fbq: (action: string, eventName: string, params?: Record<string, any>) => void;
  }
}

/**
 * Track a Lead event - when someone signs up/registers
 */
export const trackLead = () => {
  if (typeof window.fbq === 'function') {
    window.fbq('track', 'Lead');
    console.log('📊 Facebook Pixel: Lead event tracked');
  }
};

/**
 * Track CompleteRegistration event - when user completes onboarding
 */
export const trackCompleteRegistration = () => {
  if (typeof window.fbq === 'function') {
    window.fbq('track', 'CompleteRegistration');
    console.log('📊 Facebook Pixel: CompleteRegistration event tracked');
  }
};

/**
 * Track InitiateCheckout event - when user views pricing/billing page
 */
export const trackInitiateCheckout = () => {
  if (typeof window.fbq === 'function') {
    window.fbq('track', 'InitiateCheckout');
    console.log('📊 Facebook Pixel: InitiateCheckout event tracked');
  }
};

/**
 * Track Purchase event - when user completes a payment
 * @param value - Purchase value
 * @param currency - Currency code (default: ILS for Israeli Shekel)
 */
export const trackPurchase = (value: number, currency: string = 'ILS') => {
  if (typeof window.fbq === 'function') {
    window.fbq('track', 'Purchase', { value, currency });
    console.log('📊 Facebook Pixel: Purchase event tracked', { value, currency });
  }
};

/**
 * Track ViewContent event - when user views important content
 * @param contentName - Name of the content being viewed
 */
export const trackViewContent = (contentName: string) => {
  if (typeof window.fbq === 'function') {
    window.fbq('track', 'ViewContent', { content_name: contentName });
    console.log('📊 Facebook Pixel: ViewContent event tracked', contentName);
  }
};
