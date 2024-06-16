import HomeLayout from './HomeLayout';
import { Typography } from '@mui/material';
import imageUrls from '../assets/links';
const { tapOutsideImage } = imageUrls;
import info from '../assets/info';
const { saturdays } = info;

function Weekends() {
    return (
        <>
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
                    {saturdays}
                </Typography>
            </HomeLayout>
        </>
    );
}

export default Weekends;
