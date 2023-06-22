import { createTheme } from '@mui/material';
import '@fontsource/montserrat';
import '@fontsource/lobster-two';

export const theme = createTheme({
    palette: {
        background: {
            default: '#191919',
            secondary: '#033638',
        },
        primary: {
            main: '#64dfdf',
        },
        text: {
            primary: 'rgb(255,255,255)',
            secondary: '#64dfdf',
        },
    },
    typography: {
        fontFamily: 'Montserrat, sans-serif',
    },
});
