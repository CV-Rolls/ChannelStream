import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const Home     = lazy(() => import("./pages/Home"));
const Player   = lazy(() => import("./pages/Player"));
const Guide    = lazy(() => import("./pages/Guide"));
const Sports   = lazy(() => import("./pages/Sports"));
const NotFound = lazy(() => import("./pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    },
  },
});

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    }>
      {children}
    </Suspense>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/"          component={() => <PageShell><Home /></PageShell>} />
      <Route path="/play/:id"  component={() => <PageShell><Player /></PageShell>} />
      <Route path="/guide"     component={() => <PageShell><Guide /></PageShell>} />
      <Route path="/sports"    component={() => <PageShell><Sports /></PageShell>} />
      <Route                   component={() => <PageShell><NotFound /></PageShell>} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
