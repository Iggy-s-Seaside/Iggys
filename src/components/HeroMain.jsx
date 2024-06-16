import HomeLayout from './HomeLayout';
import { Typography } from '@mui/material';
import imageUrls from '../assets/links';
const { backgroundImage } = imageUrls;
function HeroMain() {
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
                    Welcome to Iggy's!
                </Typography>
                {/* <Typography
                    color="inherit"
                    align="center"
                    variant="h5"
                    sx={{ mb: 4, mt: { xs: 4, sm: 10 } }}
                >
                    {welcome}
                </Typography> */}
            </HomeLayout>
        </>
    );
}

export default HeroMain;
