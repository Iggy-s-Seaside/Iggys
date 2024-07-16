import HomeLayout from '../components/HomeLayout';
import imageUrls from '../assets/links';
import { Typography } from '@mui/material';
import info from '../assets/info';

const { jellyFish } = imageUrls;
const { about1, about2 } = info;

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
                    mt={20}
                    sx={{ typography: { xs: 'subtitle1', sm: 'h5' } }}
                >
                    {about1}
                </Typography>
                <Typography
                    color={'text.primary'}
                    align="center"
                    sx={{ typography: { xs: 'subtitle1', sm: 'h5' } }}
                >
                    {about2}
                </Typography>
            </HomeLayout>
        </>
    );
}
export default About;
