import { Box, Grid, Typography } from '@mui/material';
import React from 'react';

function ChowderCard() {
    return (
        <Box mb="30px" sx={{ textAlign: 'left' }}>
            <Grid container justifyContent="space-between" alignItems="center">
                <Grid item xs={6}>
                    <Typography
                        fontWeight="bold"
                        color="primary.main"
                        variant="h5"
                    >
                        Clam Chowder
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
                            Cup
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
                            Bowl
                        </Typography>
                        <Typography
                            variant="subtitle1"
                            align="right"
                            fontWeight="bold"
                            color="primary.main"
                        >
                            $10.00
                        </Typography>
                    </Grid>
                </Grid>
            </Grid>
        </Box>
    );
}
export default ChowderCard;
