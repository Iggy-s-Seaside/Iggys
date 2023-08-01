import { Box, Grid, Typography } from '@mui/material';

function WellCard() {
    return (
        <>
            <Box sx={{ textAlign: 'left' }}>
                <Grid
                    container
                    justifyContent="space-between"
                    alignItems="center"
                >
                    <Grid item xs={9}>
                        <Typography
                            fontWeight={'bold'}
                            color={'primary.main'}
                            variant="h5"
                        >
                            Gin, Vodka, Rum, Tequila, or Whiskey with your
                            choice of Mixer
                        </Typography>
                        <Typography
                            color={'text.complimentary'}
                            variant="body1"
                        >
                            ADD $1.00 for freshed squeezed juice
                        </Typography>
                    </Grid>
                    <Grid item xs={3}>
                        <Typography
                            variant="subtitle1"
                            align="right"
                            fontWeight={'bold'}
                            color={'primary.main'}
                        >
                            $7.00
                        </Typography>
                    </Grid>
                </Grid>
            </Box>
        </>
    );
}

export default WellCard;
