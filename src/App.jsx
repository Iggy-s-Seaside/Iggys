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

const router = createBrowserRouter(
    createRoutesFromElements(
        <Route path="/" element={<Root />}>
            <Route path="/" element={<Home />} />
            <Route path="beers" element={<Beers />} />
            <Route path="cocktails" element={<Cocktails />} />
            <Route path="appetizers" element={<Appetizers />} />
            <Route path="contact" element={<Contact />} />
            <Route path="about" element={<About />} />
        </Route>
    )
);

function App() {
    return (
        <>
            <RouterProvider router={router} />
        </>
    );
}

export default App;
