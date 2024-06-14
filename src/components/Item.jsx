import PropTypes from 'prop-types';
import { useTheme } from '@mui/material/styles';
import { Box, Button, Paper } from '@mui/material';
function Item({ image }) {
    const theme = useTheme();

    return (
        <Paper
            sx={{
                height: theme.breakpoints.down('sm') ? '50vh' : '100vh',
                width: theme.breakpoints.down('sm') ? '100vw' : '50vw',
                bgcolor: theme.palette.background.default,
                backgroundImage: `url(${image})`,
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
            }}
        >
            <Button />
        </Paper>
    );
}

Item.propTypes = {
    image: PropTypes.string.isRequired,
};

export default Item;
