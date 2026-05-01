import React from 'react';

/**
 * Card — reusable card container
 * @param {string} className - additional classes
 * @param {boolean} hoverable - adds hover effect
 * @param {string} accent - 'left' adds a colored left border
 */
const Card = ({ children, className = '', hoverable = false, accent, onClick }) => {
  const base = 'bg-white rounded-2xl border border-slate-100 shadow-sm';
  const hover = hoverable ? 'hover:shadow-md hover:border-slate-200 transition-all duration-200 cursor-pointer' : '';
  const accentClass = accent === 'green' ? 'border-l-4 border-l-[#006432]'
    : accent === 'red' ? 'border-l-4 border-l-red-500'
    : accent === 'yellow' ? 'border-l-4 border-l-yellow-500'
    : '';

  return (
    <div
      onClick={onClick}
      className={`${base} ${hover} ${accentClass} ${className}`}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '' }) => (
  <div className={`px-5 py-4 border-b border-slate-100 ${className}`}>{children}</div>
);

export const CardBody = ({ children, className = '' }) => (
  <div className={`p-5 ${className}`}>{children}</div>
);

export const CardFooter = ({ children, className = '' }) => (
  <div className={`px-5 py-3 border-t border-slate-100 bg-slate-50 rounded-b-2xl ${className}`}>{children}</div>
);

export default Card;
