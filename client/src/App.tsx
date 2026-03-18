import { Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import VerifyPage from "./pages/VerifyPage";
import OtpPage from "./pages/OtpPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import SuccessPage from "./pages/SuccessPage";
import AuthenticatorPage from "./pages/AuthenticatorPage";
import AuditLogPage from "./pages/AuditLogPage";

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/verify" element={<VerifyPage />} />
      <Route path="/otp" element={<OtpPage />} />
      <Route path="/reset" element={<ResetPasswordPage />} />
      <Route path="/success" element={<SuccessPage />} />
      <Route path="/authenticator" element={<AuthenticatorPage />} />
      <Route path="/audit" element={<AuditLogPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
