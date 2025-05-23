import { Route, Switch } from "wouter";
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
import { ROUTES } from "./routes";
import AIChat from "@/pages/ai-chat"; 
import AdminChat from "@/pages/admin-chat"; 
import StaffLeaderboard from "@/pages/staff-leaderboard"; 

function Router() {
  return (
    <Switch>
      <Route path={ROUTES.LOGIN} component={LoginPage} />
      <Route path={ROUTES.DASHBOARD}>
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path={ROUTES.PLAYER_STATS}>
        <ProtectedRoute>
          <PlayerStats />
        </ProtectedRoute>
      </Route>
      <Route path={ROUTES.TRAINING}>
        <ProtectedRoute>
          <TrainingPage />
        </ProtectedRoute>
      </Route>
      <Route path={ROUTES.SETTINGS}>
        <ProtectedRoute>
          <SettingsPage />
        </ProtectedRoute>
      </Route>
      <Route path={ROUTES.AI_CHAT}> 
        <ProtectedRoute>
          <AIChat />
        </ProtectedRoute>
      </Route>
      <Route path={ROUTES.ADMIN_CHAT}> 
        <ProtectedRoute>
          <AdminChat />
        </ProtectedRoute>
      </Route>
      <Route path={ROUTES.STAFF_LEADERBOARD}> 
        <ProtectedRoute>
          <StaffLeaderboard />
        </ProtectedRoute>
      </Route>
      <Route>
        <NotFound />
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