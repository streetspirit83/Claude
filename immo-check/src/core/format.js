const DE = 'de-DE';

export const eur = (n, digits = 0) =>
  n === null || n === undefined || Number.isNaN(n)
    ? '–'
    : new Intl.NumberFormat(DE, {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(n);

export const pct = (n, digits = 1) =>
  n === null || n === undefined || Number.isNaN(n)
    ? '–'
    : `${new Intl.NumberFormat(DE, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)} %`;

export const zahl = (n, digits = 1) =>
  n === null || n === undefined || Number.isNaN(n)
    ? '–'
    : new Intl.NumberFormat(DE, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);

export const qm = (n) => (n ? `${zahl(n, 0)} m²` : '–');

export const jahre = (n) => (n === null || n === undefined ? '–' : `${zahl(n, 0)} Jahre`);
