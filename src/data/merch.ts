import type { MerchProduct } from '../types/merch';

export const merchProducts: MerchProduct[] = [
  {
    id: 'classic-tee',
    name: "Iggy's Classic Tee",
    price: 28,
    description: '100% cotton, unisex fit. Rep Iggy\'s wherever you go.',
    image: '/images/merch-tshirt.png',
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  },
  {
    id: 'logo-hoodie',
    name: "Iggy's Logo Hoodie",
    price: 55,
    description: 'Cozy pullover hoodie. Perfect for those Oregon Coast evenings.',
    image: '/images/merch-hoodie.png',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
  },
  {
    id: 'snapback-hat',
    name: "Iggy's Snapback Hat",
    price: 30,
    description: 'Adjustable snapback. One size fits most.',
    image: '/images/merch-hat.png',
  },
];
