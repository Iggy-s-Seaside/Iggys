import React from 'react';

interface LoadingSkeletonProps {
  count?: number;
  variant?: 'card' | 'list';
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  count = 6,
  variant = 'card',
}) => {
  const skeletons = Array.from({ length: count }, (_, i) => i);

  if (variant === 'list') {
    return (
      <div className="space-y-4">
        {skeletons.map((i) => (
          <div key={i} className="glass-card p-6 animate-pulse">
            <div className="h-4 bg-white/10 rounded w-3/4 mb-3" />
            <div className="h-3 bg-white/10 rounded w-1/2 mb-2" />
            <div className="h-3 bg-white/10 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {skeletons.map((i) => (
        <div key={i} className="glass-card p-6 animate-pulse">
          <div className="h-4 bg-white/10 rounded w-3/4 mb-3" />
          <div className="h-3 bg-white/10 rounded w-1/2 mb-2" />
          <div className="h-3 bg-white/10 rounded w-1/3" />
        </div>
      ))}
    </div>
  );
};

export default LoadingSkeleton;
