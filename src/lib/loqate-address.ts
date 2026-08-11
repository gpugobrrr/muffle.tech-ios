import { Platform } from 'react-native';

import type { StructuredAddress } from '@/types/workspace';

const FIND_URL = 'https://api.addressy.com/Capture/Interactive/Find/v1.10/json3.ws';
const RETRIEVE_URL =
  'https://api.addressy.com/Capture/Interactive/Retrieve/v1.20/json3.ws';
const apiKey = process.env.EXPO_PUBLIC_LOQATE_API_KEY?.trim();

type LoqateErrorPayload = {
  Error?: string;
  Description?: string;
  Cause?: string;
  Resolution?: string;
};

type LoqateFindItem = {
  Id?: string;
  Type?: string;
  Text?: string;
  Description?: string;
  Highlight?: string;
  Cursor?: number;
};

type LoqateFindResponse = LoqateErrorPayload & {
  Items?: LoqateFindItem[];
};

type LoqateRetrieveItem = {
  Id?: string;
  BuildingNumber?: string;
  BuildingName?: string;
  SubBuilding?: string;
  Street?: string;
  SecondaryStreet?: string;
  District?: string;
  City?: string;
  PostalCode?: string;
  Province?: string;
  CountryName?: string;
  CountryIso2?: string;
  Line1?: string;
  Line2?: string;
  Line3?: string;
  Line4?: string;
  Line5?: string;
  Latitude?: number;
  Longitude?: number;
};

type LoqateRetrieveResponse = LoqateErrorPayload & {
  Items?: LoqateRetrieveItem[];
};

export type LoqateSuggestion = {
  id: string;
  type: string;
  text: string;
  description: string;
  isContainer: boolean;
};

type LoqateRequestContext = {
  operation: 'find' | 'retrieve';
  postcode: string;
  endpoint: string;
};

export class LoqateRequestError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly endpoint: string;
  readonly providerError?: string;
  readonly providerDescription?: string;
  readonly providerCause?: string;
  readonly providerResolution?: string;

  constructor(
    response: Response,
    endpoint: string,
    payload: LoqateErrorPayload,
  ) {
    super(
      payload.Description ??
        payload.Error ??
        `Loqate request failed with ${response.status}`,
    );
    this.name = 'LoqateRequestError';
    this.status = response.status;
    this.statusText = response.statusText;
    this.endpoint = endpoint;
    this.providerError = payload.Error;
    this.providerDescription = payload.Description;
    this.providerCause = payload.Cause;
    this.providerResolution = payload.Resolution;
  }
}

export class LoqateProviderError extends Error {
  readonly providerError?: string;
  readonly providerDescription?: string;
  readonly providerCause?: string;
  readonly providerResolution?: string;

  constructor(payload: LoqateErrorPayload) {
    super(payload.Description ?? payload.Error ?? 'Loqate returned an error');
    this.name = 'LoqateProviderError';
    this.providerError = payload.Error;
    this.providerDescription = payload.Description;
    this.providerCause = payload.Cause;
    this.providerResolution = payload.Resolution;
  }
}

export function hasLoqateConfiguration(): boolean {
  return Boolean(apiKey);
}

export function loqateConfigurationMessage(): string {
  return 'Loqate API key is not configured';
}

function safeEndpoint(operation: 'find' | 'retrieve'): string {
  return operation === 'find' ? FIND_URL : RETRIEVE_URL;
}

function buildRequestUrl(
  endpoint: string,
  parameters: Record<string, string>,
): string {
  return `${endpoint}?${new URLSearchParams({
    Key: apiKey ?? '',
    ...parameters,
  }).toString()}`;
}

async function readPayload(response: Response): Promise<LoqateErrorPayload> {
  try {
    return (await response.json()) as LoqateErrorPayload;
  } catch {
    return {};
  }
}

function assertNoProviderError(payload: LoqateErrorPayload): void {
  if (payload.Error || payload.Description) {
    throw new LoqateProviderError(payload);
  }
}

async function requestJson<T extends LoqateErrorPayload>(
  operation: 'find' | 'retrieve',
  postcode: string,
  parameters: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  if (!apiKey) throw new Error(loqateConfigurationMessage());

  const endpoint = safeEndpoint(operation);
  if (__DEV__) {
    console.warn('[loqate] request started', {
      platform: Platform.OS,
      operation,
      postcode,
      keyPresent: true,
      endpoint,
    });
  }

  const response = await fetch(buildRequestUrl(endpoint, parameters), { signal });
  if (__DEV__) {
    console.warn('[loqate] response received', {
      platform: Platform.OS,
      operation,
      responseReceived: true,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      endpoint,
    });
  }
  if (!response.ok) {
    throw new LoqateRequestError(response, endpoint, await readPayload(response));
  }

  let payload: T;
  try {
    payload = (await response.json()) as T;
  } catch {
    throw new Error('Loqate returned a malformed JSON response');
  }
  assertNoProviderError(payload);
  return payload;
}

