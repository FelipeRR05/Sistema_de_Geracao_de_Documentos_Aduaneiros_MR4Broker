import React from 'react';
import logo from '../assets/logo_mr4.png';

function Header() {
  return (
    <header className="app-header">
      <img src={logo} className="app-logo" alt="MR4Broker Logo" />
      <h1 className="app-title">Plataforma de Automação</h1>
    </header>
  );
}

export default Header;