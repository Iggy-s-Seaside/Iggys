import {
    Box,
    Button,
    Container,
    CssBaseline,
    TextField,
    Typography,
} from '@mui/material';
import useForm from '../hooks/useForm';
import emailjs from '@emailjs/browser';

function EventForm() {
    const { formState, handleChange } = useForm({
        date: '',
        email: '',
        name: '',
        message: '',
    });

    const handleSubmit = (e, formState) => {
        e.preventDefault();
        console.log(formState.name);

        emailjs
            .send(
                import.meta.env.EMAIL_SERVICE_ID,
                import.meta.env.EMAIL_TEMPLATE_ID,
                { ...formState },
                { publicKey: import.meta.env.EMAIL_USER_ID }
            )
            .then(
                (result) => {
                    console.log(result.text);
                },
                (error) => {
                    console.log(error.text);
                }
            );
    };

    return (
        <>
            <Container>
                <CssBaseline />
                <Box
                    component="form"
                    onSubmit={handleSubmit}
                    sx={{ mt: 3, mb: 3 }}
                >
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
                        onChange={handleChange}
                        value={formState.date}
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
                        onChange={handleChange}
                        value={formState.email}
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
                        onChange={handleChange}
                        value={formState.name}
                        fullWidth
                        label="Name"
                        margin="normal"
                        name="name"
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
                        onChange={handleChange}
                        value={formState.message}
                        fullWidth
                        multiline
                        rows={4}
                        label="Event Description, please include date, time. contact info"
                        margin="normal"
                        name="message"
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
