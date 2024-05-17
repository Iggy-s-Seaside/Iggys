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
            main: '#69c9ca',
        },
        text: {
            primary: 'rgb(255,255,255)',
            secondary: '#69c9ca',
            complimentary: '#CB9866',
        },
    },
    typography: {
        fontFamily: 'Montserrat, sans-serif',
    },
    breakpoints: {
        values: {
            mid: 990,
        },
    },
});
