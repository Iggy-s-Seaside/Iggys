import { Box, Typography } from '@mui/material';

function BeerCard({
    item: { brewery, name, type, price, description, abv, id },
    tap,
}) {
    return (
        // font 64dfdf
        <Box sx={{ textAlign: 'left' }} key={id}>
            <Typography>
                {name.toUpperCase()}........... {price}
            </Typography>

            <Typography>{brewery}</Typography>
            <Typography>{description}</Typography>
            {tap && (
                <Typography>
                    ABV: {abv} {type}
                </Typography>
            )}
        </Box>
    );
}

export default BeerCard;
