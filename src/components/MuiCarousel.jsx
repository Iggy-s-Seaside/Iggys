import React from 'react';
import Carousel from 'react-material-ui-carousel';
import { Paper, Button } from '@mui/material';
import imageUrls from '../assets/links';
import Item from './Item';

const imageUrlsArr = Object.values(imageUrls);

function MuiCarousel() {
    return (
        <Carousel
            indicators={false}
            sx={{
                // maxHeight: '500px',
                alignItems: 'center',
                justifyContent: 'center',
                // backgroundSize: 'cover',
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
            }}
        >
            {imageUrlsArr.map((image, index) => (
                <Paper key={index}>
                    <Item image={image} index={index} />
                </Paper>
            ))}
        </Carousel>
    );
}

export default MuiCarousel;
