import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import "./index.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

// Keep desktop density adjustments scoped to the Electron shell.
if (typeof window !== "undefined") {
  document.documentElement.classList.toggle("electron-ui", Boolean(window.electron));
}

createRoot(root).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
