import { Email, Instagram, Facebook } from '@mui/icons-material';
import LocalPhoneIcon from '@mui/icons-material/LocalPhone';
import { Box, Button, CardContent, Typography } from '@mui/material';
import StyledContactHeader from '../styled/StyledContactHeader';
import StyledCard from '../styled/StyledCard';
import StyledIconContainer from '../styled/StyledIconContainer';
import StyledIcon from '../styled/StyledIcon';
import Map from '../components/Map';
import imageUrls from '../assets/links';
import VisMap from '../components/VisMap';
import FormModal from '../components/FormModal';
import useModalContext from '../hooks/useModalContext';

const { barTop } = imageUrls;
const Contact = () => {
    const { handleOpen } = useModalContext();
    const handleEmailClick = () => {
        const recipient = 'Carnelinc@live.com';
        const subject = 'Inquiry about your services';
        const emailUrl = `mailto:${recipient}?subject=${encodeURIComponent(
            subject
        )}`;

        window.location.href = emailUrl;
    };

    const handleInstagramClick = () => {
        window.open('https://www.instagram.com/iggysseaside/', '_blank');
    };

    const handleFacebookClick = () => {
        window.open(
            'https://www.facebook.com/profile.php?id=100091456485116',
            '_blank'
        );
    };
    const handlePhoneClick = () => {
        const phoneNumber = '+15037380672';
        window.location.href = `tel:${phoneNumber}`;
    };
    return (
        <>
            <FormModal />
            <StyledCard
                sx={{
                    backgroundImage: `url(${barTop})`,
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                }}
            >
                <StyledContactHeader variant="h5">
                    We would love to hear from you!
                </StyledContactHeader>
                <StyledIconContainer>
                    <StyledIcon onClick={handleEmailClick}>
                        <Email />
                    </StyledIcon>
                    <StyledIcon onClick={handleInstagramClick}>
                        <Instagram />
                    </StyledIcon>
                    <StyledIcon onClick={handleFacebookClick}>
                        <Facebook />
                    </StyledIcon>
                    <StyledIcon onClick={handlePhoneClick}>
                        <LocalPhoneIcon />
                    </StyledIcon>
                </StyledIconContainer>
                <CardContent>
                    <Typography
                        color={'rgb(255,255,255)'}
                        variant="subtitle1"
                        align="center"
                        sx={{
                            fontWeight: 'bold',
                            letterSpacing: '1px',
                        }}
                    >
                        200 S Franklin St, Seaside, OR (97138)
                    </Typography>
                    <Box>
                        <Typography
                            color={'rgb(255,255,255)'}
                            variant="subtitle1"
                            align="center"
                            sx={{
                                fontWeight: 'bold',
                                letterSpacing: '1px',
                            }}
                        >
                            Need an event space? click below!
                        </Typography>
                        <Button
                            sx={{
                                margin: 'auto',
                                display: 'block',
                                opacity: 0.85,
                                fontSize: '1rem',
                                fontWeight: 'bold',
                            }}
                            size="small"
                            variant="contained"
                            onClick={handleOpen}
                        >
                            Event form
                        </Button>
                    </Box>
                </CardContent>
            </StyledCard>
            {/* <Map /> */}
            <VisMap />
        </>
    );
};

export default Contact;
