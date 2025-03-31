import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import PlayerStats from "@/pages/player-stats";
import TrainingPage from "@/pages/training";
import SettingsPage from "@/pages/settings";
import LoginPage from "@/pages/login";
import Layout from "@/components/layout";
import { AuthProvider } from "./lib/auth-context";
import ProtectedRoute from "./lib/protected-route";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/player-stats">
        <ProtectedRoute>
          <PlayerStats />
        </ProtectedRoute>
      </Route>
      <Route path="/training">
        <ProtectedRoute>
          <TrainingPage />
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute>
          <SettingsPage />
        </ProtectedRoute>
      </Route>
      {/* Fallback to 404 */}
      <Route>
        <ProtectedRoute>
          <NotFound />
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Layout>
          <Router />
        </Layout>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
