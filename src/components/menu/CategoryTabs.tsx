import React from 'react';

interface CategoryTabsProps {
  categories: string[];
  activeCategory: string;
  onSelect: (category: string) => void;
}

const CategoryTabs: React.FC<CategoryTabsProps> = ({
  categories,
  activeCategory,
  onSelect,
}) => {
  return (
    <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onSelect(category)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
            activeCategory === category
              ? 'bg-primary text-background'
              : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white'
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  );
};

export default CategoryTabs;
