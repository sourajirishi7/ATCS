import React, { createContext, useContext } from 'react';

export type Currency = 'INR';

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  toggleCurrency: () => void;
  currencySymbol: string;
  exchangeRate: number;
  formatCurrency: (
    amountInInr: number | null | undefined,
    options?: { decimals?: number; compact?: boolean }
  ) => string;
  convertAmount: (amountInInr: number) => number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const currency: Currency = 'INR';
  const currencySymbol = '₹';

  const setCurrency = (_c: Currency) => {
    // Locked to INR as per strict requirements
  };

  const toggleCurrency = () => {
    // Locked to INR
  };

  const convertAmount = (amountInInr: number): number => {
    if (!amountInInr || isNaN(amountInInr)) return 0;
    return amountInInr;
  };

  const formatCurrency = (
    amountInInr: number | null | undefined,
    options?: { decimals?: number; compact?: boolean }
  ): string => {
    if (amountInInr === null || amountInInr === undefined || isNaN(amountInInr)) {
      return '₹0';
    }

    if (options?.compact) {
      if (Math.abs(amountInInr) >= 10000000) {
        return `₹${(amountInInr / 10000000).toFixed(1)}Cr`;
      }
      if (Math.abs(amountInInr) >= 100000) {
        return `₹${(amountInInr / 100000).toFixed(1)}L`;
      }
      if (Math.abs(amountInInr) >= 1000) {
        return `₹${(amountInInr / 1000).toFixed(0)}k`;
      }
    }

    const decimals = options?.decimals !== undefined ? options.decimals : 0;
    return `₹${amountInInr.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        toggleCurrency,
        currencySymbol,
        exchangeRate: 1,
        formatCurrency,
        convertAmount,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = (): CurrencyContextType => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
