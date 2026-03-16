export interface MenuItem {
  name: string;
  description?: string;
  price: string;
  options?: { label: string; price: string }[];
}

export interface MenuCategory {
  title: string;
  eyebrow: string;
  note?: string;
  items: MenuItem[];
}

export const specialItems: MenuItem[] = [
  {
    name: 'Buffalo Chicken Wings',
    description: '',
    price: '',
    options: [
      { label: '6pc', price: '$6' },
      { label: '12pc', price: '$12' },
    ],
  },
  {
    name: 'Cod Fish Tacos (grilled or fried)',
    description:
      'Served on corn tortillas with shredded cabbage, chipotle aioli, queso fresco, and housemade pico de gallo',
    price: '',
    options: [
      { label: '2 tacos', price: '$12' },
      { label: '3 tacos', price: '$16' },
    ],
  },
];

export const doogersMenu: MenuCategory[] = [
  {
    title: 'Chowder & Soups',
    eyebrow: 'Soups',
    items: [
      {
        name: 'Clam Chowder',
        description: 'A Seaside classic',
        price: '',
        options: [
          { label: 'Cup', price: '$6' },
          { label: 'Bowl', price: '$10' },
          { label: 'Bread Bowl', price: '$15' },
        ],
      },
      {
        name: 'Vegetable Soup',
        description: '',
        price: '',
        options: [
          { label: 'Cup', price: '$5' },
          { label: 'Bowl', price: '$7' },
        ],
      },
    ],
  },
  {
    title: 'Appetizers',
    eyebrow: 'Starters',
    note: 'Served with garlic toast',
    items: [
      { name: 'Coconut Prawns', description: '', price: '$19' },
      { name: 'Prawn Cocktail', description: '', price: '$18' },
      { name: 'Crab Cocktail', description: '', price: 'Market Price' },
      { name: 'Clam Strips', description: '', price: '$15' },
      {
        name: 'Calamari',
        description: 'Lightly coated & fried',
        price: '$17',
      },
      {
        name: 'Oysters',
        description: 'Lightly coated, fried or pan fried',
        price: '$19',
      },
      {
        name: 'Crab Cakes',
        description: 'Pan fried, topped with Hollandaise sauce & a crab leg',
        price: '$22',
      },
      {
        name: 'Prawns',
        description: 'Fried, sautéed or Cajun',
        price: '$20',
      },
      { name: 'Ahi Tuna', description: 'Served rare', price: '$18' },
      { name: 'Scallops', description: '', price: '$20' },
      {
        name: 'Crab Legs',
        description: 'De-shelled Dungeness; fried or sautéed',
        price: 'Market Price',
      },
      {
        name: 'Razor Clams',
        description: 'Fried or pan fried',
        price: 'Market Price',
      },
      {
        name: 'Steamer Clams',
        description: '1½ lbs — wine, garlic, served with garlic toast',
        price: '$23',
      },
      {
        name: 'Combination',
        description:
          'Salmon, cod, oysters, scallops, calamari and prawns; lightly coated & fried',
        price: '$23',
      },
    ],
  },
  {
    title: 'Sandwiches',
    eyebrow: 'Lunch',
    note: 'All sandwiches include choice of fries, sweet potato fries, tater tots, or coleslaw. Add soup or salad for $4 (until 4pm)',
    items: [
      { name: 'Fish Sandwich (Haddock)', description: '', price: '$18' },
      { name: 'Halibut Sandwich', description: '', price: '$23' },
      { name: 'Grilled Salmon Sandwich', description: '', price: '$21' },
      { name: 'Albacore Tuna Reuben', description: '', price: '$18' },
      { name: 'Oyster Sandwich', description: '', price: '$19' },
      { name: 'Shrimp Sandwich', description: '', price: '$16' },
      {
        name: 'Dooger Burger',
        description:
          '7oz patty with ham or bacon, Tillamook Cheddar, lettuce, tomato, onion & mayo',
        price: '$18',
      },
      { name: 'Crab Sandwich', description: '', price: 'Market Price' },
      { name: 'Grilled Cheese', description: '', price: '$13' },
      { name: 'Black & Blu Burger', description: '', price: '$17' },
      { name: 'Garden Burger', description: '', price: '$15' },
      { name: 'Hamburger', description: '', price: '$15' },
      { name: 'Cheeseburger', description: '', price: '$16' },
      { name: 'Steak Sandwich', description: '', price: '$23' },
      { name: 'BLT', description: '', price: '$15' },
      {
        name: 'Carnwich',
        description:
          "Dooger's trademark — a grilled cheese with two chicken strips inside",
        price: '$15',
      },
      { name: 'Grilled Chicken Breast', description: '', price: '$17' },
      { name: 'Turkey Sandwich', description: '', price: '$17' },
      { name: 'Club Sandwich', description: '', price: '$17' },
    ],
  },
  {
    title: 'Fish & Chips',
    eyebrow: 'Fried Fresh',
    note: 'Lightly coated & fried. All dinners include green salad with shrimp or clam chowder cup, garlic toast, and choice of sides',
    items: [
      {
        name: 'Cod',
        description: '',
        price: '',
        options: [
          { label: '2pc', price: '$21' },
          { label: '3pc', price: '$25' },
        ],
      },
      {
        name: 'Haddock',
        description: '',
        price: '',
        options: [
          { label: '2pc', price: '$21' },
          { label: '3pc', price: '$25' },
        ],
      },
      {
        name: 'Halibut',
        description: '',
        price: '',
        options: [
          { label: '2pc', price: '$24' },
          { label: '3pc', price: '$28' },
        ],
      },
      {
        name: 'Salmon',
        description: '',
        price: '',
        options: [
          { label: '2pc', price: '$24' },
          { label: '3pc', price: '$28' },
        ],
      },
      {
        name: 'Tuna',
        description: '',
        price: '',
        options: [
          { label: '2pc', price: '$22' },
          { label: '3pc', price: '$26' },
        ],
      },
    ],
  },
  {
    title: 'Seafood Dinners',
    eyebrow: 'Entrées',
    note: 'Served all day. All dinners include green salad with shrimp or clam chowder cup, garlic toast, and choice of sides',
    items: [
      {
        name: 'Calamari (Squid)',
        description: 'Lightly coated & fried',
        price: '$28',
      },
      {
        name: 'Petrale Sole',
        description: 'Lightly coated & pan fried',
        price: '$30',
      },
      {
        name: 'Halibut',
        description: 'Pan fried, Cajun style, sautéed or grilled',
        price: 'Market Price',
      },
      {
        name: 'Salmon',
        description: 'Sautéed, poached, pan fried or Cajun style',
        price: 'Market Price',
      },
      {
        name: 'Ahi Tuna',
        description: 'Grilled to perfection',
        price: '$28',
      },
      {
        name: 'Oysters',
        description: 'Coated, pan fried, deep fried, or Cajun style',
        price: '$33',
      },
      {
        name: 'Sea Scallops',
        description: 'Lightly coated & fried, sautéed or Cajun style',
        price: '$33',
      },
      { name: 'Steamer Clams', description: '2 lbs', price: '$34' },
      {
        name: 'Prawns',
        description: 'Fried, sautéed or Cajun style',
        price: '',
        options: [
          { label: '5pc', price: '$28' },
          { label: '8pc', price: '$36' },
          { label: '12pc', price: '$44' },
        ],
      },
      {
        name: 'Combination Plate',
        description:
          'Salmon, fish, oysters, scallops, calamari and prawns; lightly coated & fried',
        price: '$35',
      },
      {
        name: "Admiral's Plate",
        description:
          'Salmon, cod, scallops, crab legs, razor clams, calamari and prawns; lightly coated & fried',
        price: 'Market Price',
      },
      {
        name: 'Crab Cakes',
        description: 'Topped with hollandaise sauce and a crab leg',
        price: '',
        options: [
          { label: '2pc', price: '$30' },
          { label: '3pc', price: '$37' },
        ],
      },
      {
        name: 'Crab Legs',
        description:
          'De-shelled Dungeness; fried, sautéed, steamed, Cajun style or chilled',
        price: 'Market Price',
      },
      {
        name: 'Razor Clams',
        description: 'Lightly coated and fried or pan fried',
        price: 'Market Price',
      },
      {
        name: 'Lobster Tail',
        description: 'Succulent cold water tail',
        price: 'Market Price',
      },
    ],
  },
  {
    title: 'Steaks',
    eyebrow: 'From the Grill',
    items: [
      {
        name: 'Filet Mignon',
        description: '7oz tenderloin wrapped in bacon',
        price: '$40',
      },
      {
        name: 'Rib Eye Steak',
        description: '10oz cut',
        price: '$40',
      },
      {
        name: 'Burger Steak',
        description: 'Special seasonings, with onion, grilled to perfection',
        price: '$23',
      },
    ],
  },
  {
    title: 'Surf & Turf',
    eyebrow: 'Best of Both',
    note: 'Choice of 7oz tenderloin or 10oz ribeye',
    items: [
      {
        name: 'With Seafood',
        description: 'Prawns, scallops, oysters, calamari, or salmon',
        price: '$50',
      },
      {
        name: 'With Crab Legs',
        description: '',
        price: 'Market Price',
      },
      {
        name: 'With Lobster',
        description: '',
        price: 'Market Price',
      },
    ],
  },
  {
    title: 'Salads',
    eyebrow: 'Fresh',
    note: 'Served with garlic toast',
    items: [
      { name: 'Vegan Salad', description: '', price: '$21' },
      { name: 'Shrimp Louie', description: '', price: '$22' },
      {
        name: 'Grilled Chicken Salad',
        description: 'Topped with diced almonds & parmesan cheese',
        price: '$23',
      },
      { name: 'Crab Louie', description: '', price: 'Market Price' },
      {
        name: 'Smoked Salmon Salad',
        description: 'Topped with Swiss cheese',
        price: '$23',
      },
    ],
  },
  {
    title: 'Pasta',
    eyebrow: 'Homemade',
    note: 'Linguini in alfredo sauce. Served with salad and garlic toast',
    items: [
      { name: 'Plain', description: '', price: '$20' },
      { name: 'Chicken', description: '', price: '$26' },
      { name: 'Shrimp or Smoked Salmon', description: '', price: '$28' },
      { name: 'Seafood', description: '', price: '$30' },
      { name: 'Crab', description: '', price: 'Market Price' },
    ],
  },
  {
    title: 'Sides',
    eyebrow: 'Extras',
    items: [
      { name: 'Baked Potato', description: '', price: '$6' },
      { name: 'Cole Slaw', description: '', price: '$5' },
      { name: 'Side Salad', description: '', price: '$7' },
      { name: 'Rice', description: '', price: '$6' },
      {
        name: 'French Fries, Sweet Potato Fries, or Tater Tots',
        description: 'Cajun add $1',
        price: '$6',
      },
      { name: 'Garlic Toast', description: '', price: '$0.50' },
      { name: 'Steamed Vegetables', description: '', price: '$8' },
      { name: 'Linguini Alfredo (side)', description: '', price: '$11' },
    ],
  },
  {
    title: 'Desserts',
    eyebrow: 'Sweet Finish',
    items: [
      {
        name: 'Homemade Key Lime Pie',
        description: '',
        price: '$7',
      },
      {
        name: 'Homemade Peanut Butter Pie',
        description: 'On a chocolate crust',
        price: '$7',
      },
      {
        name: 'Homemade Strawberry Cream Cheese Pie',
        description: '',
        price: '$7',
      },
      { name: 'Chocolate Fudge Cake', description: '', price: '$9' },
      {
        name: 'Deep Dish Apple Crisp or Marionberry Cobbler',
        description: 'À la mode add $2',
        price: '$12',
      },
      {
        name: 'Ice Cream',
        description: 'Sugar-free available',
        price: '',
        options: [
          { label: 'Single', price: '$3' },
          { label: 'Double', price: '$6' },
        ],
      },
    ],
  },
];
