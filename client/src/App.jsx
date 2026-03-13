import { Routes, Route, Navigate } from 'react-router-dom';
import AppGate from './components/AppGate';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import ExpenseNew from './pages/ExpenseNew';
import DocumentList from './pages/DocumentList';
import ImportCsv from './pages/ImportCsv';
import DocumentDetail from './pages/DocumentDetail';
import ApprovalList from './pages/ApprovalList';
import ApprovalProcessing from './pages/ApprovalProcessing';
import ExpenseList from './pages/ExpenseList';
import DashboardDetail from './pages/DashboardDetail';
import Masters from './pages/Masters';
import Settings from './pages/Settings';
import SettingsIntegrated from './pages/SettingsIntegrated';
import AdminCompany from './pages/admin/AdminCompany';
import AdminUsers from './pages/admin/AdminUsers';
import AdminRolePermissions from './pages/admin/AdminRolePermissions';
import AdminPermissions from './pages/admin/AdminPermissions';
import AdminApprovalSequence from './pages/admin/AdminApprovalSequence';
import AdminEditHistory from './pages/admin/AdminEditHistory';
import AdminCorporateCards from './pages/admin/AdminCorporateCards';
import MastersSuper from './pages/admin/MastersSuper';
import RolePermissionsSuper from './pages/admin/RolePermissionsSuper';
import AdminCompanySuper from './pages/admin/AdminCompanySuper';
import AdminSuper from './pages/admin/AdminSuper';
import CardSettlement from './pages/CardSettlement';
import CardManagement from './pages/CardManagement';
import Pricing from './pages/Pricing';
import Support from './pages/Support';
import ServiceIntro from './pages/ServiceIntro';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

const MENU_ROUTES = [
  { path: '/', element: <Dashboard /> },
  { path: '/dashboard/detail', element: <DashboardDetail /> },
  { path: '/expense/new', element: <ExpenseNew /> },
  { path: '/expense/:id/edit', element: <ExpenseNew /> },
  { path: '/expenses', element: <ExpenseList /> },
  { path: '/documents', element: <DocumentList /> },
  { path: '/documents/:id', element: <DocumentDetail /> },
  { path: '/import', element: <ImportCsv /> },
  { path: '/approval', element: <ApprovalList /> },
  { path: '/masters', element: <Masters /> },
  { path: '/settings', element: <Settings /> },
];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/" element={<AppGate />}>
        <Route index element={<ProtectedRoute path="/"><Dashboard /></ProtectedRoute>} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="service" element={<ServiceIntro />} />
        <Route path="support" element={<Support />} />
        <Route path="dashboard/detail" element={<ProtectedRoute path="/"><DashboardDetail /></ProtectedRoute>} />
        <Route path="expense/new" element={<ProtectedRoute path="/expense/new"><ExpenseNew /></ProtectedRoute>} />
        <Route path="expense/:id/edit" element={<ProtectedRoute path="/expense/new"><ExpenseNew /></ProtectedRoute>} />
        <Route path="expenses" element={<ProtectedRoute path="/expenses"><ExpenseList /></ProtectedRoute>} />
        <Route path="approval-processing" element={<ProtectedRoute path="/approval-processing"><ApprovalProcessing /></ProtectedRoute>} />
        <Route path="documents" element={<Navigate to="/approval-processing" replace />} />
        <Route path="documents/:id" element={<ProtectedRoute path="/approval-processing"><DocumentDetail /></ProtectedRoute>} />
        <Route path="import" element={<ProtectedRoute path="/import"><ImportCsv /></ProtectedRoute>} />
        <Route path="approval" element={<Navigate to="/approval-processing" replace />} />
        <Route path="card-management" element={<ProtectedRoute path="/card-management"><CardManagement /></ProtectedRoute>} />
        <Route path="card-settlement" element={<Navigate to="/card-management" replace />} />
        <Route path="masters" element={<ProtectedRoute path="/masters"><Masters /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute path="/settings"><ErrorBoundary><SettingsIntegrated /></ErrorBoundary></ProtectedRoute>} />
        <Route path="admin/company" element={<ProtectedRoute path="/admin/company"><AdminCompany /></ProtectedRoute>} />
        <Route path="admin/corporate-cards" element={<Navigate to="/card-management?tab=corporate" replace />} />
        <Route path="admin/super" element={<ProtectedRoute path="/admin/super" superOnly><ErrorBoundary><AdminSuper /></ErrorBoundary></ProtectedRoute>} />
        <Route path="admin/masters-super" element={<Navigate to="/admin/super" replace />} />
        <Route path="admin/role-permissions-super" element={<Navigate to="/admin/super" replace />} />
        <Route path="admin/company-super" element={<Navigate to="/admin/super" replace />} />
        <Route path="admin/permissions" element={<ProtectedRoute path="/admin/permissions"><ErrorBoundary><AdminPermissions /></ErrorBoundary></ProtectedRoute>} />
        <Route path="admin/users" element={<Navigate to="/admin/permissions" replace />} />
        <Route path="admin/role-permissions" element={<Navigate to="/admin/permissions" replace />} />
        <Route path="admin/approval-sequence" element={<ProtectedRoute path="/admin/approval-sequence"><ErrorBoundary><AdminApprovalSequence /></ErrorBoundary></ProtectedRoute>} />
        <Route path="admin/edit-history" element={<ProtectedRoute path="/admin/edit-history"><AdminEditHistory /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
