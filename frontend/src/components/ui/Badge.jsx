import React from 'react';

/**
 * Badge — status badge untuk incidents dan data lainnya
 */
const Badge = ({ label, variant = 'default', pulse = false, className = '' }) => {
  const variants = {
    default:   'bg-slate-100 text-slate-600',
    reported:  'bg-slate-100 text-slate-500',
    verified:  'bg-blue-100 text-blue-700',
    assessment:'bg-yellow-100 text-yellow-700',
    commanded: 'bg-orange-100 text-orange-700',
    responded: 'bg-green-100 text-green-700',
    completed: 'bg-emerald-100 text-emerald-700',
    critical:  'bg-red-100 text-red-700',
    active:    'bg-green-100 text-green-700',
    info:      'bg-blue-100 text-blue-700',
    warning:   'bg-amber-100 text-amber-700',
  };

  return (
    <span className={`
      inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
      ${variants[variant] || variants.default}
      ${pulse ? 'animate-pulse' : ''}
      ${className}
    `}>
      {label}
    </span>
  );
};

export const statusToBadge = (status = '') => {
  const s = status.toLowerCase();
  if (s === 'reported') return 'reported';
  if (s === 'verified') return 'verified';
  if (s === 'assessment') return 'assessment';
  if (s === 'commanded') return 'commanded';
  if (s === 'responded') return 'responded';
  if (s === 'completed' || s === 'closed') return 'completed';
  return 'default';
};

export default Badge;
