import { Box, Typography } from '@mui/material';
import PropTypes from 'prop-types';

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

BeerCard.propTypes = {
    item: PropTypes.shape({
        brewery: PropTypes.string,
        name: PropTypes.string,
        type: PropTypes.string,
        price: PropTypes.string,
        description: PropTypes.string,
        abv: PropTypes.string,
        id: PropTypes.number,
    }),
    tap: PropTypes.bool,
};

export default BeerCard;
