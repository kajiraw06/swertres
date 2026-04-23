import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const S = {
  nav: {
    background: 'linear-gradient(90deg, #060b1f 0%, #0d1a4a 60%, #0f2060 100%)',
    color: '#fff',
    padding: '0 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 64,
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: '0 2px 16px rgba(0,0,0,0.45)',
    borderBottom: '1px solid rgba(251,191,36,0.12)',
  },
  brand: {
    fontWeight: 900,
    fontSize: 22,
    letterSpacing: 1.5,
    color: '#fbbf24',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    textShadow: '0 0 20px rgba(251,191,36,0.4)',
  },
  link: {
    color: 'rgba(255,255,255,0.7)',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 600,
    padding: '7px 11px',
    borderRadius: 8,
    transition: 'color 0.15s, background 0.15s',
    letterSpacing: 0.2,
  },
  activeLink: {
    color: '#fbbf24',
    background: 'rgba(251,191,36,0.1)',
  },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid rgba(251,191,36,0.35)',
    color: '#fbbf24',
    borderRadius: 8,
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    transition: 'background 0.15s',
    fontFamily: 'inherit',
  },
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/login'); setMenuOpen(false); };
  const linkStyle = ({ isActive }) => ({ ...S.link, ...(isActive ? S.activeLink : {}) });
  const mobileLinkStyle = ({ isActive }) => ({
    ...S.link,
    ...(isActive ? S.activeLink : {}),
    display: 'block',
    padding: '11px 14px',
    fontSize: 15,
  });

  const links = (
    <>
      <NavLink to="/"        style={linkStyle} end>Home</NavLink>
      <NavLink to="/bet"     style={linkStyle}>Bet</NavLink>
      <NavLink to="/my-bets" style={linkStyle}>My Bets</NavLink>
      <NavLink to="/results" style={linkStyle}>Results</NavLink>
      <NavLink to="/wallet"  style={linkStyle}>Wallet</NavLink>
      <NavLink to="/profile" style={linkStyle}>Profile</NavLink>
      {user?.role === 'admin' && <NavLink to="/admin" style={linkStyle}>Admin</NavLink>}
      <button style={S.logoutBtn} onClick={handleLogout}>Logout</button>
    </>
  );

  const mobileLinks = (
    <>
      <NavLink to="/"        style={mobileLinkStyle} end>🏠 Home</NavLink>
      <NavLink to="/bet"     style={mobileLinkStyle}>🎱 Place Bet</NavLink>
      <NavLink to="/my-bets" style={mobileLinkStyle}>📋 My Bets</NavLink>
      <NavLink to="/results" style={mobileLinkStyle}>📊 Results</NavLink>
      <NavLink to="/wallet"  style={mobileLinkStyle}>💰 Wallet</NavLink>
      <NavLink to="/profile" style={mobileLinkStyle}>👤 Profile</NavLink>
      {user?.role === 'admin' && <NavLink to="/admin" style={mobileLinkStyle}>⚙️ Admin</NavLink>}
      <button className="nav-mobile-link-btn" onClick={handleLogout}>🚪 Logout</button>
    </>
  );

  return (
    <>
      <nav style={S.nav}>
        <span style={S.brand}>🎱 SWERTRES</span>
        <div className="nav-desktop-links">{links}</div>
        <button
          className="nav-hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </nav>
      {menuOpen && (
        <div className="nav-mobile-menu" role="navigation">
          {mobileLinks}
        </div>
      )}
    </>
  );
}
