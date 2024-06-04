import { Button, Paper } from '@mui/material';
import React from 'react';

function Item({ image, index }) {
    return (
        <Paper>
            <img
                src={image}
                alt={`slide ${index}`}
                style={{ width: '100%', height: '100%' }}
            />
            <Button />
        </Paper>
    );
}

export default Item;
