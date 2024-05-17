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
                            <MenuItem onClick={popupState.close}>
                                <Typography>
                                    <StyledMenuLink to="/">Home</StyledMenuLink>
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
                                    <StyledMenuLink to="/na">
                                        Non Alcoholic
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
                                    <StyledMenuLink to="/happy_hour">
                                        Happy Hour
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
                            <MenuItem onClick={popupState.close}>
                                <Typography>
                                    <StyledMenuLink to="/about">
                                        About
                                    </StyledMenuLink>
                                </Typography>
                            </MenuItem>
                        </Menu>
                    </>
                )}
            </PopupState>
        </>
    );
}

export default RootHeaderMenu;
