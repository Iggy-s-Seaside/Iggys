import { Box, Typography } from '@mui/material';

function BeerCard({
    item: { brewery, name, type, price, description, abv, id },
}) {
    return (
        // font 64dfdf
        <Box key={id}>
            <Typography sx={{ textAlign: 'left' }}>
                {name.toUpperCase()}........... {price}
                <Typography>{brewery}</Typography>
                <Typography>{description}</Typography>
            </Typography>
            <Typography>ABV {abv}</Typography>
        </Box>
    );
}

export default BeerCard;
