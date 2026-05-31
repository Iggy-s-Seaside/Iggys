import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Beers from './pages/Beers';
import Cocktails from './pages/Cocktails';
import Food from './pages/Food';
import HappyHour from './pages/HappyHour';
import NonAlcoholic from './pages/NonAlcoholic';
import Shop from './pages/Shop';
import Events from './pages/Events';
import About from './pages/About';
import Contact from './pages/Contact';
import BookEvent from './pages/BookEvent';
import NotFound from './pages/NotFound';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/beers" element={<Beers />} />
        <Route path="/cocktails" element={<Cocktails />} />
        <Route path="/food" element={<Food />} />
        <Route path="/happy-hour" element={<HappyHour />} />
        <Route path="/non-alcoholic" element={<NonAlcoholic />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/events" element={<Events />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/book" element={<BookEvent />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

export default App;
