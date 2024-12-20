import { createContext, useState } from 'react';
import PropTypes from 'prop-types';

const ModalContext = createContext();

const ModalProvider = ({ children }) => {
    const [open, setOpen] = useState(false);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    return (
        <ModalContext.Provider
            value={{
                open,
                setOpen,
                handleOpen,
                handleClose,
            }}
        >
            {children}
        </ModalContext.Provider>
    );
};
ModalProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

export { ModalProvider, ModalContext };
