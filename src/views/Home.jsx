import DividerCard from '../components/DividerCard';
import MuiCarousel from '../components/MuiCarousel';
import Footer from '../components/Footer';
import info from '../assets/info';
import Weekends from '../components/Weekends';
import BarInfo from '../components/BarInfo';
import Hours from '../components/Hours';
import HeroMain from '../components/HeroMain';
const { welcome, varietySeating } = info;

function Home() {
    return (
        <>
            <HeroMain />
            <DividerCard cardText={welcome} />
            <Weekends />
            <DividerCard cardText={varietySeating} />
            <BarInfo />
            <DividerCard cardText={'Football Football Football'} />
            <Hours />
            <DividerCard cardText={'Hand Crafted Cocktails'} />
            <MuiCarousel />
            <Footer />
        </>
    );
}

export default Home;
