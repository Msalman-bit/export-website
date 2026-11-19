/* Target markets from the brief. `code` is the ISO 3166-1 numeric code the world map uses.
   Every market starts as a target market; mark it established in Admin > Markets only after an
   order has been shipped there. */
export const MARKETS = [
  { code: '372', iso2: 'IE', name: 'Ireland', region: 'Ireland and the UK' },
  { code: '826', iso2: 'GB', name: 'United Kingdom', region: 'Ireland and the UK' },
  { code: '276', iso2: 'DE', name: 'Germany', region: 'Western Europe' },
  { code: '250', iso2: 'FR', name: 'France', region: 'Western Europe' },
  { code: '528', iso2: 'NL', name: 'Netherlands', region: 'Western Europe' },
  { code: '056', iso2: 'BE', name: 'Belgium', region: 'Western Europe' },
  { code: '442', iso2: 'LU', name: 'Luxembourg', region: 'Western Europe' },
  { code: '040', iso2: 'AT', name: 'Austria', region: 'Western Europe' },
  { code: '756', iso2: 'CH', name: 'Switzerland', region: 'Western Europe' },
  { code: '380', iso2: 'IT', name: 'Italy', region: 'Southern Europe' },
  { code: '724', iso2: 'ES', name: 'Spain', region: 'Southern Europe' },
  { code: '620', iso2: 'PT', name: 'Portugal', region: 'Southern Europe' },
  { code: '208', iso2: 'DK', name: 'Denmark', region: 'Scandinavia and the Nordics' },
  { code: '578', iso2: 'NO', name: 'Norway', region: 'Scandinavia and the Nordics' },
  { code: '752', iso2: 'SE', name: 'Sweden', region: 'Scandinavia and the Nordics' },
  { code: '246', iso2: 'FI', name: 'Finland', region: 'Scandinavia and the Nordics' },
  { code: '352', iso2: 'IS', name: 'Iceland', region: 'Scandinavia and the Nordics' },
  { code: '616', iso2: 'PL', name: 'Poland', region: 'Central Europe' },
  { code: '203', iso2: 'CZ', name: 'Czechia', region: 'Central Europe' },
  { code: '840', iso2: 'US', name: 'United States', region: 'North America' },
  { code: '124', iso2: 'CA', name: 'Canada', region: 'North America' },
];
