import styled from '@emotion/styled';
import {
    Box,
    Button,
    Divider,
    Menu,
    MenuItem,
    Typography,
    useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { Link, Outlet } from 'react-router-dom';
import useMediaQuery from '@mui/material/useMediaQuery';
import PopupState, { bindTrigger, bindMenu } from 'material-ui-popup-state';

const Root = () => {
    const theme = useTheme();
    const smallScreen = useMediaQuery((theme) => theme.breakpoints.down('sm'));
    const StyledLink = styled(Link)`
        text-decoration: none;
        color: rgb(255, 255, 255);
        /* color: #64dfdf; */
    `;

    const StyledMenuLink = styled(Link)(({ theme }) => ({
        textDecoration: NamedNodeMap,
        color: theme.palette.common.black,
    }));
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
                {smallScreen ? (
                    <PopupState variant="popover" popupId="demo-popup-menu">
                        {(popupState) => (
                            <>
                                <Button
                                    variant="contained"
                                    {...bindTrigger(popupState)}
                                >
                                    <MenuIcon />
                                </Button>
                                <Menu {...bindMenu(popupState)}>
                                    <MenuItem onClick={popupState.close}>
                                        <Typography>
                                            <StyledMenuLink to="/">
                                                Home
                                            </StyledMenuLink>
                                        </Typography>
                                    </MenuItem>
                                    <MenuItem onClick={popupState.close}>
                                        <Typography>
                                            <StyledMenuLink to="/beers">
                                                Beers
                                            </StyledMenuLink>
                                        </Typography>
                                    </MenuItem>
                                    <MenuItem onClick={popupState.close}>
                                        <Typography>
                                            <StyledMenuLink to="/cocktails">
                                                Cocktails
                                            </StyledMenuLink>
                                        </Typography>
                                    </MenuItem>
                                    <MenuItem onClick={popupState.close}>
                                        <Typography>
                                            <StyledMenuLink to="/appetizers">
                                                Appetizers
                                            </StyledMenuLink>
                                        </Typography>
                                    </MenuItem>
                                    <MenuItem onClick={popupState.close}>
                                        <Typography>
                                            <StyledMenuLink to="/contact">
                                                Contact
                                            </StyledMenuLink>
                                        </Typography>
                                    </MenuItem>
                                </Menu>
                            </>
                        )}
                    </PopupState>
                ) : (
                    <>
                        <Typography sx={{ m: '50px 15px' }}>
                            <StyledLink to="/">Home</StyledLink>
                        </Typography>
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
                    </>
                )}
            </Box>
            <Divider />

            <Box sx={{ height: '90vh' }}>
                <Outlet />
            </Box>
        </>
    );
};

export default Root;
