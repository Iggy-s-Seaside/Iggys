import { Typography } from '@mui/material';
import StyledLink from '../styled/StyledLink';

function RootHeaderLinks() {
    return (
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
                <StyledLink to="/Na">Non Alcoholic</StyledLink>
            </Typography>
            <Typography sx={{ m: '50px 15px' }}>
                <StyledLink to="/appetizers">Appetizers</StyledLink>
            </Typography>
            <Typography sx={{ m: '50px 15px' }}>
                <StyledLink to="/happy_hour">Happy Hour</StyledLink>
            </Typography>
            <Typography sx={{ m: '50px 15px' }}>
                <StyledLink to="/contact">Contact/Book Event</StyledLink>
            </Typography>
            <Typography sx={{ m: '50px 15px' }}>
                <StyledLink to="/about">About</StyledLink>
            </Typography>
        </>
    );
}

export default RootHeaderLinks;
