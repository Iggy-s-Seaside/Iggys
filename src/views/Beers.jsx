import { useEffect, useState } from 'react';
import { getOffTap } from '../services/off_tap';
import BeerCard from '../components/BeerCard';
import { Box, Container, Divider, Typography } from '@mui/material';
import { getOnTap } from '../services/on_tap';

function Beers() {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [onTap, setOnTap] = useState([]);
    useEffect(() => {
        const getData = async () => {
            const data = await getOffTap();
            const dataTap = await getOnTap();
            setItems(data);
            setOnTap(dataTap);
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
                    marginBottom: '50px',
                    marginTop: '100px',
                    // bgcolor: '#3c666d',
                }}
            >
                <Typography sx={{ marginBottom: '50px' }} variant="h3">
                    {' '}
                    ON TAP{' '}
                </Typography>
                <Box
                    display="grid"
                    gridTemplateColumns="repeat(12, 1fr)"
                    gap={2}
                    sx={{
                        border: 1,
                        borderColor: 'primary.main',
                        borderRadius: 1,
                        padding: '20px',
                    }}
                >
                    {onTap.map((item) => (
                        <Box
                            gridColumn={{
                                md: 'span 6',
                                sm: 'span 12',
                                xs: 'span 12',
                            }}
                            key={item.id}
                        >
                            <BeerCard item={item} />
                        </Box>
                    ))}
                </Box>
            </Container>
            <Divider />
            <Container
                sx={{
                    alignItems: 'center',
                    textAlign: 'center',
                    // bgcolor: '#3c666d',
                }}
            >
                <Typography sx={{ marginBottom: '50px' }} variant="h3">
                    {' '}
                    OFF TAP{' '}
                </Typography>

                <Box
                    display="grid"
                    gridTemplateColumns="repeat(12, 1fr)"
                    gap={2}
                    sx={{
                        border: 1,
                        borderColor: 'primary.main',
                        borderRadius: 1,
                        padding: '20px',
                    }}
                >
                    <Box
                        gridColumn={{
                            md: 'span 6',
                            sm: 'span 12',
                            xs: 'span 12',
                        }}
                    >
                        <Typography sx={{ textAlign: 'left' }} variant="h3">
                            IPA
                        </Typography>
                        {items.map((item) => typeLoop('ipa', item))}
                    </Box>
                    <Box
                        gridColumn={{
                            md: 'span 6',
                            sm: 'span 12',
                            xs: 'span 12',
                        }}
                    >
                        <Typography sx={{ textAlign: 'left' }} variant="h3">
                            Lager
                        </Typography>
                        {items.map((item) => typeLoop('lager', item))}
                    </Box>
                    <Box
                        gridColumn={{
                            md: 'span 6',
                            sm: 'span 12',
                            xs: 'span 12',
                        }}
                    >
                        <Typography sx={{ textAlign: 'left' }} variant="h3">
                            Pilsner
                        </Typography>
                        {items.map((item) => typeLoop('pilsner', item))}
                    </Box>
                    <Box
                        gridColumn={{
                            md: 'span 6',
                            sm: 'span 12',
                            xs: 'span 12',
                        }}
                    >
                        <Typography sx={{ textAlign: 'left' }} variant="h3">
                            Hard Cider
                        </Typography>
                        {items.map((item) => typeLoop('cider', item))}
                    </Box>
                    <Box
                        gridColumn={{
                            md: 'span 6',
                            sm: 'span 12',
                            xs: 'span 12',
                        }}
                    >
                        <Typography sx={{ textAlign: 'left' }} variant="h3">
                            Hard Seltzer
                        </Typography>
                        {items.map((item) => typeLoop('seltzer', item))}
                    </Box>
                    <Box
                        gridColumn={{
                            md: 'span 6',
                            sm: 'span 12',
                            xs: 'span 12',
                        }}
                    >
                        <Typography sx={{ textAlign: 'left' }} variant="h3">
                            Stout
                        </Typography>
                        {items.map((item) => typeLoop('stout', item))}
                    </Box>
                    <Box
                        gridColumn={{
                            md: 'span 6',
                            sm: 'span 12',
                            xs: 'span 12',
                        }}
                    >
                        <Typography sx={{ textAlign: 'left' }} variant="h3">
                            Hefeweizen
                        </Typography>
                        {items.map((item) => typeLoop('hefeweizen', item))}
                    </Box>
                    <Box
                        gridColumn={{
                            md: 'span 6',
                            sm: 'span 12',
                            xs: 'span 12',
                        }}
                    >
                        <Typography sx={{ textAlign: 'left' }} variant="h3">
                            N/A
                        </Typography>
                        {items.map((item) => typeLoop('na', item))}
                    </Box>
                </Box>
            </Container>
        </>
    );
}

export default Beers;
