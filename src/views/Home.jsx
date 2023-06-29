import { Typography } from '@mui/material';
import HomeLayout from '../components/HomeLayout';
import imageUrls from '../assets/links';
import DividerCard from '../components/DividerCard';
import Video from '../components/Video';

const { backgroundImage, wallInsideImage, tapOutsideImage, drinks2 } =
    imageUrls;
const videoSource = 'https://player.vimeo.com/video/840745031?h=580c906346';

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
                    variant="h5"
                >
                    Lorem ipsum dolor sit amet consectetur adipisicing elit. Id,
                    nihil? Lorem ipsum dolor sit amet consectetur adipisicing
                    elit. Libero, officiis.
                </Typography>
            </DividerCard>
            <Video videoSrc={videoSource}>
                <Typography color={'text.complimentary'} variant="h2">
                    Look we can do videos also.
                </Typography>
            </Video>
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
                    SOMETHING ABOUT EVENTS
                </Typography>
                <Typography
                    color="inherit"
                    align="center"
                    variant="h5"
                    sx={{ mb: 4, mt: { xs: 4, sm: 10 } }}
                >
                    Dj dance dj dance
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
                    variant="h5"
                    marked="center"
                >
                    Lorem ipsum dolor sit amet consectetur adipisicing elit. Id,
                    nihil? Lorem ipsum dolor sit amet consectetur adipisicing
                    elit. Libero, officiis.
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
        </>
    );
}

export default Home;
