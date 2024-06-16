import { Box, Container, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import PropTypes from 'prop-types';
import imageUrls from '../assets/links';
const { drinks2 } = imageUrls;

const DividerCardLayoutRoot = styled('section')(({ theme }) => ({
    color: theme.palette.common.white,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    [theme.breakpoints.up('xs')]: {
        maxHeight: '400px',
        minHeight: '300px',
        width: '100%',
    },
}));
const Background = styled(Box)({
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundSize: 'stretch',
    // backgroundRepeat: 'no-repeat',
    zIndex: -2,
});

function DividerCard(props) {
    const { sxBackground, cardText, children } = props;
    return (
        <>
            <DividerCardLayoutRoot>
                <Container
                    sx={{
                        mt: 14,
                        mb: 14,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                    }}
                >
                    <Typography
                        color={'text.complimentary'}
                        align="center"
                        sx={{ typography: { xs: 'subtitle1', sm: 'h5' } }}
                    >
                        {cardText}
                    </Typography>
                    {children}

                    <Box
                        sx={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: 0,
                            bottom: 0,
                            backgroundColor: 'common.black',
                            opacity: 0.8,
                            zIndex: -1,
                        }}
                    />
                    <Background
                        sx={{
                            backgroundImage: `url(${drinks2})`,
                            backgroundPosition: 'center',
                        }}
                    />
                </Container>
            </DividerCardLayoutRoot>
        </>
    );
}

DividerCard.propTypes = {
    children: PropTypes.node,
    cardText: PropTypes.string,
};

export default DividerCard;
