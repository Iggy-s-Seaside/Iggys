import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    Wine,
    Beer,
    UtensilsCrossed,
    Tv,
    Star,
    Users,
    ChevronDown,
    Sparkles,
} from 'lucide-react';
import SectionHeader from '../components/layout/SectionHeader';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import { useEvents, useSpecials, useCocktails, useOnTap } from '../hooks/useMenuData';
import { images, drinkImages } from '../data/images';

function useHappyHourStatus() {
    const [status, setStatus] = useState(() => getHappyHourStatus());

    useEffect(() => {
        const interval = setInterval(
            () => setStatus(getHappyHourStatus()),
            60_000,
        );
        return () => clearInterval(interval);
    }, []);

    return status;
}

function getHappyHourStatus(): { label: string; isActive: boolean } {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const totalMinutes = hour * 60 + minute;

    const start = 15 * 60; // 3:00 PM
    const end = 17 * 60; // 5:00 PM

    if (totalMinutes >= start && totalMinutes < end) {
        return { label: 'Happy Hour is happening now!', isActive: true };
    }

    if (totalMinutes < start) {
        const diff = start - totalMinutes;
        if (diff <= 60) {
            return {
                label: `Happy Hour starts in ${diff} min`,
                isActive: false,
            };
        }
    }

    return { label: '3pm \u2013 5pm \u00b7 Every Single Day', isActive: false };
}

const features = [
    {
        icon: Wine,
        title: 'Handcrafted Cocktails',
        description:
            'Signature drinks made with premium spirits and fresh, local ingredients. From classics to originals — every sip is an experience.',
        link: '/cocktails',
        linkText: 'See the menu',
    },
    {
        icon: Beer,
        title: 'Local Craft Beers',
        description:
            'Oregon\u2019s finest on tap. We pour from the coast\u2019s best breweries including Fort George, Buoy Beer, and Public Coast.',
        link: '/beers',
        linkText: 'View draft list',
    },
    {
        icon: UtensilsCrossed,
        title: 'Pacific NW Seafood',
        description:
            'Seafood favorites served from Dooger\u2019s Seafood & Grill kitchen, connected right to the bar. Crab cakes, oysters, prawns, and more.',
        link: '/food',
        linkText: 'Browse the food',
    },
    {
        icon: Tv,
        title: 'Sports & Good Times',
        description:
            'Catch the game on our big screens. Indoor bar, lottery, and always good company.',
        link: '/about',
        linkText: 'Learn more',
    },
    {
        icon: Star,
        title: 'Daily Happy Hour',
        description:
            '$5 drafts, $5 wells, $3 cans — every single day from 3pm to 5pm. Rain or shine, we\u2019ve got the deals.',
        link: '/happy-hour',
        linkText: 'See deals',
    },
    {
        icon: Users,
        title: 'Private Events',
        description:
            'Host your next gathering at Iggy\u2019s. From birthdays to corporate events, our space and staff make it memorable.',
        link: '/contact',
        linkText: 'Book now',
    },
];

const FEATURED_COCKTAILS: {
    name: string;
    shortDesc: string;
    dbMatch: string;
}[] = [
    {
        name: 'Marionberry Mule',
        shortDesc: 'Marionberry vodka, ginger beer, fresh lime',
        dbMatch: 'marionberry mule',
    },
    {
        name: 'Burlini Espresso Martini',
        shortDesc: 'Vodka, Kahlua, local espresso, chocolate rim',
        dbMatch: 'burlini espresso martini',
    },
    {
        name: "Iggy's Old Fashioned",
        shortDesc: 'Bulleit rye, muddled orange & cherry, bitters',
        dbMatch: 'old fashion',
    },
    {
        name: 'Key Lime Pie Martini',
        shortDesc: 'Bumbu rum, vanilla vodka, lime, cream, pie crust rim',
        dbMatch: 'key lime pie',
    },
];

