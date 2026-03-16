/**
 * Create `events` and `specials` tables in Supabase + seed sample data.
 *
 * Run once:  node scripts/setup-tables.mjs
 *
 * Uses the Supabase REST API directly (anon key is fine for inserts;
 * table creation must be done via the Supabase dashboard SQL editor).
 *
 * ── STEP 1 ──
 * Run the SQL below in the Supabase SQL editor (Dashboard → SQL Editor → New query):
 *
 * CREATE TABLE IF NOT EXISTS events (
 *   id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 *   created_at timestamptz DEFAULT now(),
 *   title text NOT NULL,
 *   description text NOT NULL,
 *   date date NOT NULL,
 *   time text NOT NULL,
 *   image_url text,
 *   is_recurring boolean DEFAULT false,
 *   recurring_day text,
 *   active boolean DEFAULT true
 * );
 *
 * CREATE TABLE IF NOT EXISTS specials (
 *   id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 *   created_at timestamptz DEFAULT now(),
 *   title text NOT NULL,
 *   description text NOT NULL,
 *   type text NOT NULL,
 *   price text,
 *   image_url text,
 *   active boolean DEFAULT true
 * );
 *
 * -- Enable RLS but allow public reads
 * ALTER TABLE events ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE specials ENABLE ROW LEVEL SECURITY;
 *
 * CREATE POLICY "Allow public read" ON events FOR SELECT USING (true);
 * CREATE POLICY "Allow public read" ON specials FOR SELECT USING (true);
 *
 * ── STEP 2 ──
 * Then run this script to seed sample data:
 *   node scripts/setup-tables.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nouxyrqpulkbjusriugx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vdXh5cnFwdWxrYmp1c3JpdWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODYyNTY0MjEsImV4cCI6MjAwMTgzMjQyMX0.XxWv8TRE8kRLQdxP5RbJjbffgkr4x8X1z85YDXEaTy8';
const STORAGE = `${SUPABASE_URL}/storage/v1/object/public/images`;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seed() {
  console.log('Seeding events...');
  const { error: eventsError } = await supabase.from('events').insert([
    {
      title: 'DJ Night',
      description: 'Live DJ spinning house, hip-hop, and good vibes. Come dance the night away at Iggy\'s.',
      date: '2026-03-21',
      time: '9pm - 12am',
      image_url: `${STORAGE}/djnight.jpeg`,
      is_recurring: false,
      recurring_day: null,
      active: true,
    },
    {
      title: 'Slay Drag Show',
      description: 'Seaside\'s favorite drag show! Amazing performances, themed nights, and unforgettable energy every Saturday.',
      date: '2026-03-21',
      time: '9pm - 11pm',
      image_url: `${STORAGE}/Slay_close.jpg`,
      is_recurring: true,
      recurring_day: 'Saturday',
      active: true,
    },
    {
      title: 'Live Music Friday',
      description: 'Local artists performing live acoustic sets. Grab a cocktail and enjoy the vibes.',
      date: '2026-03-27',
      time: '7pm - 10pm',
      image_url: `${STORAGE}/show_up.jpg`,
      is_recurring: false,
      recurring_day: null,
      active: true,
    },
  ]);

  if (eventsError) {
    console.error('Error seeding events:', eventsError.message);
  } else {
    console.log('Events seeded successfully!');
  }

  console.log('Seeding specials...');
  const { error: specialsError } = await supabase.from('specials').insert([
    {
      title: 'Marionberry Mule Season',
      description: 'Our signature Marionberry Mule made with fresh Oregon marionberries, vodka, and ginger beer. A Pacific Northwest classic.',
      type: 'drink',
      price: '$11',
      image_url: `${STORAGE}/DRINK_6614.jpg`,
      active: true,
    },
    {
      title: 'Crab Cake Special',
      description: 'Fresh Dungeness crab cakes served with house-made aioli and seasonal greens. While supplies last.',
      type: 'food',
      price: '$18',
      image_url: null,
      active: true,
    },
    {
      title: 'Spring Spritz',
      description: 'Light and refreshing elderflower spritz with prosecco and fresh citrus. Perfect for sunny patio days.',
      type: 'seasonal',
      price: '$13',
      image_url: null,
      active: true,
    },
  ]);

  if (specialsError) {
    console.error('Error seeding specials:', specialsError.message);
  } else {
    console.log('Specials seeded successfully!');
  }
}

seed();
