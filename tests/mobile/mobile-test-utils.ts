/**
 * Mobile Testing Utilities for Koveo Gestion Property Management Platform
 * 
 * This module provides comprehensive utilities for testing mobile experiences,
 * including viewport management, touch simulation, and mobile-specific assertions.
 */

import { fireEvent } from '@testing-library/react';

// Common mobile device configurations
export const MOBILE_DEVICES = {
  iphone_se: { width: 375, height: 667, userAgent: 'iPhone SE' },
  iphone_12: { width: 390, height: 844, userAgent: 'iPhone 12' },
  iphone_12_pro_max: { width: 428, height: 926, userAgent: 'iPhone 12 Pro Max' },
  pixel_5: { width: 393, height: 851, userAgent: 'Pixel 5' },
  samsung_galaxy_s21: { width: 384, height: 854, userAgent: 'Samsung Galaxy S21' },
  ipad: { width: 768, height: 1024, userAgent: 'iPad' },
  ipad_pro: { width: 1024, height: 1366, userAgent: 'iPad Pro' },
} as const;

export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1440,
} as const;

/**
 * Sets up mobile viewport for testing
 */
export const mockMobileViewport = (device: keyof typeof MOBILE_DEVICES) => {
  const { width, height, userAgent } = MOBILE_DEVICES[device];
  
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  
  Object.defineProperty(navigator, 'userAgent', {
    writable: true,
    configurable: true,
    value: userAgent,
  });
  
  window.dispatchEvent(new Event('resize'));
};

/**
 * Simulates touch events for mobile interaction testing
 */
export const touchEvents = {
  /**
   * Simulates a tap gesture
   */
  tap: (element: Element, coordinates?: { x: number; y: number }) => {
    const { x = 0, y = 0 } = coordinates || {};
    
    fireEvent.touchStart(element, {
      touches: [{ clientX: x, clientY: y }],
    });
    
    fireEvent.touchEnd(element, {
      changedTouches: [{ clientX: x, clientY: y }],
    });
  },
  
  /**
   * Simulates a long press gesture
   */
  longPress: async (element: Element, duration = 500) => {
    fireEvent.touchStart(element);
    
    await new Promise(resolve => setTimeout(resolve, duration));
    
    fireEvent.touchEnd(element);
  },
  
  /**
   * Simulates a swipe gesture
   */
  swipe: (
    element: Element, 
    direction: 'left' | 'right' | 'up' | 'down',
    distance = 100
  ) => {
    const startCoords = { x: 100, y: 100 };
    const endCoords = { ...startCoords };
    
    switch (direction) {
      case 'left':
        endCoords.x -= distance;
        break;
      case 'right':
        endCoords.x += distance;
        break;
      case 'up':
        endCoords.y -= distance;
        break;
      case 'down':
        endCoords.y += distance;
        break;
    }
    
    fireEvent.touchStart(element, {
      touches: [startCoords],
    });
    
    fireEvent.touchMove(element, {
      touches: [endCoords],
    });
    
    fireEvent.touchEnd(element, {
      changedTouches: [endCoords],
    });
  },
  
  /**
   * Simulates pinch-to-zoom gesture
   */
  pinch: (element: Element, scale: number) => {
    const center = { x: 150, y: 150 };
    const distance = 50;
    
    const touch1 = { x: center.x - distance, y: center.y };
    const touch2 = { x: center.x + distance, y: center.y };
    
    // Start pinch
    fireEvent.touchStart(element, {
      touches: [touch1, touch2],
    });
    
    // Move touches based on scale
    const newDistance = distance * scale;
    const newTouch1 = { x: center.x - newDistance, y: center.y };
    const newTouch2 = { x: center.x + newDistance, y: center.y };
    
    fireEvent.touchMove(element, {
      touches: [newTouch1, newTouch2],
    });
    
    fireEvent.touchEnd(element, {
      changedTouches: [newTouch1, newTouch2],
    });
  },
};

/**
 * Orientation utilities for mobile testing
 */
export const orientation = {
  /**
   * Sets device to portrait mode
   */
  portrait: (device: keyof typeof MOBILE_DEVICES) => {
    const { width, height } = MOBILE_DEVICES[device];
    
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: Math.min(width, height),
    });
    
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: Math.max(width, height),
    });
    
    Object.defineProperty(screen, 'orientation', {
      writable: true,
      configurable: true,
      value: { angle: 0, type: 'portrait-primary' },
    });
    
    window.dispatchEvent(new Event('orientationchange'));
  },
  
  /**
   * Sets device to landscape mode
   */
  landscape: (device: keyof typeof MOBILE_DEVICES) => {
    const { width, height } = MOBILE_DEVICES[device];
    
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: Math.max(width, height),
    });
    
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: Math.min(width, height),
    });
    
    Object.defineProperty(screen, 'orientation', {
      writable: true,
      configurable: true,
      value: { angle: 90, type: 'landscape-primary' },
    });
    
    window.dispatchEvent(new Event('orientationchange'));
  },
};

