import React from 'react';
import { Box, Container, Divider, Typography } from '@mui/material';
import CocktailCard from '../components/CocktailCard';
import { useEffect, useState } from 'react';
import { getCocktails } from '../services/cocktails';
import { getShots } from '../services/shots';
import WellCard from '../components/WellCard';
import StyledDividerLine from '../styled/StyledDividerLine';

function Cocktails() {
    const [cocktails, setCocktails] = useState([]);
    const [shots, setShots] = useState([]);
    useEffect(() => {
        const fetchCocktails = async () => {
            const data = await getCocktails();
            const shotData = await getShots();
            setShots(shotData);
            setCocktails(data);
        };
        fetchCocktails();
    }, []);
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
                <Box sx={{ mt: '100px', mb: '50px' }}>
                    <Typography variant="h3" mb="50px">
                        Cocktails
                    </Typography>
                    {cocktails.map((data) => (
                        <React.Fragment key={data.id}>
                            <CocktailCard data={data} />
                            <StyledDividerLine />
                        </React.Fragment>
                    ))}
                    <Divider />
                    <Typography variant="h3">Well Drinks</Typography>
                    <WellCard />
                    <StyledDividerLine />
                    <Divider />
                    <Typography variant="h3">Shots</Typography>
                    {shots.map((data) => (
                        <React.Fragment key={data.id}>
                            <CocktailCard data={data} />
                            <StyledDividerLine />
                        </React.Fragment>
                    ))}
                </Box>
            </Container>
        </>
    );
}

export default Cocktails;
