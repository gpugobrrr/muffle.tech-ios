import type { StructuredAddress } from '@/types/workspace';

/**
 * Captured from Loqate Find/Retrieve responses for OX3 8SE on 2026-08-08.
 * This intentionally static development fixture must not refresh at runtime.
 */
export const DEMO_POSTCODE = 'OX3 8SE';

export type DemoAddressSelection = {
  id: string;
  type: 'Address';
  text: string;
  description: string;
  isContainer: false;
  address: StructuredAddress;
};

export const DEMO_OX3_8SE_ADDRESSES: readonly DemoAddressSelection[] = [
  {
    id: 'GB|RM|B|28651397|ENG',
    type: 'Address',
    text: 'Flat 1 Wooldridge Court Margaret Road',
    description: 'Headington Oxford OX3 8SE',
    isContainer: false,
    address: {
      placeId: 'GB|RM|B|28651397|ENG',
      formattedAddress:
        'Flat 1, Wooldridge Court, Margaret Road, Headington, Oxford, Oxfordshire, OX3 8SE, United Kingdom',
      line1: 'Flat 1',
      line2: 'Wooldridge Court',
      line3: 'Margaret Road',
      line4: 'Headington',
      buildingName: 'Wooldridge Court',
      subBuildingName: 'Flat 1',
      route: 'Margaret Road',
      locality: 'Headington',
      townOrCity: 'Oxford',
      administrativeArea: 'Oxfordshire',
      postalCode: DEMO_POSTCODE,
      country: 'United Kingdom',
      countryCode: 'GB',
    },
  },
  {
    id: 'GB|RM|B|28651411|ENG',
    type: 'Address',
    text: 'Flat 15 Wooldridge Court Margaret Road',
    description: 'Headington Oxford OX3 8SE',
    isContainer: false,
    address: {
      placeId: 'GB|RM|B|28651411|ENG',
      formattedAddress:
        'Flat 15, Wooldridge Court, Margaret Road, Headington, Oxford, Oxfordshire, OX3 8SE, United Kingdom',
      line1: 'Flat 15',
      line2: 'Wooldridge Court',
      line3: 'Margaret Road',
      line4: 'Headington',
      buildingName: 'Wooldridge Court',
      subBuildingName: 'Flat 15',
      route: 'Margaret Road',
      locality: 'Headington',
      townOrCity: 'Oxford',
      administrativeArea: 'Oxfordshire',
      postalCode: DEMO_POSTCODE,
      country: 'United Kingdom',
      countryCode: 'GB',
    },
  },
  {
    id: 'GB|RM|B|51061611|ENG',
    type: 'Address',
    text: 'Flat 29A Wooldridge Court Margaret Road',
    description: 'Headington Oxford OX3 8SE',
    isContainer: false,
    address: {
      placeId: 'GB|RM|B|51061611|ENG',
      formattedAddress:
        'Flat 29A, Wooldridge Court, Margaret Road, Headington, Oxford, Oxfordshire, OX3 8SE, United Kingdom',
      line1: 'Flat 29A',
      line2: 'Wooldridge Court',
      line3: 'Margaret Road',
      line4: 'Headington',
      buildingName: 'Wooldridge Court',
      subBuildingName: 'Flat 29A',
      route: 'Margaret Road',
      locality: 'Headington',
      townOrCity: 'Oxford',
      administrativeArea: 'Oxfordshire',
      postalCode: DEMO_POSTCODE,
      country: 'United Kingdom',
      countryCode: 'GB',
    },
  },
];
