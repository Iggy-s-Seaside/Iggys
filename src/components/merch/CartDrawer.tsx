import { X, Trash2, ShoppingBag, Minus, Plus } from 'lucide-react';
import { useCart } from '../../context/CartContext';

export default function CartDrawer() {
  const {
    items,
    removeItem,
    updateQuantity,
    totalPrice,
    isCartOpen,
    setIsCartOpen,
  } = useCart();

  if (!isCartOpen) return null;

  const handleCheckout = () => {
    alert('Stripe checkout coming soon!');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setIsCartOpen(false)}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-surface h-full animate-slide-in-right flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="font-heading text-xl font-semibold">Your Cart</h2>
          <button
            onClick={() => setIsCartOpen(false)}
            className="text-text-muted hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-text-muted">
              <ShoppingBag size={48} className="mb-4 opacity-50" />
              <p className="text-lg">Your cart is empty</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li
                  key={`${item.product.id}-${item.size ?? 'no-size'}`}
                  className="flex items-center gap-4 rounded-xl bg-white/5 p-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{item.product.name}</p>
                    {item.size && (
                      <p className="text-text-muted text-sm">Size: {item.size}</p>
                    )}
                    <p className="text-primary font-bold">
                      ${(item.product.price * item.quantity).toFixed(2)}
                    </p>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        updateQuantity(item.product.id, item.size, item.quantity - 1)
                      }
                      className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-6 text-center text-sm font-medium">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateQuantity(item.product.id, item.size, item.quantity + 1)
                      }
                      className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeItem(item.product.id, item.size)}
                    className="text-text-muted hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-6 border-t border-white/10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-text-muted">Total</span>
              <span className="text-xl font-bold text-primary">
                ${totalPrice.toFixed(2)}
              </span>
            </div>
            <button onClick={handleCheckout} className="btn-primary w-full">
              Checkout with Stripe
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
