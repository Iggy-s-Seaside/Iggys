import { Box } from '@mui/material';
import React from 'react';

function Footer() {
    return (
        <Box
            sx={{
                height: '2.5rem',
                width: '100%',
                position: 'fixed',
                bottom: '0',
                paddingBottom: '2.5rem',
                bgcolor: 'primary.main',
            }}
        ></Box>
    );
}

export default Footer;
