import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import CartDrawer from '../merch/CartDrawer';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Scroll to top and fade on route change
  useEffect(() => {
    setIsTransitioning(true);
    window.scrollTo(0, 0);
    const timer = setTimeout(() => setIsTransitioning(false), 20);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <CartDrawer />
      <main
        className={`flex-1 transition-opacity duration-200 ease-out ${
          isTransitioning ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {children}
      </main>
      <Footer />
    </div>
  );
}
