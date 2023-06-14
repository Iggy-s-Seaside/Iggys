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

    const typeLoop = (type, item) => {
        if (item.type.toLowerCase().includes(type)) {
            return <BeerCard key={item.id} item={item} />;
        }
    };

    return (
        <>
            <div>
                <h1>IPA</h1>
                {items.map((item) => typeLoop('ipa', item))}
            </div>
            <div>
                <h1>Lager</h1>
                {items.map((item) => typeLoop('lager', item))}
            </div>
            <div>
                <h1>Pilsner</h1>
                {items.map((item) => typeLoop('pilsner', item))}
            </div>
            <div>
                <h1>Hard Cider</h1>
                {items.map((item) => typeLoop('cider', item))}
            </div>
            <div>
                <h1>Hard Seltzer</h1>
                {items.map((item) => typeLoop('seltzer', item))}
            </div>
            <div>
                <h1>Stout</h1>
                {items.map((item) => typeLoop('stout', item))}
            </div>
        </>
    );
}

export default Off_tap;
