import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { theme } from './theme/theme.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <App />
        </ThemeProvider>
    </React.StrictMode>
);

// {location.pathname != '/' && (
//     <Typography sx={{ m: '50px 15px' }}>
//         <StyledLink to="/">Home</StyledLink>
//     </Typography>
// )}
// <Typography sx={{ m: '50px 15px' }}>
//     <StyledLink to="/beers">Beers</StyledLink>
// </Typography>
// <Typography sx={{ m: '50px 15px' }}>
//     <StyledLink to="/cocktails">Cocktails</StyledLink>
// </Typography>
// <Typography sx={{ m: '50px 15px' }}>
//     <StyledLink to="/appetizers">Appetizers</StyledLink>
// </Typography>
// <Typography sx={{ m: '50px 15px' }}>
//     <StyledLink to="/contact">Contact</StyledLink>
// </Typography>
