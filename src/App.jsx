import {
    Route,
    RouterProvider,
    createBrowserRouter,
    createRoutesFromElements,
} from 'react-router-dom';
import Root from './components/Root';
import Beers from './views/Beers';
import Home from './views/Home';
import Cocktails from './views/Cocktails';
import Appetizers from './views/Appetizers';
import Contact from './views/Contact';
import About from './views/About';
import HappyHour from './views/HappyHour';
import Na from './views/Na';
import Footer from './components/Footer';

const router = createBrowserRouter(
    createRoutesFromElements(
        <Route path="/" element={<Root />}>
            <Route path="/" element={<Home />} />
            <Route path="beers" element={<Beers />} />
            <Route path="cocktails" element={<Cocktails />} />
            <Route path="na" element={<Na />} />
            <Route path="appetizers" element={<Appetizers />} />
            <Route path="contact" element={<Contact />} />
            <Route path="about" element={<About />} />
            <Route path="happy_hour" element={<HappyHour />} />
        </Route>
    )
);

function App() {
    return (
        <>
            <RouterProvider router={router} />
            {/* <Footer />  */}
        </>
    );
}

export default App;
