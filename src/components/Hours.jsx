import HomeLayout from './HomeLayout';
import { Typography } from '@mui/material';
import imageUrls from '../assets/links';
const { mural } = imageUrls;

function Hours() {
    return (
        <>
            <HomeLayout
                sxBackground={{
                    backgroundImage: `url(${mural})`,
                    backgroundPosition: 'center',
                }}
            >
                <img
                    style={{ display: 'none' }}
                    src={mural}
                    alt="increase priority"
                />
                <Typography align="center" variant="h2" marked="center">
                    Open 7 Days a Week!
                </Typography>
                <Typography
                    color="inherit"
                    align="center"
                    variant="h5"
                    sx={{ mb: 4, mt: { xs: 4, sm: 10 } }}
                >
                    12pm-12am
                </Typography>
            </HomeLayout>
        </>
    );
}

export default Hours;
