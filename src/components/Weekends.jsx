import HomeLayout from './HomeLayout';
import { Typography } from '@mui/material';
import imageUrls from '../assets/links';
const { nightOutside } = imageUrls;
import info from '../assets/info';
const { saturdays } = info;

function Weekends() {
    return (
        <>
            <HomeLayout
                sxBackground={{
                    backgroundImage: `url(${nightOutside})`,
                    backgroundPosition: 'center',
                }}
            >
                <img
                    style={{ display: 'none' }}
                    src={nightOutside}
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