const seafoodItems = [
    { name: 'Crab Cakes', price: '$23' },
    { name: 'Oysters', price: '$20' },
    { name: 'Coconut Prawns', price: '$20' },
    { name: 'Steamer Clams', price: '$24' },
    { name: 'Calamari', price: '$18' },
    { name: 'Combination', price: '$24' },
];


export default function Home() {
    const featuresAnim = useScrollAnimation();
    const eventsAnim = useScrollAnimation();
    const cocktailsAnim = useScrollAnimation();
    const seafoodAnim = useScrollAnimation();
    const ctaAnim = useScrollAnimation();
    const beersAnim = useScrollAnimation();
    const happyHour = useHappyHourStatus();
    const { data: events } = useEvents();
    const { data: specials } = useSpecials();
    const { data: allCocktails } = useCocktails();
    const { data: onTapBeers } = useOnTap();
    const draftBeers = onTapBeers.slice(0, 4);
    const activeEvents = events.filter((e) => e.active).slice(0, 2);
    const activeSpecials = specials.filter((s) => s.active).slice(0, 2);

    // Pull prices from Supabase, use shortened ingredient descriptions
    const cocktailItems = FEATURED_COCKTAILS.map((featured) => {
        const match = allCocktails.find((c) =>
            c.name.trim().toLowerCase().includes(featured.dbMatch),
        );
        const price = match?.price?.startsWith('$')
            ? match.price
            : match
              ? `$${match.price}`
              : '';
        return { name: featured.name, price, desc: featured.shortDesc };
    }).filter((c) => c.price);

    return (
        <main>
            {/* ─── Hero Section ─── */}
            <section className="relative min-h-[85vh] md:min-h-screen overflow-hidden flex items-end">
                {/* Background image with parallax */}
                <div
                    className="absolute inset-0 bg-cover bg-bottom md:bg-center md:bg-fixed"
                    style={{
                        backgroundImage: 'url(/images/real_bar.jpg)',
                        willChange: 'transform',
                    }}
                />
                {/* Gradient: transparent top fading to solid dark at bottom */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-background" />

                {/* Content — pinned to the bottom */}
                <div className="relative z-10 w-full section-container pb-20 pt-40">
                    <div className="max-w-2xl">
                        {/* Logo */}
                        <img
                            src="/images/Iggys_hero.png"
                            alt="Iggy's"
                            className="h-20 md:h-28 lg:h-36 w-auto mb-4"
                            style={{
                                filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.9)) drop-shadow(0 0 5px rgba(255,255,255,0.5)) drop-shadow(0 0 15px rgba(45,212,191,0.6)) drop-shadow(0 0 30px rgba(45,212,191,0.3))',
                            }}
                        />
                        <h1 className="sr-only">Iggy's Seaside Bar</h1>

                        {/* Location in script font with amber accent */}
                        <p
                            className="font-display text-2xl md:text-3xl text-accent mb-4"
                            style={{ textShadow: '0 2px 12px rgba(0,0,0,0.7)' }}
                        >
                            Seaside, Oregon
                        </p>

                        {/* Gradient accent line */}
                        <div className="w-24 h-0.5 bg-gradient-to-r from-primary to-accent mb-6" />

                        {/* Tagline */}
                        <p
                            className="text-white/80 text-lg md:text-xl max-w-lg leading-relaxed"
                            style={{ textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}
                        >
                            Handcrafted cocktails, local craft beers &amp; fresh
                            Pacific Northwest seafood.
                        </p>

                        {/* CTA buttons */}
                        <div className="flex flex-wrap gap-4 mt-8">
                            <Link to="/cocktails" className="btn-primary-lg">
                                <Wine className="w-5 h-5" />
                                View Our Menu
                            </Link>
                            <Link to="/happy-hour" className="btn-outline-lg">
                                <Sparkles className="w-5 h-5" />
                                Happy Hour Deals
                            </Link>
                        </div>

                        {/* Minimal info line */}
                        <p className="text-white/50 text-sm mt-8 flex items-center gap-3 flex-wrap">
                            <span className="inline-flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-accent rounded-full" />
                                Open Daily 12pm&ndash;12am
                            </span>
                            <span className="w-px h-3 bg-white/20" />
                            <span>Happy Hour 3&ndash;5pm</span>
                            <span className="w-px h-3 bg-white/20" />
                            <a
                                href="https://maps.google.com/?q=200+S+Franklin+St,+Seaside,+OR+97138"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-primary transition-colors"
                            >
                                200 S Franklin St
                            </a>
                        </p>
                    </div>
                </div>

                {/* Scroll indicator */}
                <div className="absolute bottom-6 right-8 flex flex-col items-center gap-1 animate-bounce-slow text-white/30">
                    <ChevronDown className="w-4 h-4" />
                </div>
            </section>

            {/* ─── Happy Hour Banner ─── */}
            <section className="bg-surface py-6 border-y border-white/5">
                <div className="section-container">
                    <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
                        <span
                            className={`uppercase text-xs font-bold tracking-widest ${happyHour.isActive ? 'text-accent' : 'text-primary'}`}
                        >
                            {happyHour.isActive
                                ? 'Happy Hour Now'
                                : 'Happy Hour Daily'}
                        </span>
                        <span
                            className={`text-sm ${happyHour.isActive ? 'text-accent font-semibold' : 'text-text-muted'}`}
                        >
                            {happyHour.label}
                        </span>
                        <span className="hidden md:block w-px h-6 bg-white/10" />
                        <div className="flex flex-wrap gap-2">
                            {[
                                '$5 Draft Beer',
                                '$5 Well Drinks',
                                '$3 Canned Beer',
                                'Food Specials',
                            ].map((deal) => (
                                <span
                                    key={deal}
                                    className="text-text-muted text-sm px-3 py-1 rounded-full border border-white/10 bg-white/[0.03]"
                                >
                                    {deal}
                                </span>
                            ))}
                        </div>
                        <Link
                            to="/happy-hour"
                            className="btn-primary text-sm px-4 py-2"
                        >
                            See All Deals
                        </Link>
                    </div>
                </div>
            </section>

            {/* ─── Features Grid ─── */}
            <section className="section-padding section-container">
                <div
                    ref={featuresAnim.ref}
                    className={`transition-all duration-700 ${
                        featuresAnim.isVisible
                            ? 'opacity-100 translate-y-0'
                            : 'opacity-0 translate-y-8'
                    }`}
                >
                    <SectionHeader
                        eyebrow="What We Offer"
                        title="Every reason to stay awhile"
                        subtitle="From the covered patio upstairs to the fire pit right outside, Iggy's has something for everyone. Here's a taste of what makes us the coast's favorite gathering spot."
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
                        {features.map((feature) => (
                            <div
                                key={feature.title}
                                className="glass-card-hover p-6"
                            >
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary mb-4">
                                    <feature.icon className="w-6 h-6" />
                                </div>
                                <h3 className="font-heading text-lg font-semibold text-white">
                                    {feature.title}
                                </h3>
                                <p className="text-text-muted text-sm mt-2">
                                    {feature.description}
                                </p>
                                <Link
                                    to={feature.link}
                                    className="text-primary text-sm font-semibold mt-4 inline-flex items-center gap-1 hover:gap-2 transition-all"
                                >
                                    {feature.linkText}
                                    <span>&rarr;</span>
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Events & Specials Preview ─── */}
            {(activeEvents.length > 0 || activeSpecials.length > 0) && (
                <section className="section-padding bg-surface/30">
                    <div
                        ref={eventsAnim.ref}
                        className={`section-container transition-all duration-700 ${
                            eventsAnim.isVisible
                                ? 'opacity-100 translate-y-0'
                                : 'opacity-0 translate-y-8'
                        }`}
                    >
                        <SectionHeader
                            eyebrow="What's Happening"
                            title="Events & specials"
                            subtitle="Live music, drag shows, seasonal cocktails — there's always something going on."
                        />

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
                            {/* Events column */}
                            {activeEvents.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold tracking-widest uppercase text-primary/80 mb-2">
                                        Upcoming Events
                                    </h3>
                                    {activeEvents.map((event) => {
                                        const d = new Date(
                                            event.date + 'T00:00:00',
                                        );
                                        const month = d.toLocaleDateString(
                                            'en-US',
                                            { month: 'short' },
                                        );
                                        const day = d.getDate();
                                        return (
                                            <div
                                                key={event.id}
                                                className="glass-card-hover p-4 flex gap-4"
                                            >
                                                {/* Date badge */}
                                                <div className="shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-primary/10 border border-primary/20">
                                                    <span className="text-primary text-2xs font-bold uppercase">
                                                        {month}
                                                    </span>
                                                    <span className="text-white text-lg font-bold leading-none">
                                                        {day}
                                                    </span>
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="font-heading font-semibold text-white">
                                                        {event.title}
                                                    </h4>
                                                    <p className="text-text-muted text-sm">
                                                        {event.time}
                                                    </p>
                                                    {event.is_recurring && (
                                                        <span className="text-accent text-xs">
                                                            Every{' '}
                                                            {
                                                                event.recurring_day
                                                            }
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Specials column */}
                            {activeSpecials.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold tracking-widest uppercase text-accent/80 mb-2">
                                        Current Specials
                                    </h3>
                                    {activeSpecials.map((special) => (
                                        <div
                                            key={special.id}
                                            className="glass-card-hover p-4 flex items-start justify-between gap-3"
                                        >
                                            <div className="min-w-0">
                                                <h4 className="font-heading font-semibold text-white">
                                                    {special.title}
                                                </h4>
                                                <p className="text-text-muted text-sm mt-1 line-clamp-2">
                                                    {special.description}
                                                </p>
                                            </div>
                                            {special.price && (
                                                <span className="text-primary font-bold text-lg shrink-0">
                                                    {special.price}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mt-8 text-center">
                            <Link to="/events" className="btn-outline text-sm">
                                See all events &amp; specials &rarr;
                            </Link>
                        </div>
                    </div>
                </section>
            )}

            {/* ─── Cocktails Split Section ─── */}
            <section className="section-padding bg-surface/50">
                <div
                    ref={cocktailsAnim.ref}
                    className={`section-container transition-all duration-700 ${
                        cocktailsAnim.isVisible
                            ? 'opacity-100 translate-y-0'
                            : 'opacity-0 translate-y-8'
                    }`}
                >
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        {/* Left: Text */}
                        <div>
                            <div>
                                <p className="font-display text-accent text-xl mb-1">
                                    Crafted with care
                                </p>
                                <h2 className="font-heading text-3xl lg:text-4xl font-bold text-white">
                                    Cocktails worth talking about
                                </h2>
                                <p className="text-text-muted mt-4 max-w-2xl">
                                    Our bartenders don't just pour drinks — they
                                    craft experiences. Every cocktail on our
                                    menu is designed to surprise and delight.
                                </p>
                            </div>
                            <div className="mt-8 space-y-4">
                                {cocktailItems.map((item) => (
                                    <div
                                        key={item.name}
                                        className="flex items-start gap-3"
                                    >
                                        <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                                        <div>
                                            <span className="text-white font-semibold">
                                                {item.name}
                                            </span>
                                            <span className="text-primary ml-2 text-sm font-semibold">
                                                {item.price}
                                            </span>
                                            <p className="text-text-muted text-sm">
                                                {item.desc}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-4 mt-8">
                                <Link to="/cocktails" className="btn-primary">
                                    Full Cocktail Menu
                                </Link>
                                <Link to="/happy-hour" className="btn-outline">
                                    Happy Hour
                                </Link>
                            </div>
                        </div>
                        {/* Right: Image */}
                        <div>
                            <img
                                src={drinkImages[4]}
                                alt="Handcrafted cocktails at Iggy's"
                                className="rounded-2xl shadow-2xl w-full"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Seafood Split Section ─── */}
            <section className="section-padding">
                <div
                    ref={seafoodAnim.ref}
                    className={`section-container transition-all duration-700 ${
                        seafoodAnim.isVisible
                            ? 'opacity-100 translate-y-0'
                            : 'opacity-0 translate-y-8'
                    }`}
                >
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        {/* Left: Image (reversed order on md) */}
                        <div className="order-2 md:order-1">
                            <img
                                src={images.wineCrab}
                                alt="Seafood from Dooger's kitchen at Iggy's"
                                className="rounded-2xl shadow-2xl w-full"
                            />
                        </div>
                        {/* Right: Text */}
                        <div className="order-1 md:order-2">
                            <SectionHeader
                                align="left"
                                eyebrow="From Dooger's kitchen"
                                title="Dooger's menu, Iggy's atmosphere"
                                subtitle="We're connected to Dooger's Seafood & Grill, so you can enjoy Pacific Northwest seafood from Dooger's kitchen without leaving your barstool."
                            />
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-8">
                                {seafoodItems.map((item) => (
                                    <div
                                        key={item.name}
                                        className="glass-card p-4 text-center"
                                    >
                                        <p className="text-white font-semibold text-sm">
                                            {item.name}
                                        </p>
                                        <p className="text-primary font-bold mt-1">
                                            {item.price}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-8">
                                <Link to="/food" className="btn-primary">
                                    <UtensilsCrossed className="w-4 h-4" />
                                    View Full Food Menu
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── CTA Section ─── */}
            <section className="relative py-24 lg:py-32 overflow-hidden">
                <img
                    src={images.wallInside}
                    alt="Inside Iggy's Seaside Bar"
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-background/80" />
                <div
                    ref={ctaAnim.ref}
                    className={`relative z-10 section-container text-center flex flex-col items-center gap-6 transition-all duration-700 ${
                        ctaAnim.isVisible
                            ? 'opacity-100 translate-y-0'
                            : 'opacity-0 translate-y-8'
                    }`}
                >
                    <p className="font-display text-accent text-2xl md:text-3xl">
                        Rain or shine
                    </p>
                    <h2 className="font-heading text-3xl lg:text-5xl font-bold text-white mt-2">
                        A place for everyone
                    </h2>
                    <p className="text-text-muted max-w-xl text-lg">
                        Covered patio upstairs, fire pit outside, indoor bar.
                        Dogs welcome. Plenty of TVs for the game. Pick your
                        vibe.
                    </p>
                    <div className="flex flex-wrap gap-4 justify-center mt-4">
                        <Link to="/contact" className="btn-primary-lg">
                            <Users className="w-5 h-5" />
                            Book a Private Event
                        </Link>
                        <Link to="/about" className="btn-outline-lg">
                            Our Story
                        </Link>
                    </div>
                </div>
            </section>

            {/* ─── Draft Beers Preview ─── */}
            <section className="section-padding bg-surface/50">
                <div
                    ref={beersAnim.ref}
                    className={`section-container transition-all duration-700 ${
                        beersAnim.isVisible
                            ? 'opacity-100 translate-y-0'
                            : 'opacity-0 translate-y-8'
                    }`}
                >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-10">
                        <SectionHeader
                            align="left"
                            eyebrow="On Tap Now"
                            title="Draft beers on tap"
                        />
                        <Link
                            to="/beers"
                            className="btn-outline text-sm shrink-0"
                        >
                            <Beer className="w-4 h-4" />
                            View All Beers
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {draftBeers.map((beer) => (
                            <div
                                key={beer.id}
                                className="glass-card-hover p-6"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs uppercase tracking-wider text-primary font-semibold">
                                        {beer.type}
                                    </span>
                                    <span className="text-xs text-text-muted bg-white/5 px-2 py-0.5 rounded-full">
                                        {beer.abv}
                                    </span>
                                </div>
                                <h3 className="font-heading text-lg font-semibold text-white">
                                    {beer.name}
                                </h3>
                                <p className="text-text-muted text-sm mt-1">
                                    {beer.brewery}
                                </p>
                                <p className="text-primary font-bold mt-3 text-lg">
                                    {beer.price}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </main>
    );
}
