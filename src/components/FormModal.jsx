import { Box, Modal } from '@mui/material';
import useModalContext from '../hooks/useModalContext';
import EventForm from './EventForm';

function FormModal() {
    const { open, handleClose } = useModalContext();
    return (
        <>
            <Modal open={open} onClose={handleClose}>
                <Box
                    sx={{
                        width: { xs: '90%', sm: 500 },
                        bgcolor: 'background.default',
                        p: 2,
                        margin: 'auto',
                        display: 'block',
                        borderRadius: 2,
                    }}
                >
                    <EventForm />
                </Box>
            </Modal>
        </>
    );
}

export default FormModal;
