import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/auth/LoginPage';
import UnauthorizedPage from './pages/auth/UnauthorizedPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import InventarioPage from './pages/inventario/InventarioPage';
import ClientesPage from './pages/clientes/ClientesPage';
import InmobiliariasPage from './pages/inmobiliarias/InmobiliariasPage';
import UsuariosSistemaPage from './pages/sistema/UsuariosSistemaPage';
import ReportesPage from './pages/reportes/ReportesPage';
import ProcesosPage from './pages/procesos/ProcesosPage';
import CapturaPage from './pages/captura/CapturaPage';
import CapturaGlobalPage from './pages/captura/CapturaGlobalPage';
import MfaSetupPage from './pages/auth/MfaSetupPage';
import MigracionPage from './pages/migracion/MigracionPage';
import ConfigPage from './pages/config/ConfigPage';
import CampaniasPage from './pages/campanias/CampaniasPage';
import InventarioPublicoPage from './pages/inventario/InventarioPublicoPage';
import TareasPage from './pages/tareas/TareasPage';
import MetaCompliancePages from './pages/meta/MetaCompliancePages';
import MetaFacebookCallbackPage from './pages/meta/MetaFacebookCallbackPage';
import MetaInboxPage from './pages/meta/MetaInboxPage';
import MetaLeadsPage from './pages/meta/MetaLeadsPage';
import MetaFormsPage from './pages/meta/MetaFormsPage';

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="/captura" element={<CapturaPage />} />
        <Route path="/captura-global" element={<CapturaGlobalPage />} />
        <Route path="/inventario-publico/:proyectoId" element={<InventarioPublicoPage />} />
        <Route path="/mfa-setup" element={<MfaSetupPage />} />
        <Route path="/instagram/callback" element={<MetaCompliancePages />} />
        <Route path="/meta/facebook/callback" element={<MetaFacebookCallbackPage />} />
        <Route path="/instagram/auth/cancelled" element={<MetaCompliancePages />} />
        <Route path="/instagram/data-deletion" element={<MetaCompliancePages />} />
        <Route path="/privacidad" element={<MetaCompliancePages />} />
        <Route path="/politica-privacidad" element={<MetaCompliancePages />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="inventario" element={<InventarioPage />} />
          <Route
            path="clientes"
            element={
              <ProtectedRoute roles={['admin', 'coordinador', 'supervisor', 'inmobiliaria']}>
                <ClientesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="reportes"
            element={
              <ProtectedRoute roles={['admin', 'coordinador', 'supervisor']}>
                <ReportesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="inmobiliarias"
            element={
              <ProtectedRoute roles={['admin', 'coordinador']}>
                <InmobiliariasPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="procesos"
            element={
              <ProtectedRoute roles={['admin', 'coordinador', 'supervisor', 'inmobiliaria']}>
                <ProcesosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="sistema/usuarios"
            element={
              <ProtectedRoute roles={['admin', 'coordinador']}>
                <UsuariosSistemaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="migracion"
            element={
              <ProtectedRoute roles={['admin', 'coordinador']}>
                <MigracionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="config"
            element={
              <ProtectedRoute roles={['admin', 'coordinador']}>
                <ConfigPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="campanias"
            element={
              <ProtectedRoute roles={['admin', 'coordinador', 'supervisor']}>
                <CampaniasPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="meta-inbox"
            element={
              <ProtectedRoute roles={['admin', 'coordinador', 'supervisor']}>
                <MetaInboxPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="meta-leads"
            element={
              <ProtectedRoute roles={['admin', 'coordinador', 'supervisor']}>
                <MetaLeadsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="meta-formularios"
            element={
              <ProtectedRoute roles={['admin', 'coordinador', 'supervisor']}>
                <MetaFormsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="tareas"
            element={
              <ProtectedRoute roles={['admin', 'coordinador', 'supervisor']}>
                <TareasPage />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
