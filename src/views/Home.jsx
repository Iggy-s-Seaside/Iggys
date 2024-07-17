import DividerCard from '../components/DividerCard';
// import MuiCarousel from '../components/MuiCarousel';
// import Footer from '../components/Footer';
import info from '../assets/info';
import Weekends from '../components/Weekends';
import BarInfo from '../components/BarInfo';
import Hours from '../components/Hours';
import HeroMain from '../components/HeroMain';
const { welcome, varietySeating, sports, enjoy } = info;

function Home() {
    return (
        <>
            <HeroMain />
            <DividerCard cardText={welcome} />
            <Hours />
            <DividerCard cardText={varietySeating} />
            <BarInfo />
            {/* change to lottery card */}
            <DividerCard cardText={sports} />
            <Weekends />
            <DividerCard cardText={enjoy} />
            {/* <MuiCarousel /> */}
            {/* <Footer /> */}
        </>
    );
}

export default Home;
