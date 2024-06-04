import { Box } from '@mui/material';
function Footer() {
    return (
        <Box
            sx={{
                height: 'auto',
                width: '100%',
                position: 'fixed',
                bottom: '0',
                paddingBottom: '2.5rem',
                marginTop: 'auto',
                bgcolor: 'primary.main',
                zIndex: '1',
                clear: 'both',
            }}
        ></Box>
    );
}

export default Footer;
