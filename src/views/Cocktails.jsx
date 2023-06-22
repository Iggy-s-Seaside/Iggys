import React from 'react';
import { Box, Container, Divider, Typography } from '@mui/material';
import CocktailCard from '../components/CocktailCard';
import { useEffect, useState } from 'react';
import { getCocktails } from '../services/cocktails';
import { getShots } from '../services/shots';
import WellCard from '../components/WellCard';
import StyledDividerLine from '../styled/StyledDividerLine';
import { StyledTypography } from '../styled/StyledTypography';

function Cocktails() {
    const [loading, setLoading] = useState(true);
    const [cocktails, setCocktails] = useState([]);
    const [shots, setShots] = useState([]);
    useEffect(() => {
        const fetchCocktails = async () => {
            const data = await getCocktails();
            const shotData = await getShots();
            setShots(shotData);
            setCocktails(data);
            setLoading(false);
        };
        fetchCocktails();
    }, []);
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
                <Box sx={{ mt: '100px', mb: '50px' }}>
                    <StyledTypography variant="h3" mb="50px">
                        Cocktails
                    </StyledTypography>
                    {cocktails.map((data) => (
                        <React.Fragment key={data.id}>
                            <CocktailCard data={data} />
                            <StyledDividerLine />
                        </React.Fragment>
                    ))}
                    <StyledTypography variant="h3" mb="50px">
                        Well Drinks
                    </StyledTypography>
                    <WellCard />
                    <StyledDividerLine />
                    <StyledTypography variant="h3" mb="50px">
                        Shots
                    </StyledTypography>
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
