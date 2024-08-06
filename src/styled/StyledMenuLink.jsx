import styled from '@emotion/styled';
import { Link } from 'react-router-dom';

const StyledMenuLink = styled(Link)(({ theme }) => ({
    textDecoration: 'none',
    color: theme.palette.common.black,
    fontWeight: 'bold',
    minWidth: '100%',
}));

export default StyledMenuLink;
