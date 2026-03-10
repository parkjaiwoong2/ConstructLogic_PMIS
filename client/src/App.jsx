import { Routes, Route, NavLink } from 'react-router-dom';
import Layout from './Layout';
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
import './App.css';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="dashboard/detail" element={<DashboardDetail />} />
        <Route path="expense/new" element={<ExpenseNew />} />
        <Route path="expense/:id/edit" element={<ExpenseNew />} />
        <Route path="expenses" element={<ExpenseList />} />
        <Route path="documents" element={<DocumentList />} />
        <Route path="documents/:id" element={<DocumentDetail />} />
        <Route path="import" element={<ImportCsv />} />
        <Route path="approval" element={<ApprovalList />} />
        <Route path="masters" element={<Masters />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
