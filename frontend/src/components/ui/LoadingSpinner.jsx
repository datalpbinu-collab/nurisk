import React from 'react';

const LoadingSpinner = ({ size = 'md', message }) => {
  const sizes = {
    sm: 'w-5 h-5 border-2',
    md: 'w-10 h-10 border-4',
    lg: 'w-16 h-16 border-4',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div
        className={`${sizes[size]} border-green-100 border-t-[#006432] rounded-full animate-spin`}
      />
      {message && (
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{message}</p>
      )}
    </div>
  );
};

export const FullPageLoader = ({ message = 'Memuat...' }) => (
  <div className="h-screen w-screen flex items-center justify-center bg-white">
    <LoadingSpinner size="md" message={message} />
  </div>
);

export default LoadingSpinner;
