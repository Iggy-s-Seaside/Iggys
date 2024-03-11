import { Box, Container, Typography } from '@mui/material';
import { StyledTypography } from '../styled/StyledTypography';
import React, { useEffect, useState } from 'react';
import { getHappyHour } from '../services/happy_hour';
import AppetizerCard from '../components/AppetizerCard';
import StyledDividerLine from '../styled/StyledDividerLine';
import WingsCard from '../components/WingsCard';

function HappyHour() {
    // useEffect getHappyHour()
    const [Hh, setHh] = useState([]);
    useEffect(() => {
        const getData = async () => {
            const data = await getHappyHour();
            setHh(data);
        };
        getData();
    }, []);

    const typeLoop = (type, data) => {
        if (data.type.toLowerCase().includes(type)) {
            return (
                <React.Fragment key={data.id}>
                    <AppetizerCard data={data} />
                    <StyledDividerLine />
                </React.Fragment>
            );
        }
    };

    return (
        <>
            <Container
                sx={{
                    mt: '100px',
                    mb: '100px',
                    textAlign: 'center',
                    alignItems: 'center',
                }}
            >
                <Box sx={{ mt: '100px', mb: '50px' }}>
                    <StyledTypography
                        sx={{ marginBottom: '50px' }}
                        variant="h3"
                    >
                        Happy Hour
                    </StyledTypography>
                </Box>
                {/* map happy hour drink specials  */}
                <Box sx={{ mt: '100px', mb: '50px' }}>
                    <StyledTypography
                        sx={{ marginBottom: '50px' }}
                        variant="h3"
                    >
                        Appetizers
                    </StyledTypography>
                    <WingsCard />
                    <StyledDividerLine />
                    {Hh.map((data) => typeLoop('app', data))}
                </Box>
                {/* map happy hour food specials */}
                <Box sx={{ mt: '100px', mb: '50px' }}>
                    <StyledTypography
                        sx={{ marginBottom: '50px' }}
                        variant="h3"
                    >
                        Food Specials
                        <Typography color={'primary.main'} variant="body1">
                            Served with your choice of French Fries, Sweet
                            Potato Fries, or Tater Tots (Cajun add $1)
                        </Typography>
                    </StyledTypography>
                    {Hh.map((data) => typeLoop('food', data))}
                </Box>
                {/* map happy hour drinks */}
                <Box sx={{ mt: '100px', mb: '50px' }}>
                    <StyledTypography
                        sx={{ marginBottom: '50px' }}
                        variant="h3"
                    >
                        Drink Specials
                    </StyledTypography>
                    {Hh.map((data) => typeLoop('drink', data))}
                </Box>
            </Container>
        </>
    );
}

export default HappyHour;
