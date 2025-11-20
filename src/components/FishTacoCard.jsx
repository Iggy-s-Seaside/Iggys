import { Box, Grid, Typography } from '@mui/material';

function FishTacoCard() {
    return (
        <Box mb="30px" sx={{ textAlign: 'left' }}>
            <Grid container justifyContent="space-between" alignItems="center">
                <Grid item xs={6}>
                    <Typography
                        fontWeight="bold"
                        color="primary.main"
                        variant="h5"
                    >
                        Cod Fish Tacos (grilled or fried)
                    </Typography>
                    <Typography color="text.complimentary" variant="body1">
                        Served on corn tortillas with shredded cabbage, chipotle
                        aioli, queso fresco, and housemade pico de gallo.
                    </Typography>
                </Grid>
                <Grid item xs={6} container direction="column">
                    <Grid item>
                        <Typography
                            fontWeight="bold"
                            color="text.complimentary"
                            variant="h6"
                            align="right"
                        >
                            (2)
                        </Typography>
                        <Typography
                            variant="subtitle1"
                            align="right"
                            fontWeight="bold"
                            color="primary.main"
                        >
                            $12.00
                        </Typography>
                    </Grid>
                    <Grid item>
                        <Typography
                            fontWeight="bold"
                            color="text.complimentary"
                            variant="h6"
                            align="right"
                        >
                            (3)
                        </Typography>
                        <Typography
                            variant="subtitle1"
                            align="right"
                            fontWeight="bold"
                            color="primary.main"
                        >
                            $16.00
                        </Typography>
                    </Grid>
                </Grid>
            </Grid>
        </Box>
    );
}
export default FishTacoCard;
