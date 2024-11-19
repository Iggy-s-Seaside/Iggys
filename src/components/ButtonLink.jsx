import { Link } from 'react-router-dom';
import Button from '@mui/material/Button';
import PropTypes from 'prop-types';

function ButtonLink({ to, children, ...rest }) {
    return (
        <Button component={Link} to={to} {...rest}>
            {children}
        </Button>
    );
}

ButtonLink.propTypes = {
    to: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
};

export default ButtonLink;
