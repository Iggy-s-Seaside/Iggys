import React, { useEffect, useState } from 'react';
import { Box, Container } from '@mui/material';
import { StyledTypography } from '../styled/StyledTypography';
import { getAppetizers } from '../services/appetizers';
import AppetizerCard from '../components/AppetizerCard';
import StyledDividerLine from '../styled/StyledDividerLine';
import ChowderCard from '../components/ChowderCard';

function Appetizers() {
    const [apps, setApps] = useState([]);
    useEffect(() => {
        const getData = async () => {
            const data = await getAppetizers();
            setApps(data);
        };
        getData();
    }, []);

    return (
        <>
            <Container
                sx={{
                    alignItems: 'center',
                    textAlign: 'center',
                    marginBottom: '100px',
                    marginTop: '100px',
                }}
            >
                <Box sx={{ mt: '100px', mb: '50px' }}>
                    <StyledTypography
                        sx={{ marginBottom: '50px' }}
                        variant="h3"
                    >
                        Appetizers
                    </StyledTypography>
                    <ChowderCard />
                    <StyledDividerLine />
                    {apps.map((data) => (
                        <React.Fragment key={data.id}>
                            <AppetizerCard data={data} />
                            <StyledDividerLine />
                        </React.Fragment>
                    ))}
                </Box>
            </Container>
        </>
    );
}
export default Appetizers;
