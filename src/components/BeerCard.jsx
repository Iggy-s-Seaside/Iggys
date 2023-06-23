import { Box, Grid, Typography } from '@mui/material';
import PropTypes from 'prop-types';
import StyledDividerLine from '../styled/StyledDividerLine';

function BeerCard({
    item: { brewery, name, type, price, description, abv, id },
    tap,
}) {
    return (
        <>
            <Box sx={{ textAlign: 'left' }} key={id}>
                <Grid
                    container
                    justifyContent="space-between"
                    alignItems="center"
                >
                    <Grid item xs={9}>
                        <Typography
                            fontWeight={'bold'}
                            color={'primary.main'}
                            variant="h6"
                        >
                            {name.toUpperCase()}
                        </Typography>
                        <Typography color={'#C7945A'} variant="subtitle1">
                            {brewery}
                        </Typography>
                        <Typography color={'#C7945A'} variant="subtitle2">
                            {description}
                        </Typography>
                        {tap && (
                            <Typography color={'#C7945A'} variant="subtitle2">
                                ABV: {abv} {type}
                            </Typography>
                        )}
                    </Grid>
                    <Grid item xs={3}>
                        <Typography
                            variant="subtitle1"
                            align="right"
                            fontWeight={'bold'}
                            color={'primary.main'}
                        >
                            {price}
                        </Typography>
                    </Grid>
                </Grid>
            </Box>
            <StyledDividerLine />
        </>
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
