import { Typography } from '@mui/material';
import HomeLayout from '../components/HomeLayout';

const backgroundImage =
    'https://nouxyrqpulkbjusriugx.supabase.co/storage/v1/object/public/images/iggybuilding.jpg';

function Home() {
    return (
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
    );
}

export default Home;
