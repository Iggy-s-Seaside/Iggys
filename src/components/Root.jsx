import { Box, Divider, useTheme } from '@mui/material';
import { Outlet } from 'react-router-dom';
import useMediaQuery from '@mui/material/useMediaQuery';
import RootHeaderMenu from './RootHeaderMenu';
import RootHeaderLinks from './RootHeaderLinks';

const Root = () => {
    const theme = useTheme();
    const smallScreen = useMediaQuery((theme) => theme.breakpoints.down('sm'));

    return (
        <>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    position: 'fixed',
                    height: '100px',
                    width: '100%',
                    bgcolor: '#3c666d',
                    zIndex: 1,
                    // opacity: 0.9,
                }}
            >
                <Box
                    component="img"
                    sx={{
                        m: '5px 15px',
                        position: 'absolute',
                        left: '0',
                        height: '90px',
                        width: '120',
                    }}
                    alt="iggy's mini logo"
                    src="/Iggys_hero.png"
                />
                {smallScreen ? <RootHeaderMenu /> : <RootHeaderLinks />}
            </Box>
            <Divider />

            <Box sx={{ height: '90vh' }}>
                <Outlet />
            </Box>
        </>
    );
};

export default Root;
