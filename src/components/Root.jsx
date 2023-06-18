import styled from '@emotion/styled';
import { Box, Divider, Typography } from '@mui/material';
import { Link, Outlet, useLocation } from 'react-router-dom';

const Root = () => {
    const location = useLocation();
    const StyledLink = styled(Link)`
        text-decoration: none;
        color: rgb(255, 255, 255);
        /* color: #64dfdf; */
    `;
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
                {location.pathname != '/' && (
                    <Typography sx={{ m: '50px 15px' }}>
                        <StyledLink to="/">Home</StyledLink>
                    </Typography>
                )}
                <Typography sx={{ m: '50px 15px' }}>
                    <StyledLink to="/beers">Beers</StyledLink>
                </Typography>
                <Typography sx={{ m: '50px 15px' }}>
                    <StyledLink to="/cocktails">Cocktails</StyledLink>
                </Typography>
                <Typography sx={{ m: '50px 15px' }}>
                    <StyledLink to="/appetizers">Appetizers</StyledLink>
                </Typography>
                <Typography sx={{ m: '50px 15px' }}>
                    <StyledLink to="/contact">Contact</StyledLink>
                </Typography>
            </Box>
            <Divider />

            <Box sx={{ height: '90vh' }}>
                <Outlet />
            </Box>
        </>
    );
};

export default Root;
