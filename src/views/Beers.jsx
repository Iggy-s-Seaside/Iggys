import { useEffect, useState } from 'react';
import { getOffTap } from '../services/off_tap';
import BeerCard from '../components/BeerCard';
import { Box, Typography } from '@mui/material';

function Beers() {
    const [items, setItems] = useState([]);
    useEffect(() => {
        const getData = async () => {
            const data = await getOffTap();
            setItems(data);
        };
        getData();
    }, []);

    const typeLoop = (type, item) => {
        if (item.type.toLowerCase().includes(type)) {
            return <BeerCard key={item.id} item={item} />;
        }
    };

    return (
        <>
            <Box display="grid" gridTemplateColumns="repeat(12, 1fr)" gap={2}>
                <Box gridColumn="span 6">
                    <Typography variant="h3">IPA</Typography>
                    {items.map((item) => typeLoop('ipa', item))}
                </Box>
                <Box gridColumn="span 6">
                    <Typography variant="h3">Lager</Typography>
                    {items.map((item) => typeLoop('lager', item))}
                </Box>
                <Box gridColumn="span 6">
                    <Typography variant="h3">Pilsner</Typography>
                    {items.map((item) => typeLoop('pilsner', item))}
                </Box>
                <Box gridColumn="span 6">
                    <Typography variant="h3">Hard Cider</Typography>
                    {items.map((item) => typeLoop('cider', item))}
                </Box>
                <Box gridColumn="span 6">
                    <Typography variant="h3">Hard Seltzer</Typography>
                    {items.map((item) => typeLoop('seltzer', item))}
                </Box>
                <Box gridColumn="span 6">
                    <Typography variant="h3">Stout</Typography>
                    {items.map((item) => typeLoop('stout', item))}
                </Box>
                <Box gridColumn="span 6">
                    <Typography variant="h3">Hefeweizen</Typography>
                    {items.map((item) => typeLoop('hefeweizen', item))}
                </Box>
                <Box gridColumn="span 6">
                    <Typography variant="h3">N/A</Typography>
                    {items.map((item) => typeLoop('na', item))}
                </Box>
            </Box>
        </>
    );
}

export default Beers;
