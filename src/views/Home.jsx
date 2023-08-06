import { Typography } from '@mui/material';
import HomeLayout from '../components/HomeLayout';
import imageUrls from '../assets/links';
import DividerCard from '../components/DividerCard';

const { backgroundImage, wallInsideImage, tapOutsideImage, drinks2, mural } =
    imageUrls;

function Home() {
    return (
        <>
            <HomeLayout
                sxBackground={{
                    backgroundImage: `url(${backgroundImage})`,
                    backgroundPosition: 'center',
                }}
            >
                <img
                    style={{ display: 'none' }}
                    src={backgroundImage}
                    alt="increase priority"
                />
                <Typography align="center" variant="h2" marked="center">
                    Iggy's Bar
                </Typography>
                <Typography
                    color="inherit"
                    align="center"
                    variant="h5"
                    sx={{ mb: 4, mt: { xs: 4, sm: 10 } }}
                >
                    Seaside's newest bar!
                </Typography>
            </HomeLayout>
            <DividerCard
                sxBackground={{
                    backgroundImage: `url(${drinks2})`,
                    backgroundPosition: 'center',
                }}
            >
                <Typography
                    color={'text.complimentary'}
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
            </DividerCard>
            {/* taps outside */}
            <HomeLayout
                sxBackground={{
                    backgroundImage: `url(${tapOutsideImage})`,
                    backgroundPosition: 'center',
                }}
            >
                <img
                    style={{ display: 'none' }}
                    src={tapOutsideImage}
                    alt="increase priority"
                />
                <Typography align="center" variant="h2" marked="center">
                    DJ's on Saturday nights.
                </Typography>
                <Typography
                    color="inherit"
                    align="center"
                    variant="h5"
                    sx={{ mb: 4, mt: { xs: 4, sm: 10 } }}
                >
                    Every Saturday dance from 8pm till midnight with us.
                </Typography>
            </HomeLayout>
            <DividerCard
                sxBackground={{
                    backgroundImage: `url(${drinks2})`,
                    backgroundPosition: 'center',
                }}
            >
                <Typography
                    color={'text.complimentary'}
                    align="center"
                    sx={{ typography: { xs: 'subtitle1', sm: 'h5' } }}
                    marked="center"
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
            </DividerCard>
            {/* wall inside */}
            <HomeLayout
                sxBackground={{
                    backgroundImage: `url(${wallInsideImage})`,
                    backgroundPosition: 'center',
                }}
            >
                <img
                    style={{ display: 'none' }}
                    src={wallInsideImage}
                    alt="increase priority"
                />
                <Typography align="center" variant="h2" marked="center">
                    SOMETHING ABOUT THE BAR
                </Typography>
                <Typography
                    color="inherit"
                    align="center"
                    variant="h5"
                    sx={{ mb: 4, mt: { xs: 4, sm: 10 } }}
                >
                    Ambience
                </Typography>
            </HomeLayout>
            {/* next info */}
            <DividerCard
                sxBackground={{
                    backgroundImage: `url(${drinks2})`,
                    backgroundPosition: 'center',
                }}
            >
                <Typography
                    color={'text.complimentary'}
                    align="center"
                    sx={{ typography: { xs: 'subtitle1', sm: 'h5' } }}
                ></Typography>
            </DividerCard>
            <HomeLayout
                sxBackground={{
                    backgroundImage: `url(${mural})`,
                    backgroundPosition: 'center',
                }}
            >
                <img
                    style={{ display: 'none' }}
                    src={backgroundImage}
                    alt="increase priority"
                />
                <Typography align="center" variant="h2" marked="center">
                    Info about hours
                </Typography>
                <Typography
                    color="inherit"
                    align="center"
                    variant="h5"
                    sx={{ mb: 4, mt: { xs: 4, sm: 10 } }}
                >
                    12-4pm food and whatever
                </Typography>
            </HomeLayout>
        </>
    );
}

export default Home;
