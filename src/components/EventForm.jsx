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
import useModalContext from '../hooks/useModalContext';

function EventForm() {
    const { handleClose } = useModalContext();
    const { formState, handleChange, resetForm } = useForm({
        date: '',
        from_email: '',
        from_name: '',
        message: '',
        phoneNumber: '',
        to_email: import.meta.env.VITE_TO_EMAIL,
        to_name: 'Kelsey',
    });

    const handleSubmit = (e) => {
        e.preventDefault();

        emailjs
            .send(
                import.meta.env.VITE_EMAIL_SERVICE_ID,
                import.meta.env.VITE_EMAIL_TEMPLATE_ID,
                formState,
                { publicKey: import.meta.env.VITE_EMAIL_PUBLIC_KEY }
            )
            .then(
                (result) => {
                    console.log(result.text, result.status);
                },
                (error) => {
                    console.log(error.text, error.status);
                }
            );
        resetForm();
        handleClose();
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
                        value={formState.from_email}
                        fullWidth
                        label="Email"
                        margin="normal"
                        name="from_email"
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
                        value={formState.phoneNumber}
                        fullWidth
                        label="Phone Number(optional)"
                        margin="normal"
                        name="phoneNumber"
                        type="tel"
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
                        value={formState.from_name}
                        fullWidth
                        label="Name"
                        margin="normal"
                        name="from_name"
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
                        label="Event Description, please include start and end time."
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
