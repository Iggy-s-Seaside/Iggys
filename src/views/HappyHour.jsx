import { Box, Container } from '@mui/material';
import { StyledTypography } from '../styled/StyledTypography';

function HappyHour() {
    // useEffect getHappyHour()
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
                        Happy Hour
                    </StyledTypography>
                </Box>
                {/* map happy hour drink specials  */}
                {/* map happy hour food specials */}
            </Container>
        </>
    );
}

export default HappyHour;
