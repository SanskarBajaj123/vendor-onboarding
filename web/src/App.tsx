import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { ProtectedRoute, CenteredMessage } from "./components/ProtectedRoute";
import { AuthPage } from "./pages/AuthPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { VerifyPage } from "./pages/VerifyPage";
import { EmployeeDashboardPage } from "./pages/EmployeeDashboardPage";
import { EmployeeVendorDetailPage } from "./pages/EmployeeVendorDetailPage";

function Root() {
  const { session, role, loading } = useAuth();
  if (loading) return <CenteredMessage>Loading…</CenteredMessage>;
  if (!session) return <AuthPage />;
  // Keep showing AuthPage during the signup onboarding step so the vendor
  // form renders on the same page immediately after account creation.
  if (sessionStorage.getItem("new_signup") === "1") return <AuthPage />;
  if (role === "employee") return <Navigate to="/employee" replace />;
  return <Navigate to="/vendor" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Root />} />
      <Route path="/verify/:token" element={<VerifyPage />} />
      <Route
        path="/vendor"
        element={
          <ProtectedRoute requireRole="vendor">
            <OnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employee"
        element={
          <ProtectedRoute requireRole="employee">
            <EmployeeDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employee/:vendorId"
        element={
          <ProtectedRoute requireRole="employee">
            <EmployeeVendorDetailPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
