import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import {
  getBearingDegrees,
  getGoogleStaticMapUrl,
  getGoogleStreetViewMetadataUrl,
  getGoogleStreetViewUrl,
  getPropertyVisualLocation,
} from '@/lib/property-visuals';
import { getCompactPropertyLabel } from '@/lib/property-label';
import type { ActiveProperty } from '@/types/workspace';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

const PAGES = [
  { key: 'map', label: 'MAP' },
  { key: 'satellite', label: 'SATELLITE' },
  { key: 'streetView', label: 'STREET VIEW' },
] as const;

type VisualPageKey = (typeof PAGES)[number]['key'];
type StreetViewStatus = 'idle' | 'loading' | 'available' | 'unavailable';

type Props = {
  property: ActiveProperty;
  onBack: () => void;
  onContinue: () => void;
};

function debugPropertyVisuals(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, boolean | number | string | undefined>,
) {
  // #region agent log
  fetch('http://127.0.0.1:7813/ingest/ca8d7e88-ef04-4769-995f-1e0c4537104f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9b7a65'},body:JSON.stringify({sessionId:'9b7a65',runId:'initial',hypothesisId,location,message,data,timestamp:Date.now()})}).catch(()=>{});
  // #endregion
}

export function PropertyVisualsScreen({
  property,
  onBack,
  onContinue,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const location = getPropertyVisualLocation(property.address);
  const [activeIndex, setActiveIndex] = useState(0);
  const [visited, setVisited] = useState<Set<VisualPageKey>>(
    () => new Set(['map']),
  );
  const [failedPages, setFailedPages] = useState<Set<VisualPageKey>>(
    () => new Set(),
  );
  const [streetViewStatus, setStreetViewStatus] =
    useState<StreetViewStatus>('idle');
  const [streetViewPanorama, setStreetViewPanorama] = useState<{
    id: string;
    heading: number;
  } | null>(null);
  const streetViewRequested = useRef(false);

  useEffect(() => {
    // #region agent log
    debugPropertyVisuals('H1,H3', 'property-visuals-screen.tsx:60', 'visuals screen initialized', {
      hasGoogleMapsKey: Boolean(GOOGLE_MAPS_API_KEY),
      hasVisualLocation: Boolean(location),
    });
    // #endregion
  }, [location]);

  useEffect(() => {
    const activePage = PAGES[activeIndex]?.key;
    if (activePage) {
      setVisited((current) =>
        current.has(activePage)
          ? current
          : new Set([...current, activePage]),
      );
    }
  }, [activeIndex]);

  useEffect(() => {
    if (
      activeIndex !== 2 ||
      !location ||
      !GOOGLE_MAPS_API_KEY ||
      location.streetViewPanorama ||
      streetViewRequested.current
    ) {
      return;
    }

    streetViewRequested.current = true;
    const controller = new AbortController();
    setStreetViewStatus('loading');
    void fetch(getGoogleStreetViewMetadataUrl(location, GOOGLE_MAPS_API_KEY), {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          status?: string;
          pano_id?: string;
          location?: { lat?: number; lng?: number };
        };
        // #region agent log
        debugPropertyVisuals('H2,H4', 'property-visuals-screen.tsx:100', 'street-view metadata response', {
          httpOk: response.ok,
          providerStatus: payload.status,
        });
        // #endregion
        if (
          !response.ok ||
          payload.status !== 'OK' ||
          !payload.pano_id ||
          typeof payload.location?.lat !== 'number' ||
          typeof payload.location.lng !== 'number'
        ) {
          setStreetViewStatus('unavailable');
          return;
        }
        setStreetViewPanorama({
          id: payload.pano_id,
          heading: getBearingDegrees(
            {
              latitude: payload.location.lat,
              longitude: payload.location.lng,
            },
            location,
          ),
        });
        setStreetViewStatus('available');
      })
      .catch((error: unknown) => {
        // #region agent log
        debugPropertyVisuals('H2,H4', 'property-visuals-screen.tsx:112', 'street-view metadata request failed', {
          aborted: (error as { name?: string })?.name === 'AbortError',
        });
        // #endregion
        if ((error as { name?: string })?.name !== 'AbortError') {
          setStreetViewStatus('unavailable');
        }
      });

    return () => controller.abort();
  }, [activeIndex, location]);

  const markFailed = useCallback((page: VisualPageKey) => {
    setFailedPages((current) =>
      current.has(page) ? current : new Set([...current, page]),
    );
  }, []);

  const updateActivePage = useCallback(
    (offsetX: number) => {
      const nextIndex = Math.min(
        PAGES.length - 1,
        Math.max(0, Math.round(offsetX / Math.max(width, 1))),
      );
      setActiveIndex((current) =>
        current === nextIndex ? current : nextIndex,
      );
    },
    [width],
  );

  const renderPage = useCallback(
    ({ item, index }: { item: (typeof PAGES)[number]; index: number }) => {
      const isVisited = visited.has(item.key);
      const isFailed = failedPages.has(item.key);
      const mapType = item.key === 'satellite' ? 'satellite' : 'roadmap';
      const isStreetView = item.key === 'streetView';
      const knownStreetViewPanorama = location?.streetViewPanorama;
      const effectiveStreetViewPanorama =
        knownStreetViewPanorama ?? streetViewPanorama;
      const canShowStreetView =
        effectiveStreetViewPanorama && GOOGLE_MAPS_API_KEY;
      const imageUri =
        !isVisited || !location || !GOOGLE_MAPS_API_KEY || isFailed
          ? null
          : isStreetView
            ? canShowStreetView
              ? getGoogleStreetViewUrl(
                  effectiveStreetViewPanorama.id,
                  effectiveStreetViewPanorama.heading,
                  GOOGLE_MAPS_API_KEY,
                )
              : null
            : getGoogleStaticMapUrl(location, mapType, GOOGLE_MAPS_API_KEY);

      const unavailableLabel =
        item.key === 'streetView'
          ? 'STREET VIEW UNAVAILABLE'
          : `${item.label} UNAVAILABLE`;
      const loading =
        isStreetView &&
        isVisited &&
        !knownStreetViewPanorama &&
        streetViewStatus === 'loading';

      return (
        <View style={[styles.page, { width, height }]}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              resizeMode="cover"
              onLoad={() => {
                // #region agent log
                debugPropertyVisuals('H2,H5', 'property-visuals-screen.tsx:153', 'visual image loaded', {
                  page: item.key,
                });
                // #endregion
              }}
              onError={() => {
                // #region agent log
                debugPropertyVisuals('H2,H5', 'property-visuals-screen.tsx:159', 'visual image failed to load', {
                  page: item.key,
                });
                // #endregion
                markFailed(item.key);
              }}
              style={[styles.image, { width, height }]}
              accessibilityLabel={`${item.label} for ${getCompactPropertyLabel(property)}`}
            />
          ) : (
            <View style={styles.unavailableSurface}>
              <Text style={styles.unavailableText}>
                {loading ? 'LOADING…' : unavailableLabel}
              </Text>
            </View>
          )}
          <Text pointerEvents="none" style={styles.modeLabel}>
            {item.label}
          </Text>
        </View>
      );
    },
    [
      failedPages,
      location,
      markFailed,
      property,
      streetViewPanorama,
      streetViewStatus,
      visited,
      height,
      width,
    ],
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={PAGES}
        renderItem={renderPage}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        bounces={false}
        style={styles.carousel}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        onMomentumScrollEnd={(event) => {
          updateActivePage(event.nativeEvent.contentOffset.x);
        }}
        onScroll={(event) => updateActivePage(event.nativeEvent.contentOffset.x)}
        scrollEventThrottle={16}
      />

      <View
        pointerEvents="none"
        style={[
          styles.propertyIdentity,
          { top: insets.top + Spacing.section + Spacing.md },
        ]}>
        <Text numberOfLines={1} style={styles.propertyIdentityText}>
          {getCompactPropertyLabel(property)}
        </Text>
      </View>

      <View
        pointerEvents="none"
        style={[styles.positionIndicator, { bottom: insets.bottom + Spacing.xl }]}>
        {PAGES.map((page, index) => (
          <Text
            key={page.key}
            style={[
              styles.indicatorDot,
              index === activeIndex ? styles.indicatorDotActive : null,
            ]}>
            {index === activeIndex ? '•' : '○'}
          </Text>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Return to address selection"
        onPress={onBack}
        style={({ pressed }) => [
          styles.backButton,
          {
            left: insets.left + Spacing.xxl,
            bottom: insets.bottom + Spacing.lg,
          },
          pressed ? styles.secondaryPressed : null,
        ]}>
        <Text style={styles.backLabel}>BACK</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Start survey"
        onPress={onContinue}
        style={({ pressed }) => [
          styles.continueButton,
          {
            right: insets.right + Spacing.xxl,
            bottom: insets.bottom + Spacing.lg,
          },
          pressed ? styles.continueButtonPressed : null,
        ]}>
        <Text style={styles.continueLabel}>START</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  carousel: {
    flex: 1,
  },
  page: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  unavailableSurface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceMuted,
  },
  unavailableText: {
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    letterSpacing: 0.8,
    color: Colors.textSecondary,
  },
  modeLabel: {
    position: 'absolute',
    top: Spacing.md,
    alignSelf: 'center',
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    letterSpacing: 0.8,
    color: Colors.text,
  },
  propertyIdentity: {
    position: 'absolute',
    right: Spacing.xxl,
    left: Spacing.xxl,
    alignItems: 'center',
  },
  propertyIdentityText: {
    fontFamily: Fonts.sans,
    fontSize: Type.body,
    color: Colors.text,
  },
  positionIndicator: {
    position: 'absolute',
    right: 0,
    left: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  indicatorDot: {
    fontFamily: Fonts.mono,
    fontSize: Type.body,
    color: Colors.textMuted,
  },
  indicatorDotActive: {
    color: Colors.text,
  },
  backButton: {
    position: 'absolute',
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  backLabel: {
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    letterSpacing: 0.8,
    color: Colors.textSecondary,
  },
  continueButton: {
    position: 'absolute',
    minWidth: 164,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.section,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  continueButtonPressed: {
    opacity: 0.78,
  },
  continueLabel: {
    color: '#FFFFFF',
    fontFamily: Fonts.mono,
    fontSize: Type.body,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  secondaryPressed: {
    opacity: 0.65,
  },
});
