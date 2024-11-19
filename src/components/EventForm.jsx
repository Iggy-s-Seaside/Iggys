import { Box, Button, Container, TextField, Typography } from '@mui/material';

function EventForm() {
    return (
        <>
            <Container>
                <Box component="form" sx={{ mt: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Typography variant="h4">Add an Event</Typography>
                    </Box>
                    <TextField
                        fullWidth
                        label="Event Name"
                        margin="normal"
                        name="name"
                        required
                        variant="outlined"
                    />
                    <TextField
                        fullWidth
                        label="Location"
                        margin="normal"
                        name="location"
                        required
                        variant="outlined"
                    />
                    <TextField
                        fullWidth
                        label="Date"
                        margin="normal"
                        name="date"
                        required
                        type="date"
                        variant="outlined"
                    />
                    <TextField
                        fullWidth
                        label="Time"
                        margin="normal"
                        name="time"
                        required
                        type="time"
                        variant="outlined"
                    />
                    <TextField
                        fullWidth
                        label="Email"
                        margin="normal"
                        name="email"
                        required
                        type="email"
                        variant="outlined"
                    />
                    <TextField
                        fullWidth
                        label="Contact Info"
                        margin="normal"
                        name="contactInfo"
                        required
                        variant="outlined"
                    />
                    <TextField
                        fullWidth
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
                        Add Event
                    </Button>
                </Box>
            </Container>
        </>
    );
}

export default EventForm;
