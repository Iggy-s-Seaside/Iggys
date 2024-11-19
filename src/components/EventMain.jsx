import HomeLayout from './HomeLayout';
import imageUrls from '../assets/links';
import { Button, Typography } from '@mui/material';
import ButtonLink from './ButtonLink';

const { showUp } = imageUrls;

function EventMain() {
    return (
        <>
            <HomeLayout
                sxBackground={{
                    backgroundImage: `url(${showUp})`,
                    backgroundPosition: 'center',
                }}
            >
                <img
                    style={{ display: 'none' }}
                    src={showUp}
                    alt="increase priority"
                />
                <Typography align="center" variant="h3" marked="center">
                    Looking for a venue for your private event?
                </Typography>
                <Typography align="center" variant="h6" marked="center">
                    Inquire about our hosting services! Enjoy handcrafted
                    cocktails from Iggy's and catered meals from Dooger's
                    restaurant.
                </Typography>
                {/* change link to form page */}
                <ButtonLink to="/about" variant="contained">
                    Click here to submit your info!
                </ButtonLink>
            </HomeLayout>
        </>
    );
}

export default EventMain;
