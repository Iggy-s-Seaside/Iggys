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
                <CssBaseline />
                <Box component="form" sx={{ mt: 3, mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Typography
                            align="center"
                            variant="h5"
                            color="primary.main"
                        >
                            Provide your event request details
                        </Typography>
                    </Box>

                    <TextField
                        fullWidth
                        label="Arrival Date"
                        margin="normal"
                        name="date"
                        required
                        type="date"
                        variant="outlined"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': { borderColor: 'primary.main' },
                                '& input': {
                                    textAlign: 'right',
                                    color: 'primary.main',
                                },
                            },
                        }}
                    />
                    <TextField
                        fullWidth
                        margin="normal"
                        label="Start Time"
                        name="time"
                        required
                        type="time"
                        variant="outlined"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': { borderColor: 'primary.main' },
                                '& input': {
                                    textAlign: 'right',
                                    color: 'primary.main',
                                },
                            },
                        }}
                    />
                    <TextField
                        fullWidth
                        margin="normal"
                        label="End Time"
                        name="time"
                        required
                        type="time"
                        variant="outlined"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': { borderColor: 'primary.main' },
                                '& input': {
                                    textAlign: 'right',
                                    color: 'primary.main',
                                },
                            },
                        }}
                    />
                    <TextField
                        fullWidth
                        label="Email"
                        margin="normal"
                        name="email"
                        required
                        type="email"
                        variant="outlined"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': { borderColor: 'primary.main' },
                                '& input': {
                                    color: 'primary.main',
                                },
                            },
                        }}
                    />
                    <TextField
                        fullWidth
                        label="Additional Contact Info"
                        margin="normal"
                        name="contactInfo"
                        required
                        variant="outlined"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': { borderColor: 'primary.main' },
                                '& input': {
                                    color: 'primary.main',
                                },
                            },
                        }}
                    />
                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="Description"
                        margin="normal"
                        name="description"
                        required
                        variant="outlined"
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                '& fieldset': { borderColor: 'primary.main' },
                                '& textarea': {
                                    color: 'primary.main',
                                },
                            },
                            '& .MuiInputBase-root': {
                                overflowY: 'auto',
                                '&::-webkit-scrollbar': {
                                    width: '8px',
                                },
                                '&::-webkit-scrollbar-thumb': {
                                    backgroundColor: 'primary.main',
                                    borderRadius: '4px',
                                },
                                '&::-webkit-scrollbar-track': {
                                    backgroundColor: 'transparent',
                                },
                            },
                        }}
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
