import { Button, Menu, MenuItem, Typography } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import PopupState, { bindTrigger, bindMenu } from 'material-ui-popup-state';
import StyledMenuLink from '../styled/StyledMenuLink';

function RootHeaderMenu() {
    return (
        <>
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
                            <StyledMenuLink to="/">
                                <MenuItem
                                    sx={{
                                        bgcolor: 'primary.main',
                                    }}
                                    onClick={popupState.close}
                                >
                                    <Typography align="right">
                                        <StyledMenuLink to="/">
                                            Home
                                        </StyledMenuLink>
                                    </Typography>
                                </MenuItem>
                            </StyledMenuLink>
                            <StyledMenuLink to="/beers">
                                <MenuItem
                                    sx={{ bgcolor: 'primary.alt' }}
                                    onClick={popupState.close}
                                >
                                    <Typography>
                                        <StyledMenuLink to="/beers">
                                            Beers
                                        </StyledMenuLink>
                                    </Typography>
                                </MenuItem>
                            </StyledMenuLink>
                            <StyledMenuLink to="/cocktails">
                                <MenuItem
                                    sx={{
                                        bgcolor: 'primary.main',
                                    }}
                                    onClick={popupState.close}
                                >
                                    <Typography>
                                        <StyledMenuLink to="/cocktails">
                                            Cocktails
                                        </StyledMenuLink>
                                    </Typography>
                                </MenuItem>
                            </StyledMenuLink>
                            <StyledMenuLink to="/na">
                                <MenuItem
                                    sx={{ bgcolor: 'primary.alt' }}
                                    onClick={popupState.close}
                                >
                                    <Typography>
                                        <StyledMenuLink to="/na">
                                            Non Alcoholic
                                        </StyledMenuLink>
                                    </Typography>
                                </MenuItem>
                            </StyledMenuLink>
                            <StyledMenuLink to="/appetizers">
                                <MenuItem
                                    sx={{ bgcolor: 'primary.main' }}
                                    onClick={popupState.close}
                                >
                                    <Typography>
                                        <StyledMenuLink to="/appetizers">
                                            Appetizers
                                        </StyledMenuLink>
                                    </Typography>
                                </MenuItem>
                            </StyledMenuLink>
                            <StyledMenuLink to="/happy_hour">
                                <MenuItem
                                    sx={{ bgcolor: 'primary.alt' }}
                                    onClick={popupState.close}
                                >
                                    <Typography>
                                        <StyledMenuLink to="/happy_hour">
                                            Happy Hour
                                        </StyledMenuLink>
                                    </Typography>
                                </MenuItem>
                            </StyledMenuLink>
                            <StyledMenuLink to="/contact">
                                <MenuItem
                                    sx={{ bgcolor: 'primary.main' }}
                                    onClick={popupState.close}
                                >
                                    <Typography>
                                        <StyledMenuLink to="/contact">
                                            Contact/ Book Event
                                        </StyledMenuLink>
                                    </Typography>
                                </MenuItem>
                            </StyledMenuLink>
                            <StyledMenuLink to="/about">
                                <MenuItem
                                    sx={{ bgcolor: 'primary.alt' }}
                                    onClick={popupState.close}
                                >
                                    <Typography>
                                        <StyledMenuLink to="/about">
                                            About
                                        </StyledMenuLink>
                                    </Typography>
                                </MenuItem>
                            </StyledMenuLink>
                            {/* <StyledMenuLink to="/events">
                                <MenuItem
                                    sx={{ bgcolor: 'primary.alt' }}
                                    onClick={popupState.close}
                                >
                                    <Typography>
                                        <StyledMenuLink to="/events">
                                            Events
                                        </StyledMenuLink>
                                    </Typography>
                                </MenuItem>
                            </StyledMenuLink> */}
                        </Menu>
                    </>
                )}
            </PopupState>
        </>
    );
}

export default RootHeaderMenu;
