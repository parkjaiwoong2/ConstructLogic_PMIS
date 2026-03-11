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
import ExpenseList from './pages/ExpenseList';
import DashboardDetail from './pages/DashboardDetail';
import Masters from './pages/Masters';
import Settings from './pages/Settings';
import AdminCompany from './pages/admin/AdminCompany';
import AdminUsers from './pages/admin/AdminUsers';
import AdminRolePermissions from './pages/admin/AdminRolePermissions';
import AdminApprovalSequence from './pages/admin/AdminApprovalSequence';
import AdminEditHistory from './pages/admin/AdminEditHistory';
import CardSettlement from './pages/CardSettlement';
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
        <Route path="dashboard/detail" element={<ProtectedRoute path="/"><DashboardDetail /></ProtectedRoute>} />
        <Route path="expense/new" element={<ProtectedRoute path="/expense/new"><ExpenseNew /></ProtectedRoute>} />
        <Route path="expense/:id/edit" element={<ProtectedRoute path="/expense/new"><ExpenseNew /></ProtectedRoute>} />
        <Route path="expenses" element={<ProtectedRoute path="/expenses"><ExpenseList /></ProtectedRoute>} />
        <Route path="documents" element={<ProtectedRoute path="/documents"><DocumentList /></ProtectedRoute>} />
        <Route path="documents/:id" element={<ProtectedRoute path="/documents"><DocumentDetail /></ProtectedRoute>} />
        <Route path="import" element={<ProtectedRoute path="/import"><ImportCsv /></ProtectedRoute>} />
        <Route path="approval" element={<ProtectedRoute path="/approval"><ApprovalList /></ProtectedRoute>} />
        <Route path="card-settlement" element={<ProtectedRoute path="/card-settlement"><CardSettlement /></ProtectedRoute>} />
        <Route path="masters" element={<ProtectedRoute path="/masters"><Masters /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute path="/settings"><Settings /></ProtectedRoute>} />
        <Route path="admin/company" element={<ProtectedRoute path="/admin/company"><AdminCompany /></ProtectedRoute>} />
        <Route path="admin/users" element={<ProtectedRoute path="/admin/users"><ErrorBoundary><AdminUsers /></ErrorBoundary></ProtectedRoute>} />
        <Route path="admin/role-permissions" element={<ProtectedRoute path="/admin/role-permissions"><AdminRolePermissions /></ProtectedRoute>} />
        <Route path="admin/approval-sequence" element={<ProtectedRoute path="/admin/approval-sequence"><AdminApprovalSequence /></ProtectedRoute>} />
        <Route path="admin/edit-history" element={<ProtectedRoute path="/admin/edit-history"><AdminEditHistory /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
