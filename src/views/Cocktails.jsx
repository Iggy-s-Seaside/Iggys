import { Box } from '@mui/material';
import CocktailCard from '../components/CocktailCard';
import { useEffect, useState } from 'react';
import { getCocktails } from '../services/cocktails';

function Cocktails() {
    const [cocktails, setCocktails] = useState([]);
    useEffect(() => {
        const fetchCocktails = async () => {
            const data = await getCocktails();
            setCocktails(data);
        };
        fetchCocktails();
    }, []);
    console.log(cocktails);
    return (
        <>
            <Box sx={{ mt: '100px', mb: '50px' }}>
                <CocktailCard />
            </Box>
        </>
    );
}

export default Cocktails;
