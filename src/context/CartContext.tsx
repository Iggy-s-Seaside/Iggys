import { createContext, useContext, useState, type ReactNode } from 'react';
import type { CartItem, MerchProduct } from '../types/merch';

interface CartContextType {
  items: CartItem[];
  addItem: (product: MerchProduct, size?: string) => void;
  removeItem: (productId: string, size?: string) => void;
  updateQuantity: (productId: string, size: string | undefined, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const addItem = (product: MerchProduct, size?: string) => {
    setItems(prev => {
      const existing = prev.find(
        item => item.product.id === product.id && item.size === size
      );
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id && item.size === size
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, size, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const removeItem = (productId: string, size?: string) => {
    setItems(prev =>
      prev.filter(item => !(item.product.id === productId && item.size === size))
    );
  };

  const updateQuantity = (productId: string, size: string | undefined, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId, size);
      return;
    }
    setItems(prev =>
      prev.map(item =>
        item.product.id === productId && item.size === size
          ? { ...item, quantity }
          : item
      )
    );
  };

  const clearCart = () => setItems([]);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
