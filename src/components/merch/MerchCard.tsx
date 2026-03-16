import { useState } from 'react';
import type { MerchProduct } from '../../types/merch';
import { useCart } from '../../context/CartContext';
import SizeSelector from './SizeSelector';

interface MerchCardProps {
  product: MerchProduct;
}

export default function MerchCard({ product }: MerchCardProps) {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const { addItem } = useCart();

  const hasSizes = product.sizes && product.sizes.length > 0;
  const isDisabled = hasSizes && !selectedSize;

  const handleAddToCart = () => {
    addItem(product, selectedSize ?? undefined);
    setSelectedSize(null);
  };

  return (
    <div className="glass-card overflow-hidden">
      <div className="aspect-square bg-surface rounded-t-2xl overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="object-cover w-full h-full hover:scale-105 transition-transform duration-500"
        />
      </div>

      <div className="p-5">
        <h3 className="font-heading text-lg font-semibold">{product.name}</h3>
        <p className="text-primary text-xl font-bold">${product.price}</p>
        <p className="text-text-muted text-sm">{product.description}</p>

        {hasSizes && (
          <SizeSelector
            sizes={product.sizes!}
            selectedSize={selectedSize}
            onSelect={setSelectedSize}
          />
        )}

        <button
          onClick={handleAddToCart}
          disabled={isDisabled}
          className="btn-primary w-full mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
}
