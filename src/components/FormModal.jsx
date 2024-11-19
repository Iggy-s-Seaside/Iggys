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
                        width: 500,
                        bgcolor: '#191919',
                        p: 2,
                        margin: 'auto',
                        display: 'block',
                    }}
                >
                    <EventForm />
                </Box>
            </Modal>
        </>
    );
}

export default FormModal;
