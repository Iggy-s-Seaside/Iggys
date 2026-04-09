export interface MenuItem {
  name: string;
  description?: string;
  price: string;
  options?: { label: string; price: string }[];
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
