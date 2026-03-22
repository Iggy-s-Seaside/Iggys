import { ShoppingBag, Instagram } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';

export default function Shop() {
    return (
        <>
            <PageHeader
                eyebrow="Take a Piece Home"
                title="Iggy's Merch"
                subtitle="Rep the Oregon Coast's favorite bar"
            />

            <section className="section-padding">
                <div className="section-container">
                    <div className="glass-card p-12 md:p-16 text-center max-w-2xl mx-auto">
                        <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
                            <ShoppingBag className="w-10 h-10 text-primary" />
                        </div>
                        <h2 className="font-heading text-3xl font-bold text-white mb-4">
                            Coming Soon
                        </h2>
                        <p className="text-text-muted text-lg leading-relaxed mb-6">
                            We're getting our merch shop ready — tees, hoodies,
                            hats, and more. Check back soon or ask your bartender
                            about what's available in-house.
                        </p>
                        <p className="text-primary/60 text-sm mb-8">
                            Local pickup available at 200 S Franklin St, Seaside
                        </p>
                        <a
                            href="https://www.instagram.com/iggysseaside/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-outline"
                        >
                            <Instagram className="w-4 h-4" />
                            Follow for merch drops
                        </a>
                    </div>
                </div>
            </section>
        </>
    );
}
