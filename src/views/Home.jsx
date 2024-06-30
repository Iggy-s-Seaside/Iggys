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
            <Hours />
            <DividerCard cardText={varietySeating} />
            <BarInfo />
            <DividerCard
                cardText={
                    'Sports everyday! Come enjoy the game with your friends, and banter with your rivals!'
                }
            />
            <Weekends />
            <DividerCard
                cardText={
                    'Enjoy unique Hand Crafted Cocktails made from fresh ingredients!'
                }
            />
            {/* <MuiCarousel /> */}
            <Footer />
        </>
    );
}

export default Home;
