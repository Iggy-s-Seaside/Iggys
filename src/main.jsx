import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { theme } from './theme/theme.jsx';
import { Modal, ThemeProvider } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { ModalProvider } from './context/modalContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ThemeProvider theme={theme}>
            <ModalProvider>
                <CssBaseline />
                <App />
            </ModalProvider>
        </ThemeProvider>
    </React.StrictMode>
);
