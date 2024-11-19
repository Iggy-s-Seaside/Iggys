import { Box, Modal } from '@mui/material';
import useModalContext from '../hooks/useModalContext';
import EventForm from './EventForm';

function FormModal() {
    const { open, handleClose } = useModalContext();
    return (
        <>
            <Modal open={open} onClose={handleClose}>
                <Box sx={{ width: 400, bgcolor: 'background.paper', p: 2 }}>
                    <EventForm />
                </Box>
            </Modal>
        </>
    );
}

export default FormModal;
