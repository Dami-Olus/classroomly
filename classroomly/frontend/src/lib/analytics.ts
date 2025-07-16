// Analytics configuration and tracking utilities
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

// Google Analytics 4 Measurement ID
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

// Initialize Google Analytics
export const initGA = () => {
  if (typeof window !== 'undefined' && GA_MEASUREMENT_ID) {
    // Load Google Analytics script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);

    // Initialize gtag
    window.dataLayer = window.dataLayer || [];
    window.gtag = function() {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_title: document.title,
      page_location: window.location.href,
    });
  }
};

// Track page views
export const trackPageView = (url: string, title?: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: url,
      page_title: title || document.title,
    });
  }
};

// Track custom events
export const trackEvent = (
  action: string,
  category: string,
  label?: string,
  value?: number
) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

// User engagement tracking
export const trackUserEngagement = {
  // Authentication events
  signUp: (userType: 'TUTOR' | 'STUDENT') => {
    trackEvent('sign_up', 'engagement', userType);
  },
  
  signIn: (userType: 'TUTOR' | 'STUDENT') => {
    trackEvent('login', 'engagement', userType);
  },
  
  signOut: () => {
    trackEvent('logout', 'engagement');
  },

  // Class management (for tutors)
  createClass: (subject: string) => {
    trackEvent('create_class', 'class_management', subject);
  },
  
  updateClass: (classId: string, subject: string) => {
    trackEvent('update_class', 'class_management', `${subject}_${classId}`);
  },
  
  deleteClass: (classId: string, subject: string) => {
    trackEvent('delete_class', 'class_management', `${subject}_${classId}`);
  },

  // Booking events
  createBooking: (classTitle: string, tutorName: string) => {
    trackEvent('create_booking', 'booking', `${classTitle}_${tutorName}`);
  },
  
  cancelBooking: (classTitle: string, reason?: string) => {
    trackEvent('cancel_booking', 'booking', `${classTitle}_${reason || 'no_reason'}`);
  },
  
  rescheduleRequest: (classTitle: string, requestType: 'propose' | 'accept' | 'decline') => {
    trackEvent('reschedule_request', 'booking', `${classTitle}_${requestType}`);
  },

  // Session events
  joinSession: (classTitle: string, sessionType: 'tutor' | 'student') => {
    trackEvent('join_session', 'session', `${classTitle}_${sessionType}`);
  },
  
  leaveSession: (classTitle: string, duration: number) => {
    trackEvent('leave_session', 'session', classTitle, duration);
  },
  
  completeSession: (classTitle: string, duration: number) => {
    trackEvent('complete_session', 'session', classTitle, duration);
  },

  // Profile events
  updateProfile: (userType: 'TUTOR' | 'STUDENT', field: string) => {
    trackEvent('update_profile', 'profile', `${userType}_${field}`);
  },
  
  updateAvailability: (slotsCount: number) => {
    trackEvent('update_availability', 'profile', 'tutor', slotsCount);
  },

  // Navigation events
  navigateToPage: (page: string) => {
    trackEvent('page_view', 'navigation', page);
  },
  
  clickQuickAction: (action: string) => {
    trackEvent('click_quick_action', 'navigation', action);
  },

  // Search and discovery
  searchClasses: (query: string, resultsCount: number) => {
    trackEvent('search_classes', 'discovery', query, resultsCount);
  },
  
  viewClassDetails: (classTitle: string, subject: string) => {
    trackEvent('view_class_details', 'discovery', `${subject}_${classTitle}`);
  },
  
  filterClasses: (filterType: string, filterValue: string) => {
    trackEvent('filter_classes', 'discovery', `${filterType}_${filterValue}`);
  },

  // Error tracking
  trackError: (errorType: string, errorMessage: string, page?: string) => {
    trackEvent('error', 'system', `${errorType}_${page || 'unknown'}`, 1);
    console.error(`Analytics Error: ${errorType} - ${errorMessage}`);
  },

  // Performance tracking
  trackPageLoad: (page: string, loadTime: number) => {
    trackEvent('page_load_time', 'performance', page, Math.round(loadTime));
  },

  // Feature usage
  useFeature: (feature: string, userType: 'TUTOR' | 'STUDENT') => {
    trackEvent('use_feature', 'feature_usage', `${feature}_${userType}`);
  },
};

// Conversion tracking
export const trackConversion = {
  // Booking conversion
  bookingCompleted: (classTitle: string, amount: number) => {
    trackEvent('purchase', 'ecommerce', classTitle, amount);
  },
  
  // Session completion
  sessionCompleted: (classTitle: string, duration: number) => {
    trackEvent('session_completed', 'conversion', classTitle, duration);
  },
  
  // Profile completion
  profileCompleted: (userType: 'TUTOR' | 'STUDENT', completionPercentage: number) => {
    trackEvent('profile_completed', 'conversion', userType, completionPercentage);
  },
};

// User properties tracking
export const setUserProperties = (properties: {
  userType?: 'TUTOR' | 'STUDENT';
  subscriptionTier?: string;
  joinDate?: string;
  totalSessions?: number;
  totalBookings?: number;
}) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', GA_MEASUREMENT_ID, {
      custom_map: {
        'user_type': 'user_type',
        'subscription_tier': 'subscription_tier',
        'join_date': 'join_date',
        'total_sessions': 'total_sessions',
        'total_bookings': 'total_bookings',
      },
      user_type: properties.userType,
      subscription_tier: properties.subscriptionTier,
      join_date: properties.joinDate,
      total_sessions: properties.totalSessions,
      total_bookings: properties.totalBookings,
    });
  }
};

// Session tracking
export const trackSessionStart = (userType: 'TUTOR' | 'STUDENT') => {
  trackEvent('session_start', 'engagement', userType);
};

export const trackSessionEnd = (duration: number, userType: 'TUTOR' | 'STUDENT') => {
  trackEvent('session_end', 'engagement', userType, duration);
};

// Export default tracking object
export default {
  initGA,
  trackPageView,
  trackEvent,
  trackUserEngagement,
  trackConversion,
  setUserProperties,
  trackSessionStart,
  trackSessionEnd,
}; 