import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';

const VideoContainer = styled.div`
    position: relative;
    width: 100%;
    height: 0;
    padding-bottom: 56.25%; /* 16:9 aspect ratio */
`;

const VideoElement = styled.iframe`
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
`;

const Overlay = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.4);
`;

const ContentContainer = styled.div`
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #fff;
    z-index: 1;
`;

const Video = ({ videoSrc, children }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        const player = new window.Vimeo.Player(videoRef.current, {
            controls: false, // Hide the controls
        });

        player.setAutopause(false); // Prevent the player from pausing when another Vimeo player starts

        player.play(); // Start playing the video automatically

        player.on('ended', () => {
            player.play(); // Restart the video when it ends
        });

        player.play(); // Start playing the video automatically
    }, []);

    return (
        <VideoContainer>
            <VideoElement
                ref={videoRef}
                src={videoSrc}
                frameborder="0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowfullscreen
                title="video"
            ></VideoElement>
            <Overlay />
            <ContentContainer>{children}</ContentContainer>
        </VideoContainer>
    );
};

Video.propTypes = {
    videoSrc: PropTypes.string.isRequired,
    children: PropTypes.node,
};

export default Video;