export function logLoqateError(
  error: unknown,
  context: LoqateRequestContext & { aborted?: boolean },
): void {
  if (!__DEV__) return;

  const base = {
    platform: Platform.OS,
    ...context,
    keyPresent: Boolean(apiKey),
  };
  if (error instanceof LoqateRequestError) {
    console.warn('[loqate] HTTP request failed', {
      ...base,
      responseReceived: true,
      status: error.status,
      statusText: error.statusText,
      error: error.providerError,
      description: error.providerDescription,
      cause: error.providerCause,
      resolution: error.providerResolution,
    });
    return;
  }
  if (error instanceof LoqateProviderError) {
    console.warn('[loqate] provider request failed', {
      ...base,
      responseReceived: true,
      error: error.providerError,
      description: error.providerDescription,
      cause: error.providerCause,
      resolution: error.providerResolution,
    });
    return;
  }
  console.warn('[loqate] network or parse request failed', {
    ...base,
    responseReceived: false,
    errorName: error instanceof Error ? error.name : undefined,
    message: error instanceof Error ? error.message : String(error),
  });
}

export function getLoqateDevelopmentMessage(
  error: unknown,
  operation: 'Find' | 'Retrieve',
  postcode: string,
): string {
  if (error instanceof LoqateRequestError) {
    return `${operation} failed for ${postcode}: HTTP ${error.status}${
      error.statusText ? ` ${error.statusText}` : ''
    }${error.providerDescription ? ` — ${error.providerDescription}` : ''}`;
  }
  if (error instanceof LoqateProviderError) {
    return `${operation} failed for ${postcode}: ${error.message}`;
  }
  return `${operation} failed for ${postcode}: ${
    error instanceof Error ? error.message : String(error)
  }`;
}

export async function findLoqateAddresses(
  postcode: string,
  containerId?: string | null,
  signal?: AbortSignal,
): Promise<LoqateSuggestion[]> {
  const payload = await requestJson<LoqateFindResponse>(
    'find',
    postcode,
    {
      Text: postcode,
      Countries: 'GBR',
      ...(containerId ? { Container: containerId } : {}),
    },
    signal,
  );
  if (!Array.isArray(payload.Items)) {
    throw new Error('Loqate Find response did not contain an Items array');
  }

  return payload.Items.map((item) => {
    const id = item.Id?.trim();
    const type = item.Type?.trim() ?? '';
    const text = item.Text?.trim() ?? '';
    if (!id || !text) {
      throw new Error('Loqate Find returned an item without an Id or Text');
    }
    return {
      id,
      type,
      text,
      description: item.Description?.trim() ?? '',
      isContainer: type.toLowerCase() === 'container',
    };
  });
}

function joinAddressLines(lines: Array<string | undefined>): string {
  return lines
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line))
    .join(', ');
}

export function normalizeLoqateAddress(
  item: LoqateRetrieveItem,
): StructuredAddress {
  const line1 =
    item.Line1?.trim() ||
    joinAddressLines([
      item.SubBuilding,
      item.BuildingNumber,
      item.BuildingName,
      item.Street,
    ]);
  const formattedAddress = joinAddressLines([
    line1,
    item.Line2,
    item.Line3,
    item.Line4,
    item.Line5,
    item.District,
    item.City,
    item.Province,
    item.PostalCode,
    item.CountryName,
  ]);
  if (!formattedAddress) {
    throw new Error('Loqate Retrieve did not include usable address lines');
  }

  return {
    placeId: item.Id?.trim(),
    formattedAddress,
    line1,
    line2: item.Line2?.trim(),
    line3: item.Line3?.trim(),
    line4: item.Line4?.trim(),
    streetNumber: item.BuildingNumber?.trim(),
    buildingName: item.BuildingName?.trim(),
    subBuildingName: item.SubBuilding?.trim(),
    route: item.Street?.trim(),
    locality: item.District?.trim(),
    townOrCity: item.City?.trim(),
    administrativeArea: item.Province?.trim(),
    postalCode: item.PostalCode?.trim(),
    country: item.CountryName?.trim(),
    countryCode: item.CountryIso2?.trim(),
    latitude: item.Latitude,
    longitude: item.Longitude,
  };
}

export async function retrieveLoqateAddress(
  id: string,
  postcode: string,
  signal?: AbortSignal,
): Promise<StructuredAddress> {
  const payload = await requestJson<LoqateRetrieveResponse>(
    'retrieve',
    postcode,
    { Id: id },
    signal,
  );
  const item = payload.Items?.[0];
  if (!item) {
    throw new Error('Loqate Retrieve response did not contain an address');
  }
  return normalizeLoqateAddress(item);
}
