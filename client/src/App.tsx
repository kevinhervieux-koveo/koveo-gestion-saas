import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/hooks/use-language";
import { Sidebar } from "@/components/layout/sidebar";

// Owner pages
import OwnerDashboard from "@/pages/owner/dashboard";
import OwnerPillars from "@/pages/owner/pillars";
import OwnerQuality from "@/pages/owner/quality";
import OwnerSuggestions from "@/pages/owner/suggestions";

// Manager pages
import ManagerBuildings from "@/pages/manager/buildings";
import ManagerResidences from "@/pages/manager/residences";
import ManagerBudget from "@/pages/manager/budget";
import ManagerBills from "@/pages/manager/bills";
import ManagerDemands from "@/pages/manager/demands";

// Residents pages
import ResidentsResidence from "@/pages/residents/residence";
import ResidentsBuilding from "@/pages/residents/building";
import ResidentsDemands from "@/pages/residents/demands";

// Settings pages
import SettingsSettings from "@/pages/settings/settings";
import SettingsBugReports from "@/pages/settings/bug-reports";
import SettingsIdeaBox from "@/pages/settings/idea-box";

// Legacy pages
import PillarsPage from "@/pages/pillars";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      {/* Default route - redirect to owner dashboard */}
      <Route path="/" component={OwnerDashboard} />
      
      {/* Owner routes */}
      <Route path="/owner/dashboard" component={OwnerDashboard} />
      <Route path="/owner/pillars" component={OwnerPillars} />
      <Route path="/owner/quality" component={OwnerQuality} />
      <Route path="/owner/suggestions" component={OwnerSuggestions} />
      
      {/* Manager routes */}
      <Route path="/manager/buildings" component={ManagerBuildings} />
      <Route path="/manager/residences" component={ManagerResidences} />
      <Route path="/manager/budget" component={ManagerBudget} />
      <Route path="/manager/bills" component={ManagerBills} />
      <Route path="/manager/demands" component={ManagerDemands} />
      
      {/* Residents routes */}
      <Route path="/residents/residence" component={ResidentsResidence} />
      <Route path="/residents/building" component={ResidentsBuilding} />
      <Route path="/residents/demands" component={ResidentsDemands} />
      
      {/* Settings routes */}
      <Route path="/settings/settings" component={SettingsSettings} />
      <Route path="/settings/bug-reports" component={SettingsBugReports} />
      <Route path="/settings/idea-box" component={SettingsIdeaBox} />
      
      {/* Legacy routes */}
      <Route path="/pillars" component={PillarsPage} />
      
      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <div className="h-full flex bg-gray-50 font-inter">
            <Sidebar />
            <Router />
          </div>
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
