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

export default Hours;
