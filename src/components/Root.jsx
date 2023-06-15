import styled from '@emotion/styled';
import { Avatar, Box, Divider, Typography } from '@mui/material';
import { Link, Outlet, useLocation } from 'react-router-dom';

const Root = () => {
    const location = useLocation();
    const StyledLink = styled(Link)`
        text-decoration: none;
    `;
    return (
        <>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    height: '100px',
                    width: '100%',
                    // bgcolor: 'black',
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
                    src="/iggy.jpeg"
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
