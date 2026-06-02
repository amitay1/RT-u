import React, { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { UIToaster } from "@/components/ui/toaster-wrapper";
import { SonnerToaster } from "@/components/ui/sonner-toaster";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { SavedCardsProvider } from "@/contexts/SavedCardsContext";
import { InspectorProfileProvider } from "@/contexts/InspectorProfileContext";
import { LicenseProvider, useLicense } from "@/contexts/LicenseContext";
import { SettingsSync } from "@/components/SettingsSync";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { UpdateNotification } from "@/components/UpdateNotification";
import { GlobalErrorBoundary, RecoveryProvider } from "@/components/ErrorBoundary";
import { crashReporter } from "@/lib/crashReporter";
import { FirstRunWizard } from "./components/wizard/FirstRunWizard";
import { useFirstRun } from "./hooks/useFirstRun";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Standards from "./pages/Standards";
import MyStandards from "./pages/MyStandards";
import NotFound from "./pages/NotFound";
import { GaugeDemo } from "./pages/GaugeDemo";
import TechnicalDrawingTest from "./pages/TechnicalDrawingTest";
import BlockDesigner from "./pages/BlockDesigner";
import LicenseDashboard from "./pages/LicenseDashboard";
import RingSegmentReferenceTest from "./pages/RingSegmentReferenceTest";
import SplashScreenDemo from "./demos/splash-screens/SplashScreenDemo";

const queryClient = new QueryClient();

// Initialize crash reporter early
crashReporter.initialize();

// Secret keyboard shortcut component for admin access
const AdminShortcut = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+Alt+L opens License Dashboard
      if (e.ctrlKey && e.shiftKey && e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        navigate('/license-dashboard');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);
  
  return null;
};

const AppContent = () => {
  const { isOffline } = useServiceWorker();
  const { isElectron } = useLicense();
  const { isFirstRun, isLoading: firstRunLoading, completeFirstRun } = useFirstRun();
  const [showFirstRunWizard, setShowFirstRunWizard] = useState(false);

  useEffect(() => {
    if (isOffline) {
      console.log('App is offline - using cached data');
    }
  }, [isOffline]);

  // Show first run wizard after splash screen - TEMPORARILY DISABLED
  // useEffect(() => {
  //   if (!showSplash && !firstRunLoading && isFirstRun) {
  //     setShowFirstRunWizard(true);
  //   }
  // }, [showSplash, firstRunLoading, isFirstRun]);

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

  const handleFirstRunComplete = (data: Parameters<typeof completeFirstRun>[0]) => {
    completeFirstRun(data);
    setShowFirstRunWizard(false);
  };

  const handleFirstRunSkip = () => {
    completeFirstRun({ skippedTutorial: true });
    setShowFirstRunWizard(false);
  };

  // No intro splash video — go straight into the app.

  // RT-PT Inspector is distributed free — no license gate.
  // (The license context is still mounted so any downstream code that
  // reads `useLicense().isElectron` keeps working without changes.)
  // Original license check kept for reference:
  //   if (isElectron && !licenseLoading) {
  //     if (!license || !license.activated || !license.valid) {
  //       return <LicenseActivationScreen />;
  //     }
  //   }

  return (
    <BrowserRouter>
      <AdminShortcut />
      {/* First Run Wizard */}
      <FirstRunWizard
        open={showFirstRunWizard}
        onComplete={handleFirstRunComplete}
        onSkip={handleFirstRunSkip}
      />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/standards" element={<Standards />} />
        <Route path="/my-standards" element={<MyStandards />} />
        <Route path="/gauge-demo" element={<GaugeDemo />} />
        <Route path="/drawing-test" element={<TechnicalDrawingTest />} />
        <Route path="/ring-segment-test" element={<RingSegmentReferenceTest />} />
        <Route path="/block-designer" element={<BlockDesigner />} />
        <Route path="/license-dashboard" element={<LicenseDashboard />} />
        <Route path="/splash-demo" element={<SplashScreenDemo />} />
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
      <LicenseProvider>
        <SettingsProvider>
          <SettingsSync />
          <SavedCardsProvider>
            <InspectorProfileProvider>
              <OrganizationProvider>
                <RecoveryProvider>
                  <AppContent />
                </RecoveryProvider>
              </OrganizationProvider>
            </InspectorProfileProvider>
          </SavedCardsProvider>
        </SettingsProvider>
      </LicenseProvider>
    </QueryClientProvider>
  </GlobalErrorBoundary>
);

export default App;
