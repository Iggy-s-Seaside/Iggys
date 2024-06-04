import { Typography } from '@mui/material';
import HomeLayout from '../components/HomeLayout';
import imageUrls from '../assets/links';
import DividerCard from '../components/DividerCard';
import MuiCarousel from '../components/MuiCarousel';
// import Slider from '../components/Slider';

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
                    New Specials something something something.
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
                    INCREDIBLE AWESOME AMAZING HOLY MOLY
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
                >
                    FOOTBALL FOOTBALL FOOTBALL
                </Typography>
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
            <HomeLayout>
                <MuiCarousel />
                {/* <Slider /> */}
            </HomeLayout>
        </>
    );
}

export default Home;
