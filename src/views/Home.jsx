import DividerCard from '../components/DividerCard';
// import MuiCarousel from '../components/MuiCarousel';
// import Footer from '../components/Footer';
import info from '../assets/info';
import Weekends from '../components/Weekends';
import BarInfo from '../components/BarInfo';
import Hours from '../components/Hours';
import HeroMain from '../components/HeroMain';
import EventMain from '../components/EventMain';
const { welcome, varietySeating, enjoy } = info;

function Home() {
    return (
        <>
            <HeroMain />
            <DividerCard cardText={welcome} />
            <Hours />
            <DividerCard cardText={varietySeating} />
            <BarInfo />
            <DividerCard cardText={enjoy} />
            <EventMain />
            <DividerCard />
            {/* change to lottery card */}
            {/* <DividerCard cardText={sports} /> */}
            {/* <Weekends /> */}
            {/* <MuiCarousel /> */}
            {/* <Footer /> */}
        </>
    );
}

export default Home;
