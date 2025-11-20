import { Box, Container } from '@mui/material';

function Events() {
    // event photos and descriptions
    // link to event form and or form on page
    // blurb about events
    return (
        <Container
            disableGutters
            sx={{
                margin: '100px 0 0 0',
            }}
        >
            <Box
                disableGutters
                sx={{
                    margin: '0',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '5px',
                }}
            >
                <Box
                    sx={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'flex-start',
                        fontSize: '2rem',
                        fontWeight: 'bold',
                    }}
                >
                    Iggys events and whatnot
                </Box>
                <Box
                    sx={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'flex-start',
                        fontSize: '2rem',
                        fontWeight: 'bold',
                        bgcolor: 'primary.main',
                    }}
                >
                    other stuff
                </Box>
                <Box
                    sx={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'flex-start',
                        fontSize: '2rem',
                        fontWeight: 'bold',
                        bgcolor: 'primary.main',
                    }}
                >
                    more stuff
                </Box>
            </Box>
        </Container>
    );
}

export default Events;
