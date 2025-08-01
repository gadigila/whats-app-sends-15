
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';

// Regular imports instead of lazy loading
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import WhatsAppConnect from "./pages/WhatsAppConnect";
import MessageComposer from "./pages/MessageComposer";
import ScheduledMessages from "./pages/ScheduledMessages";
import SentMessages from "./pages/SentMessages";
import Segments from "./pages/Segments";
import Billing from "./pages/Billing";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/connect" element={
            <ProtectedRoute>
              <WhatsAppConnect />
            </ProtectedRoute>
          } />
          <Route path="/compose" element={
            <ProtectedRoute>
              <MessageComposer />
            </ProtectedRoute>
          } />
          <Route path="/scheduled" element={
            <ProtectedRoute>
              <ScheduledMessages />
            </ProtectedRoute>
          } />
          <Route path="/sent" element={
            <ProtectedRoute>
              <SentMessages />
            </ProtectedRoute>
          } />
          <Route path="/segments" element={
            <ProtectedRoute>
              <Segments />
            </ProtectedRoute>
          } />
          <Route path="/billing" element={
            <ProtectedRoute>
              <Billing />
            </ProtectedRoute>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
