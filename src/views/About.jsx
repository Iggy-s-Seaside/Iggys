import HomeLayout from '../components/HomeLayout';
import imageUrls from '../assets/links';
import { Typography } from '@mui/material';

const { jellyFish } = imageUrls;

function About() {
    return (
        <>
            <HomeLayout
                sxBackground={{
                    backgroundImage: `url(${jellyFish})`,
                    backgroundPosition: 'center',
                }}
            >
                <img
                    style={{ display: 'none' }}
                    src={jellyFish}
                    alt="increase priority"
                />
                <Typography
                    color={'text.primary'}
                    align="center"
                    sx={{ typography: { xs: 'subtitle1', sm: 'h5' } }}
                >
                    In 1983, Mary Weise saw potential in a property in downtown
                    Seaside. She invited her son, Dooger, to join her in
                    starting a restaurant, and they embarked on a culinary
                    adventure together. With Dooger as the head chef and Mary as
                    the skilled prep cook, they transformed their establishment,
                    Dooger's Seafood and Grill, into a beloved seaside
                    institution over four decades.
                </Typography>
                <Typography
                    color={'text.primary'}
                    align="center"
                    sx={{ typography: { xs: 'subtitle1', sm: 'h5' } }}
                >
                    In 2011, Carnegie Wiese, Dooger's son, returned to help run
                    the family business. When the COVID-19 pandemic hit,
                    Carnegie turned the parking lot into an outdoor dining oasis
                    with picnic tables and a firepit, ensuring Dooger's
                    survival. Recognizing the opportunity for permanent
                    transformation, Carnegie consulted his college friend, Vito
                    Surreli, to design an innovative indoor-outdoor bar that
                    captures the essence of the coast. Their vision includes
                    welcoming dogs and a fresh, artistically infused modern
                    ambiance that brings a unique charm to Seaside.
                </Typography>
            </HomeLayout>
        </>
    );
}
export default About;
