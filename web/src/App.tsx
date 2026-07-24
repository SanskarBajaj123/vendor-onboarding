import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { ProtectedRoute, CenteredMessage } from "./components/ProtectedRoute";
import { AuthPage } from "./pages/AuthPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { VerifyPage } from "./pages/VerifyPage";
import { EmployeeDashboardPage } from "./pages/EmployeeDashboardPage";
import { EmployeeVendorDetailPage } from "./pages/EmployeeVendorDetailPage";
import { ProcessLogsPage } from "./pages/ProcessLogsPage";

function Root() {
  const { session, role, loading } = useAuth();
  // During signup the user is mid-flow inside AuthPage (step 2: vendor form).
  // Check this FIRST so AuthPage is never unmounted by a loading/role change —
  // onAuthStateChange fires during signUp() and would otherwise briefly flip to
  // <CenteredMessage>, destroying view="signup-step2" state and resetting to signin.
  if (sessionStorage.getItem("new_signup") === "1") return <AuthPage />;
  // Wait until both session AND role are resolved — role loads async after
  // session, so without this check an employee briefly redirects to /vendor.
  if (loading || (session !== null && role === null)) return <CenteredMessage>Loading…</CenteredMessage>;
  if (!session) return <AuthPage />;
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
      <Route
        path="/logs"
        element={
          <ProtectedRoute requireRole="employee">
            <ProcessLogsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
