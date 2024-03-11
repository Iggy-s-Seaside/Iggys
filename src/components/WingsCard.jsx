import { Box, Grid, Typography } from '@mui/material';
import React from 'react';

function WingsCard() {
    return (
        <Box mb="30px" sx={{ textAlign: 'left' }}>
            <Grid container justifyContent="space-between" alignItems="center">
                <Grid item xs={6}>
                    <Typography
                        fontWeight="bold"
                        color="primary.main"
                        variant="h5"
                    >
                        Buffalo Chicken Wings
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
                            (6)
                        </Typography>
                        <Typography
                            variant="subtitle1"
                            align="right"
                            fontWeight="bold"
                            color="primary.main"
                        >
                            $6.00
                        </Typography>
                    </Grid>
                    <Grid item>
                        <Typography
                            fontWeight="bold"
                            color="text.complimentary"
                            variant="h6"
                            align="right"
                        >
                            (12)
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
                </Grid>
            </Grid>
        </Box>
    );
}
export default WingsCard;
