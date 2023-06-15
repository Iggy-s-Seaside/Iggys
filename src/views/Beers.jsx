import { useEffect, useState } from 'react';
import { getOffTap } from '../services/off_tap';
import BeerCard from '../components/BeerCard';
import { Box, Container, Divider, Typography } from '@mui/material';

function Beers() {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    useEffect(() => {
        const getData = async () => {
            const data = await getOffTap();
            setItems(data);
            setLoading(false);
        };
        getData();
    }, []);

    const typeLoop = (type, item) => {
        if (item.type.toLowerCase().includes(type)) {
            return <BeerCard key={item.id} item={item} />;
        }
    };

    if (loading) {
        // will make loader for this
        return <p>loader</p>;
    }
    return (
        <>
            <Container
                sx={{
                    alignItems: 'center',
                    textAlign: 'center',
                }}
            >
                <Typography variant="h3"> ON TAP </Typography>
                <Box
                    display="grid"
                    gridTemplateColumns="repeat(12, 1fr)"
                    gap={2}
                >
                    <Box gridColumn="span 6">
                        <Typography>Beers on Tap</Typography>
                    </Box>
                    <Box gridColumn="span 6">
                        <Typography>Beers on Tap</Typography>
                    </Box>
                    <Box gridColumn="span 6">
                        <Typography>Beers on Tap</Typography>
                    </Box>
                    <Box gridColumn="span 6">
                        <Typography>Beers on Tap</Typography>
                    </Box>
                    <Box gridColumn="span 6">
                        <Typography>Beers on Tap</Typography>
                    </Box>
                    <Box gridColumn="span 6">
                        <Typography>Beers on Tap</Typography>
                    </Box>
                </Box>
            </Container>
            <Divider />
            <Container
                sx={{
                    alignItems: 'center',
                    textAlign: 'center',
                }}
            >
                <Typography variant="h3"> OFF TAP </Typography>

                <Box
                    display="grid"
                    gridTemplateColumns="repeat(12, 1fr)"
                    gap={2}
                >
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
            </Container>
        </>
    );
}

export default Beers;
