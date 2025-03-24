
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SettingsProvider } from "@/contexts/SettingsContext";

const Index = lazy(() => import("@/pages/Index"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function App() {
  return (
    <BrowserRouter>
      <SettingsProvider>
        <Suspense fallback={<div className="flex items-center justify-center h-screen">Chargement...</div>}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </SettingsProvider>
    </BrowserRouter>
  );
}

export default App;
