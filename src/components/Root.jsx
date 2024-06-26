import { Box, Divider } from '@mui/material';
import { Outlet, useNavigate } from 'react-router-dom';
import useMediaQuery from '@mui/material/useMediaQuery';
import RootHeaderMenu from './RootHeaderMenu';
import RootHeaderLinks from './RootHeaderLinks';

const Root = () => {
    const smallScreen = useMediaQuery((theme) => theme.breakpoints.down('mid'));
    const navigate = useNavigate();
    const handleImageClick = () => {
        navigate('/');
    };

    return (
        <>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    position: 'fixed',
                    height: '100px',
                    width: '100%',
                    // bgcolor: '#3c666d',
                    // bgcolor: '#089c8f',
                    bgcolor: 'primary.main',
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
                    onClick={handleImageClick}
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
