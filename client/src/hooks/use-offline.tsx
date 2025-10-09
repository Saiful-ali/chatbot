import { useState, useEffect } from "react";

interface UseOfflineReturn {
  isOffline: boolean;
  isOnline: boolean;
  toggleMode: () => void;
}

export function useOffline(): UseOfflineReturn {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      console.log("Network: Back online - syncing data...");
      
      // Dispatch custom event for components that need to sync data
      window.dispatchEvent(new CustomEvent("network-online"));
    };

    const handleOffline = () => {
      setIsOffline(true);
      console.log("Network: Gone offline - using cached data...");
      
      // Dispatch custom event for components that need to handle offline mode
      window.dispatchEvent(new CustomEvent("network-offline"));
    };

    // Add event listeners
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Set initial state
    setIsOffline(!navigator.onLine);

    // Cleanup event listeners
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Manual toggle for testing purposes
  const toggleMode = () => {
    setIsOffline(!isOffline);
  };

  return {
    isOffline,
    isOnline: !isOffline,
    toggleMode
  };
}

// Hook for components that need to handle cache management
export function useOfflineCache() {
  const { isOffline, isOnline } = useOffline();

  const cacheData = (key: string, data: any) => {
    if (typeof Storage !== "undefined") {
      try {
        const cacheEntry = {
          data,
          timestamp: Date.now(),
          version: "1.0"
        };
        localStorage.setItem(`healthbot_cache_${key}`, JSON.stringify(cacheEntry));
      } catch (error) {
        console.error("Failed to cache data:", error);
      }
    }
  };

  const getCachedData = (key: string) => {
    if (typeof Storage !== "undefined") {
      try {
        const cached = localStorage.getItem(`healthbot_cache_${key}`);
        if (cached) {
          const cacheEntry = JSON.parse(cached);
          
          // Check if cache is less than 24 hours old
          const maxAge = 24 * 60 * 60 * 1000; // 24 hours
          if (Date.now() - cacheEntry.timestamp < maxAge) {
            return cacheEntry.data;
          }
        }
      } catch (error) {
        console.error("Failed to retrieve cached data:", error);
      }
    }
    return null;
  };

  const clearCache = (key?: string) => {
    if (typeof Storage !== "undefined") {
      try {
        if (key) {
          localStorage.removeItem(`healthbot_cache_${key}`);
        } else {
          // Clear all health bot cache entries
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("healthbot_cache_")) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
        }
      } catch (error) {
        console.error("Failed to clear cache:", error);
      }
    }
  };

  const getCacheSize = () => {
    if (typeof Storage !== "undefined") {
      let totalSize = 0;
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("healthbot_cache_")) {
            const value = localStorage.getItem(key);
            if (value) {
              totalSize += key.length + value.length;
            }
          }
        }
      } catch (error) {
        console.error("Failed to calculate cache size:", error);
      }
      return totalSize;
    }
    return 0;
  };

  return {
    isOffline,
    isOnline,
    cacheData,
    getCachedData,
    clearCache,
    getCacheSize
  };
}
