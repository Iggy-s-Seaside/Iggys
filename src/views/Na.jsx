import { Container, Box, Typography } from '@mui/material';
import { StyledTypography } from '../styled/StyledTypography';
import StyledDividerLine from '../styled/StyledDividerLine';

function Na() {
    return (
        <>
            <Container
                sx={{
                    mt: '100px',
                    mb: '100px',
                    textAlign: 'center',
                    alignItems: 'center',
                }}
            >
                <Box sx={{ mt: '100px', mb: '50px' }}>
                    <StyledTypography
                        sx={{ marginBottom: '50px' }}
                        variant="h3"
                    >
                        Non alcoholic beverages
                    </StyledTypography>
                    <Typography color={'primary.main'} variant="h4">
                        Mocktails, slushies, juices and sodas
                    </Typography>
                </Box>
            </Container>
        </>
    );
}

export default Na;
