import { Email, Instagram, Facebook } from '@mui/icons-material';
import { CardContent, Typography } from '@mui/material';
import StyledContactHeader from '../styled/StyledContactHeader';
import StyledCard from '../styled/StyledCard';
import StyledIconContainer from '../styled/StyledIconContainer';
import StyledIcon from '../styled/StyledIcon';
import Map from '../components/Map';
import imageUrls from '../assets/links';
import VisMap from '../components/VisMap';

const { barTop } = imageUrls;
const Contact = () => {
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

    return (
        <>
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
                </CardContent>
            </StyledCard>
            {/* <Map /> */}
            <VisMap />
        </>
    );
};

export default Contact;
