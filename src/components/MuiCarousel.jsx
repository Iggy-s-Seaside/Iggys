import React from 'react';
import Carousel from 'react-material-ui-carousel';
import { Paper, Button, Box } from '@mui/material';
import drinkLinks from '../assets/drinkLinks';
import Item from './Item';

const imageUrlsArr = Object.values(drinkLinks);

function MuiCarousel() {
    return (
        <Carousel
            indicators={false}
            sx={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
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
