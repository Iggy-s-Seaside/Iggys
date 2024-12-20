import { Box } from '@mui/material';
import { Slide } from 'react-slideshow-image';
import styled from '@mui/material/styles/styled';
import 'react-slideshow-image/dist/styles.css';
import drinkLinks from '../assets/drinkLinks';

const imageUrlsArr = Object.values(drinkLinks);
console.log(imageUrlsArr);

const Background = styled(Box)({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundSize: 'cover',
    height: '400px',
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundRepeat: 'no-repeat',
    zIndex: -2,
});

function Slider() {
    return (
        <Box className="slide-container">
            <Slide autoplay={false}>
                {imageUrlsArr.map((slideImage, index) => (
                    <Box key={index}>
                        <Background
                            sx={{
                                backgroundImage: `url(${slideImage})`,
                                backgroundPosition: 'center',
                            }}
                        />
                    </Box>
                ))}
            </Slide>
        </Box>
    );
}

export default Slider;
