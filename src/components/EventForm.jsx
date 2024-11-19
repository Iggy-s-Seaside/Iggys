import {
    Box,
    Button,
    Container,
    CssBaseline,
    TextField,
    Typography,
} from '@mui/material';

function EventForm() {
    return (
        <>
            <Container>
                <CssBaseline />v
                <Box component="form" sx={{ mt: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Typography align="center" variant="h5" color="black">
                            Provide your event request details
                        </Typography>
                    </Box>

                    <TextField
                        sx={{ input: { color: 'black' } }}
                        fullWidth
                        margin="normal"
                        name="date"
                        required
                        type="date"
                        variant="outlined"
                    />
                    <TextField
                        sx={{ input: { color: 'black' } }}
                        fullWidth
                        margin="normal"
                        name="time"
                        required
                        type="time"
                        variant="outlined"
                    />
                    <TextField
                        sx={{ input: { color: 'black' } }}
                        fullWidth
                        label="Email"
                        margin="normal"
                        name="email"
                        required
                        type="email"
                        variant="outlined"
                    />
                    <TextField
                        sx={{ input: { color: 'black' } }}
                        fullWidth
                        label="Contact Info"
                        margin="normal"
                        name="contactInfo"
                        required
                        variant="outlined"
                    />
                    <TextField
                        sx={{ input: { color: 'black' } }}
                        fullWidth
                        rows={4}
                        label="Description"
                        margin="normal"
                        name="description"
                        required
                        variant="outlined"
                    />
                    <Button
                        color="primary"
                        fullWidth
                        size="large"
                        type="submit"
                        variant="contained"
                    >
                        Submit
                    </Button>
                </Box>
            </Container>
        </>
    );
}

export default EventForm;
