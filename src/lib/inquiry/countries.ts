/* Destination countries offered on the forms: the target markets first, then the rest of Europe and
   North America, then "Other". */
export const COUNTRIES: { code: string; name: string }[] = [
  { code: 'IE', name: 'Ireland' }, { code: 'GB', name: 'United Kingdom' }, { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' }, { code: 'IT', name: 'Italy' }, { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' }, { code: 'BE', name: 'Belgium' }, { code: 'LU', name: 'Luxembourg' },
  { code: 'AT', name: 'Austria' }, { code: 'CH', name: 'Switzerland' }, { code: 'PT', name: 'Portugal' },
  { code: 'DK', name: 'Denmark' }, { code: 'NO', name: 'Norway' }, { code: 'SE', name: 'Sweden' },
  { code: 'FI', name: 'Finland' }, { code: 'IS', name: 'Iceland' }, { code: 'PL', name: 'Poland' },
  { code: 'CZ', name: 'Czechia' }, { code: 'SK', name: 'Slovakia' }, { code: 'HU', name: 'Hungary' },
  { code: 'SI', name: 'Slovenia' }, { code: 'HR', name: 'Croatia' }, { code: 'RO', name: 'Romania' },
  { code: 'BG', name: 'Bulgaria' }, { code: 'GR', name: 'Greece' }, { code: 'CY', name: 'Cyprus' },
  { code: 'MT', name: 'Malta' }, { code: 'EE', name: 'Estonia' }, { code: 'LV', name: 'Latvia' },
  { code: 'LT', name: 'Lithuania' }, { code: 'US', name: 'United States' }, { code: 'CA', name: 'Canada' },
  { code: 'OTHER', name: 'Other country' },
];

export const countryName = (code: string) => COUNTRIES.find((c) => c.code === code)?.name ?? code;
