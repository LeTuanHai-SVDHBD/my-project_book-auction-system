/**
 * Khởi tạo React, nạp stylesheet và gắn App vào phần tử root.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './style.css';
import './design.css';
import './integration.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
