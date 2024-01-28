import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';

export default function VisMap() {
    const position = { lat: 45.99279, lng: -123.92522 };
    const key = import.meta.env.VITE_GOOGLE_API_KEY;

    return (
        <APIProvider apiKey={key}>
            <div style={{ height: '50vh', width: '100%' }}>
                <Map zoom={10} center={position}>
                    <Marker position={position}></Marker>
                </Map>
            </div>
        </APIProvider>
    );
}
