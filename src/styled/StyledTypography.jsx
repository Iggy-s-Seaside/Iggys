import { Typography } from '@mui/material';
import styled from '@emotion/styled';
import '@fontsource/yellowtail';

const StyledTypography = styled(Typography)(({ theme }) => ({
    fontFamily: 'Yellowtail',
    color: theme.palette.primary.main,
}));

export { StyledTypography };
