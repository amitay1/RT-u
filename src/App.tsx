import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { UIToaster } from "@/components/ui/toaster-wrapper";
import { SonnerToaster } from "@/components/ui/sonner-toaster";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { SavedCardsProvider } from "@/contexts/SavedCardsContext";
import { InspectorProfileProvider } from "@/contexts/InspectorProfileContext";
import { SettingsSync } from "@/components/SettingsSync";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { UpdateNotification } from "@/components/UpdateNotification";
import { GlobalErrorBoundary, RecoveryProvider } from "@/components/ErrorBoundary";
import { RtPtLicenseGate } from "@/components/rtpt/RtPtLicenseGate";
import { RtPtLicenseProvider } from "@/contexts/RtPtLicenseContext";
import { crashReporter } from "@/lib/crashReporter";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Initialize crash reporter early
crashReporter.initialize();

const AppContent = () => {
  const { isOffline } = useServiceWorker();
  const isElectron = typeof window !== "undefined" && Boolean(window.electron);

  useEffect(() => {
    if (isOffline) {
      console.log('App is offline - using cached data');
    }
  }, [isOffline]);

  // Add electron-app class to body when running in Electron for desktop-specific styles
  useEffect(() => {
    if (isElectron) {
      document.body.classList.add('electron-app');
      document.documentElement.classList.add('electron-app');
    }
    return () => {
      document.body.classList.remove('electron-app');
      document.documentElement.classList.remove('electron-app');
    };
  }, [isElectron]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <UIToaster />
      <SonnerToaster />
      <UpdateNotification />
    </BrowserRouter>
  );
};

const App = () => (
  <GlobalErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <SettingsSync />
        <RtPtLicenseProvider>
          <RtPtLicenseGate>
            <SavedCardsProvider>
              <InspectorProfileProvider>
                <RecoveryProvider>
                  <AppContent />
                </RecoveryProvider>
              </InspectorProfileProvider>
            </SavedCardsProvider>
          </RtPtLicenseGate>
        </RtPtLicenseProvider>
      </SettingsProvider>
    </QueryClientProvider>
  </GlobalErrorBoundary>
);

export default App;
