import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';

export default function VisMap() {
    const position = { lat: 45.99279, lng: -123.92522 };
    const key = import.meta.env.VITE_GOOGLE_API_KEY;

    const openGoogleMaps = () => {
        const url = `https://www.google.com/maps/search/?api=1&query=${position.lat},${position.lng}`;
        window.open(url, '_blank');
    };

    return (
        <APIProvider apiKey={key}>
            <div style={{ height: '50vh', width: '100%' }}>
                <Map zoom={19} center={position}>
                    <Marker
                        title={'Take me there!'}
                        position={position}
                        onClick={openGoogleMaps}
                    ></Marker>
                </Map>
            </div>
        </APIProvider>
    );
}
