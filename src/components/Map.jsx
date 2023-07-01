import { useEffect, useState, useMemo } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';

function Map() {
    const containerStyle = {
        width: '100%',
        height: '400px',
    };

    const key = import.meta.env.VITE_GOOGLE_API_KEY;

    const center = useMemo(
        () => ({
            lat: 45.99279,
            lng: -123.92522,
        }),
        []
    );

    const [map, setMap] = useState(null);
    const [marker, setMarker] = useState(null);

    const onLoad = (map) => {
        setMap(map);
    };

    useEffect(() => {
        if (map) {
            const marker = new window.google.maps.Marker({
                position: center,
                map: map,
                title: 'Center Marker',
            });

            setMarker(marker);
        }
    }, [map, center]);

    return (
        <>
            <LoadScript googleMapsApiKey={key}>
                <GoogleMap
                    mapContainerStyle={containerStyle}
                    center={center}
                    zoom={20}
                    onLoad={onLoad}
                >
                    {marker && (
                        <Marker position={center} title="Center Marker" />
                    )}
                </GoogleMap>
            </LoadScript>
        </>
    );
}

export default Map;
