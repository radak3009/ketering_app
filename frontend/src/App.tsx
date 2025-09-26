import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import MenuPage from './pages/Menu';
import CartPage from './pages/Cart';
import OrdersPage from './pages/Orders';
import AdminDashboard from './pages/AdminDashboard';
import LoginPage from './pages/Login';

export default function App() {
  return (
    <BrowserRouter>
      <nav style={{ padding: 12, background: 'var(--primary, #2b6cb0)', color: '#fff' }}>
        <Link to="/">Meni</Link> | <Link to="/cart">Korpa</Link> | <Link to="/orders">Moje porudžbine</Link> | <Link to="/admin">Admin</Link>
      </nav>
      <div style={{ padding: 16 }}>
        <Routes>
          <Route path="/" element={<MenuPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
