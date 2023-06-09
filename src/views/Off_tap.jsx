import { useEffect, useState } from 'react';
import { getOffTap } from '../services/off_tap';
import BeerCard from '../components/BeerCard';

function Off_tap() {
    const [items, setItems] = useState([]);
    useEffect(() => {
        const getData = async () => {
            const data = await getOffTap();
            setItems(data);
        };
        getData();
    }, []);

    return (
        <>
            <div>
                {items.map((item) => {
                    if (item.type.includes('IPA')) {
                        return <BeerCard key={item.id} item={item} />;
                    }
                })}
            </div>
        </>
    );
}

export default Off_tap;
