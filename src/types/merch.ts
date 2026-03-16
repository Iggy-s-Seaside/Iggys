export interface MerchProduct {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  sizes?: string[];
}

export interface CartItem {
  product: MerchProduct;
  size?: string;
  quantity: number;
}
