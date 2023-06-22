import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { theme } from './theme/theme.jsx';
import { ThemeProvider } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <App />
        </ThemeProvider>
    </React.StrictMode>
);
