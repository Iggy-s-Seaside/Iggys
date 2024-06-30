import { Container, Box, Typography } from '@mui/material';
import { StyledTypography } from '../styled/StyledTypography';
import StyledDividerLine from '../styled/StyledDividerLine';

function Na() {
    // useEffect getna()
    // const [Na, setNa] = useState([]);
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
                    <Typography color={'text.complimentary'} variant="h4">
                        Ask your bartender about our Mocktails, slushies, juices
                        and sodas!
                        <br />
                        More information coming soon!
                    </Typography>
                    {/* map na */}
                </Box>
            </Container>
        </>
    );
}

export default Na;
