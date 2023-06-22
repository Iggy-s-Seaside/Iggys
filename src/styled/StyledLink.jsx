import styled from '@emotion/styled';
import { Link } from 'react-router-dom';

const StyledLink = styled(Link)`
    text-decoration: none;
    /* color: rgb(255, 255, 255);
     */
    color: #191919;
    font-weight: bold;
    /* color: #64dfdf; */

    &:hover {
        color: #089c8f;
        font-size: 1.2rem;
    }
`;
export default StyledLink;
