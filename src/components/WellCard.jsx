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
                    <Grid item sx={9}>
                        <Typography
                            fontWeight={'bold'}
                            color={'#089c8f'}
                            variant="h5"
                        >
                            Gin, Vodka, Rum, Tequila, or Whiskey with your
                            choice of Mixer
                        </Typography>
                        <Typography color={'#C7945A'} variant="body1">
                            ADD $1.00 for freshed squeezed juice
                        </Typography>
                    </Grid>
                    <Grid item sx={3}>
                        <Typography
                            variant="subtitle1"
                            align="right"
                            sx={{ fontWeight: 'bold' }}
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
