import { useEffect, useState } from 'react';
import { getOffTap } from '../services/off_tap';
import BeerCard from '../components/BeerCard';
import { Box, Container, Divider, Typography } from '@mui/material';
import { getOnTap } from '../services/on_tap';
import { StyledTypography } from '../styled/StyledTypography';

function Beers() {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [onTap, setOnTap] = useState([]);
    const tap = true;
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
    //TODO: ADD MB="50" TO HEADERS!!!! CHECK SUPABASE FOR PRODUCT INCONSISTENCIES
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
                <StyledTypography sx={{ marginBottom: '50px' }} variant="h3">
                    {' '}
                    On Tap{' '}
                </StyledTypography>
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
                            <BeerCard item={item} tap={tap} />
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
                <StyledTypography sx={{ marginBottom: '50px' }} variant="h3">
                    {' '}
                    Off Tap{' '}
                </StyledTypography>

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
                        <StyledTypography
                            sx={{ textAlign: 'left', letterSpacing: 2 }}
                            variant="h3"
                        >
                            Ipa
                        </StyledTypography>
                        {items.map((item) => typeLoop('ipa', item))}
                    </Box>
                    <Box
                        gridColumn={{
                            md: 'span 6',
                            sm: 'span 12',
                            xs: 'span 12',
                        }}
                    >
                        <StyledTypography
                            sx={{ textAlign: 'left', letterSpacing: 2 }}
                            variant="h3"
                        >
                            Lager
                        </StyledTypography>
                        {items.map((item) => typeLoop('lager', item))}
                    </Box>
                    <Box
                        gridColumn={{
                            md: 'span 6',
                            sm: 'span 12',
                            xs: 'span 12',
                        }}
                    >
                        <StyledTypography
                            sx={{ textAlign: 'left', letterSpacing: 2 }}
                            variant="h3"
                        >
                            Pilsner
                        </StyledTypography>
                        {items.map((item) => typeLoop('pilsner', item))}
                    </Box>
                    <Box
                        gridColumn={{
                            md: 'span 6',
                            sm: 'span 12',
                            xs: 'span 12',
                        }}
                    >
                        <StyledTypography
                            sx={{ textAlign: 'left', letterSpacing: 2 }}
                            variant="h3"
                        >
                            Hard Cider
                        </StyledTypography>
                        {items.map((item) => typeLoop('cider', item))}
                    </Box>
                    <Box
                        gridColumn={{
                            md: 'span 6',
                            sm: 'span 12',
                            xs: 'span 12',
                        }}
                    >
                        <StyledTypography
                            sx={{ textAlign: 'left', letterSpacing: 2 }}
                            variant="h3"
                        >
                            Hard Seltzer
                        </StyledTypography>
                        {items.map((item) => typeLoop('seltzer', item))}
                    </Box>
                    <Box
                        gridColumn={{
                            md: 'span 6',
                            sm: 'span 12',
                            xs: 'span 12',
                        }}
                    >
                        <StyledTypography
                            sx={{ textAlign: 'left', letterSpacing: 2 }}
                            variant="h3"
                        >
                            Stout
                        </StyledTypography>
                        {items.map((item) => typeLoop('stout', item))}
                    </Box>
                    <Box
                        gridColumn={{
                            md: 'span 6',
                            sm: 'span 12',
                            xs: 'span 12',
                        }}
                    >
                        <StyledTypography
                            sx={{ textAlign: 'left', letterSpacing: 2 }}
                            variant="h3"
                        >
                            Hefeweizen
                        </StyledTypography>
                        {items.map((item) => typeLoop('hefeweizen', item))}
                    </Box>
                    <Box
                        gridColumn={{
                            md: 'span 6',
                            sm: 'span 12',
                            xs: 'span 12',
                        }}
                    >
                        <StyledTypography
                            sx={{ textAlign: 'left' }}
                            variant="h3"
                        >
                            N/A
                        </StyledTypography>
                        {items.map((item) => typeLoop('na', item))}
                    </Box>
                </Box>
            </Container>
        </>
    );
}

export default Beers;
