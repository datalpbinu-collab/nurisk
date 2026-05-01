import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Input — reusable input field dengan label, error state, dan show/hide password
 */
const Input = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  error,
  hint,
  disabled,
  className = '',
  icon: Icon,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3 text-slate-400 pointer-events-none">
            <Icon size={16} />
          </div>
        )}
        <input
          type={inputType}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`
            w-full px-4 py-3 bg-slate-50 rounded-xl text-sm text-slate-800 font-medium
            border border-slate-200 outline-none transition-all
            focus:bg-white focus:border-[#006432] focus:ring-2 focus:ring-[#006432]/20
            disabled:opacity-60 disabled:cursor-not-allowed
            placeholder:text-slate-300
            ${Icon ? 'pl-10' : ''}
            ${isPassword ? 'pr-10' : ''}
            ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : ''}
          `}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
};

export default Input;
