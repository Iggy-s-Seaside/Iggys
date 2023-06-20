import styled from '@emotion/styled';
import { Link } from 'react-router-dom';

const StyledMenuLink = styled(Link)(({ theme }) => ({
    textDecoration: 'none',
    color: theme.palette.common.black,
    fontWeight: 'bold',
}));

export default StyledMenuLink;
