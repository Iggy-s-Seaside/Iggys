import { Box, Typography } from '@mui/material';

function BeerCard({ item: { name, type, price, description } }) {
    return (
        <Box>
            <Typography>
                {name.toUpperCase()} {price}
            </Typography>
            <p>{description}</p>
        </Box>
    );
}

export default BeerCard;