/**
 * Network condition simulation for mobile testing
 */
export const networkConditions = {
  /**
   * Simulates slow 3G connection
   */
  slow3G: () => {
    Object.defineProperty(navigator, 'connection', {
      writable: true,
      configurable: true,
      value: {
        effectiveType: '3g',
        downlink: 1.5,
        rtt: 300,
        saveData: false,
      },
    });
  },
  
  /**
   * Simulates offline condition
   */
  offline: () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: false,
    });
    
    window.dispatchEvent(new Event('offline'));
  },
  
  /**
   * Simulates online condition
   */
  online: () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: true,
    });
    
    window.dispatchEvent(new Event('online'));
  },
};

/**
 * Mobile-specific accessibility helpers
 */
export const accessibility = {
  /**
   * Checks if touch targets meet minimum size requirements (44px)
   */
  hasAdequateTouchTarget: (element: Element): boolean => {
    const computedStyle = window.getComputedStyle(element);
    const minHeight = parseInt(computedStyle.minHeight) || parseInt(computedStyle.height);
    const minWidth = parseInt(computedStyle.minWidth) || parseInt(computedStyle.width);
    
    return minHeight >= 44 && minWidth >= 44;
  },
  
  /**
   * Simulates screen reader navigation
   */
  simulateScreenReader: {
    next: () => {
      fireEvent.keyDown(document.activeElement || document.body, {
        key: 'ArrowDown',
        code: 'ArrowDown',
      });
    },
    
    previous: () => {
      fireEvent.keyDown(document.activeElement || document.body, {
        key: 'ArrowUp',
        code: 'ArrowUp',
      });
    },
    
    activate: () => {
      fireEvent.keyDown(document.activeElement || document.body, {
        key: 'Enter',
        code: 'Enter',
      });
    },
  },
};

/**
 * Performance testing utilities for mobile
 */
export const performance = {
  /**
   * Simulates slow CPU performance
   */
  simulateSlowCPU: () => {
    const originalSetTimeout = window.setTimeout;
    
    window.setTimeout = ((callback: Function, delay: number = 0) => {
      return originalSetTimeout(callback, delay * 4); // 4x slower
    }) as any;
  },
  
  /**
   * Measures component render time
   */
  measureRenderTime: async (renderFn: () => void): Promise<number> => {
    const start = performance.now();
    renderFn();
    await new Promise(resolve => setTimeout(resolve, 0)); // Wait for next tick
    const end = performance.now();
    
    return end - start;
  },
};

/**
 * Mobile form testing utilities
 */
export const forms = {
  /**
   * Simulates mobile keyboard appearance
   */
  showKeyboard: (inputElement: Element) => {
    const viewport = window.innerHeight;
    
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: viewport * 0.6, // Keyboard typically takes ~40% of screen
    });
    
    window.dispatchEvent(new Event('resize'));
    
    // Focus the input
    fireEvent.focus(inputElement);
  },
  
  /**
   * Simulates mobile keyboard hiding
   */
  hideKeyboard: () => {
    const device = MOBILE_DEVICES.iphone_12; // Default device
    
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: device.height,
    });
    
    window.dispatchEvent(new Event('resize'));
    
    // Blur active element
    if (document.activeElement) {
      fireEvent.blur(document.activeElement);
    }
  },
};

/**
 * Property management specific mobile test helpers
 */
export const propertyManagement = {
  /**
   * Simulates maintenance request creation flow on mobile
   */
  createMaintenanceRequest: async (
    propertySelect: Element,
    descriptionInput: Element,
    submitButton: Element
  ) => {
    // Select property
    touchEvents.tap(propertySelect);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Fill description
    fireEvent.change(descriptionInput, {
      target: { value: 'Leaky faucet in unit 4B bathroom' }
    });
    
    // Submit form
    touchEvents.tap(submitButton);
  },
  
  /**
   * Simulates resident communication flow
   */
  sendResidentMessage: async (
    recipientSelect: Element,
    messageInput: Element,
    sendButton: Element
  ) => {
    touchEvents.tap(recipientSelect);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    fireEvent.change(messageInput, {
      target: { value: 'Monthly maintenance reminder for your unit' }
    });
    
    touchEvents.tap(sendButton);
  },
};

// Export commonly used device configurations
export const commonDevices = {
  mobile: () => mockMobileViewport('iphone_12'),
  tablet: () => mockMobileViewport('ipad'),
  largeMobile: () => mockMobileViewport('iphone_12_pro_max'),
} as const;