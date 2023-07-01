import { Email, Instagram, Facebook } from '@mui/icons-material';
import { CardContent, Typography } from '@mui/material';
import StyledContactHeader from '../styled/StyledContactHeader';
import StyledCard from '../styled/StyledCard';
import StyledIconContainer from '../styled/StyledIconContainer';
import StyledIcon from '../styled/StyledIcon';
import Map from '../components/Map';

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
            <StyledCard>
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
                        color={'#2c2c2c'}
                        variant="body2"
                        align="center"
                    >
                        Address: 200 S Franklin St, Seaside, OR (97138)
                    </Typography>
                </CardContent>
            </StyledCard>
            <Map />
        </>
    );
};

export default Contact;
