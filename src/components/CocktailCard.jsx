import { Box, Grid, Typography } from '@mui/material';
import PropTypes from 'prop-types';

function CocktailCard({ data: { ingredients, price, name } }) {
    return (
        <>
            <Box mb="30px" sx={{ textAlign: 'left' }}>
                <Grid
                    container
                    justifyContent="space-between"
                    alignItems="center"
                >
                    <Grid item xs={9}>
                        <Typography variant="h6">{name}</Typography>
                        <Typography variant="body1">{ingredients}</Typography>
                    </Grid>
                    <Grid item xs={3}>
                        <Typography
                            variant="subtitle1"
                            align="right"
                            sx={{ fontWeight: 'bold' }}
                        >
                            {price}
                        </Typography>
                    </Grid>
                </Grid>
            </Box>
        </>
    );
}

CocktailCard.propTypes = {
    data: PropTypes.object,
    name: PropTypes.string,
    ingredients: PropTypes.string,
    price: PropTypes.string,
};

export default CocktailCard;
