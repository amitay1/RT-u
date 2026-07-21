import { useEffect, useState, useCallback, useRef } from 'react';

export const useServiceWorker = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateInProgress, setUpdateInProgress] = useState(false);

  // Store refs to event handlers for cleanup
  const updateFoundHandlerRef = useRef<(() => void) | null>(null);
  const messageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const reloadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;
    const isLocalRuntime =
      window.location.protocol === 'file:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '[::1]';

    if ('serviceWorker' in navigator) {
      if (import.meta.env.PROD && !isLocalRuntime) {
        // Define message handler
        const messageHandler = (event: MessageEvent) => {
          if (event.data && event.data.type === 'SYNC_COMPLETE') {
            console.log(`Sync complete: ${event.data.successful} successful, ${event.data.failed} failed`);
          }
        };
        messageHandlerRef.current = messageHandler;
        navigator.serviceWorker.addEventListener('message', messageHandler);

        // Use the advanced service worker for full PWA capabilities
        navigator.serviceWorker
          .register('/service-worker-advanced.js')
        .then((reg) => {
          if (!isMounted) return;

          setRegistration(reg);
          registrationRef.current = reg;
          console.log('Service Worker registered successfully');

          // Define update handler
          const updateFoundHandler = () => {
            const newWorker = reg.installing;
            if (newWorker) {
              const stateChangeHandler = () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  if (isMounted) {
                    setIsUpdateAvailable(true);
                  }
                }
              };
              newWorker.addEventListener('statechange', stateChangeHandler);
            }
          };
          updateFoundHandlerRef.current = updateFoundHandler;
          reg.addEventListener('updatefound', updateFoundHandler);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
      } else {
        // In development, unregister any existing service workers and clear caches
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            console.log('Unregistering service worker for development');
            registration.unregister();
          });
        });

        // Clear all caches in development
        if ('caches' in window) {
          caches.keys().then((cacheNames) => {
            cacheNames.forEach((cacheName) => {
              console.log('Clearing cache:', cacheName);
              caches.delete(cacheName);
            });
          });
        }
      }
    }

    // Listen for online/offline events
    const handleOnline = () => {
      if (isMounted) setIsOffline(false);
    };
    const handleOffline = () => {
      if (isMounted) setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      // Clean up service worker event listeners
      if (messageHandlerRef.current && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', messageHandlerRef.current);
      }
      if (updateFoundHandlerRef.current && registrationRef.current) {
        registrationRef.current.removeEventListener('updatefound', updateFoundHandlerRef.current);
      }
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
      }
    };
  }, []);

  const updateServiceWorker = useCallback(() => {
    if (registration && registration.waiting && !updateInProgress) {
      // Mark update as in progress to prevent duplicate calls
      setUpdateInProgress(true);
      
      // Tell SW to skip waiting
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Clear the update available flag immediately to prevent re-triggering
      setIsUpdateAvailable(false);
      
      // Reload once the new service worker is active
      const handleControllerChange = () => {
        window.location.reload();
      };
      
      // Use once: true to ensure single execution
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange, { once: true });
      
      // Fallback reload after 3 seconds if controllerchange doesn't fire
      reloadTimeoutRef.current = setTimeout(() => {
        window.location.reload();
      }, 3000);
    }
  }, [registration, updateInProgress]);

  const clearCache = async (): Promise<boolean> => {
    const controller = 'serviceWorker' in navigator
      ? navigator.serviceWorker.controller
      : null;
    if (controller) {
      const messageChannel = new MessageChannel();
      
      return new Promise<boolean>((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          if (event.data && event.data.cleared) {
            resolve(true);
          }
        };

        controller.postMessage(
          { type: 'CLEAR_CACHE' },
          [messageChannel.port2]
        );
      });
    }
    return false;
  };

  return {
    isOffline,
    isUpdateAvailable,
    updateServiceWorker,
    clearCache,
    registration,
  };
};
