import type { StructuredAddress } from '@/types/workspace';

export type PropertyVisualLocation = {
  latitude: number;
  longitude: number;
  streetViewPanorama?: {
    id: string;
    heading: number;
  };
};

/**
 * Google Geocoding capture for Wooldridge Court, 23 Margaret Road, OX3 8SE
 * on 2026-08-08. Presentation metadata only; it never replaces the selected
 * flat-level property identity.
 */
const WOOLDRIDGE_COURT_LOCATION: PropertyVisualLocation = {
  latitude: 51.757034,
  longitude: -1.2067029,
  // Verified against the Wooldridge Court Street View share URL.
  streetViewPanorama: {
    id: '0enTAwtmhjDRJxAbJZPEcg',
    heading: 331.72684,
  },
};

export function getPropertyVisualLocation(
  address: StructuredAddress | undefined,
): PropertyVisualLocation | null {
  if (
    address?.buildingName?.trim().toLocaleLowerCase() === 'wooldridge court' &&
    address.route?.trim().toLocaleLowerCase() === 'margaret road' &&
    address.postalCode?.trim().toLocaleUpperCase() === 'OX3 8SE'
  ) {
    return WOOLDRIDGE_COURT_LOCATION;
  }

  if (
    typeof address?.latitude === 'number' &&
    typeof address.longitude === 'number'
  ) {
    return { latitude: address.latitude, longitude: address.longitude };
  }

  return null;
}

function googleUrl(
  path: string,
  parameters: Record<string, string>,
  apiKey: string,
): string {
  return `https://maps.googleapis.com/maps/api/${path}?${new URLSearchParams({
    ...parameters,
    key: apiKey,
  }).toString()}`;
}

export function getGoogleStaticMapUrl(
  location: PropertyVisualLocation,
  mapType: 'roadmap' | 'satellite',
  apiKey: string,
): string {
  const point = `${location.latitude},${location.longitude}`;
  return googleUrl(
    'staticmap',
    {
      center: point,
      zoom: '18',
      size: '640x640',
      scale: '2',
      maptype: mapType,
      markers: `color:0x3B82F6|${point}`,
    },
    apiKey,
  );
}

export function getGoogleStreetViewMetadataUrl(
  location: PropertyVisualLocation,
  apiKey: string,
): string {
  return googleUrl(
    'streetview/metadata',
    { location: `${location.latitude},${location.longitude}` },
    apiKey,
  );
}

export function getGoogleStreetViewUrl(
  panoramaId: string,
  heading: number,
  apiKey: string,
): string {
  return googleUrl(
    'streetview',
    {
      size: '640x640',
      pano: panoramaId,
      fov: '90',
      heading: String(Math.round(heading)),
      pitch: '0',
    },
    apiKey,
  );
}

export function getBearingDegrees(
  from: PropertyVisualLocation,
  to: PropertyVisualLocation,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const y = Math.sin(longitudeDelta) * Math.cos(toLatitude);
  const x =
    Math.cos(fromLatitude) * Math.sin(toLatitude) -
    Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDelta);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
