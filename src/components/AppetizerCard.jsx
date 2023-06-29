import { Box, Grid, Typography } from '@mui/material';
import PropTypes from 'prop-types';

function AppetizerCard({ data: { description, price, name } }) {
    return (
        <>
            <Box mb="30px" sx={{ textAlign: 'left' }}>
                <Grid
                    container
                    justifyContent="space-between"
                    alignItems="center"
                >
                    <Grid item xs={9}>
                        <Typography
                            fontWeight={'bold'}
                            // color={'#089c8f'}
                            color={'primary.main'}
                            variant="h5"
                        >
                            {name}
                        </Typography>
                        <Typography
                            color={'text.complimentary'}
                            variant="body1"
                        >
                            {description}
                        </Typography>
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
        </>
    );
}

AppetizerCard.propTypes = {
    data: PropTypes.object,
    name: PropTypes.string,
    description: PropTypes.string,
    price: PropTypes.string,
};

export default AppetizerCard;
