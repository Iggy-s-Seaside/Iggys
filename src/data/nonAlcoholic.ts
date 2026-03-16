export interface NonAlcoholicItem {
  name: string;
  description?: string;
  price: string;
}

export interface NonAlcoholicCategory {
  title: string;
  subtitle: string;
  accentColor: string;
  items: NonAlcoholicItem[];
}

export const nonAlcoholicData: NonAlcoholicCategory[] = [
  {
    title: 'Non-Alcoholic Beer',
    subtitle: 'All the flavor, none of the buzz',
    accentColor: 'primary',
    items: [
      { name: 'Heineken N/A', description: 'Classic lager taste', price: '$6.00' },
      { name: 'Best Day Kolsch', description: 'Light and crisp', price: '$6.00' },
      { name: 'Best Day West Coast IPA', description: 'Hoppy and bold', price: '$6.00' },
    ],
  },
  {
    title: 'Sodas & Juices',
    subtitle: 'Fresh and refreshing',
    accentColor: 'accent',
    items: [
      { name: 'Pepsi / Diet Pepsi / Starry / Dr Pepper / Root Beer', price: '$3.00' },
      { name: 'Orange / Cranberry / Pineapple Juice', price: '$3.00' },
      { name: 'Lemonade', price: '$3.00' },
      { name: 'Cock n Bull Ginger Beer', price: '$4.00' },
    ],
  },
  {
    title: 'Coffee & Tea',
    subtitle: 'Locally sourced warmth',
    accentColor: 'amber',
    items: [
      { name: 'Iced Tea', description: 'House-brewed', price: '$3.00' },
      { name: 'Coffee', description: 'Local Seaside roast', price: '$3.00' },
      { name: 'Espresso', description: 'Used in cold mixed drinks — ask your bartender!', price: '$4.00' },
    ],
  },
];
