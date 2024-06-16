import HomeLayout from './HomeLayout';
import { Typography } from '@mui/material';
import imageUrls from '../assets/links';
const { wallInsideImage } = imageUrls;

function BarInfo() {
    return (
        <>
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

export default BarInfo;
