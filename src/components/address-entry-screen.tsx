import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PulsingCaret } from '@/components/text-entry-page';
import { SplitTextKeyboard } from '@/components/split-text-keyboard';
import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import { useDataEntrySwipe } from '@/hooks/use-data-entry-swipe';
import {
  findLoqateAddresses,
  getLoqateDevelopmentMessage,
  hasLoqateConfiguration,
  logLoqateError,
  loqateConfigurationMessage,
  type LoqateSuggestion,
  retrieveLoqateAddress,
} from '@/lib/loqate-address';
import {
  DEMO_OX3_8SE_ADDRESSES,
  DEMO_POSTCODE,
  type DemoAddressSelection,
} from '@/lib/fixtures/demo-ox3-8se';
import {
  isValidUkPostcode,
  normalizeUkPostcodeForComparison,
  normalizeUkPostcodeInput,
} from '@/lib/uk-postcode';
import type { StructuredAddress } from '@/types/workspace';

type Props = {
  onComplete: (address: StructuredAddress) => void;
  demoMode?: boolean;
  onBack: () => void;
};

type AddressPhase = 'postcode' | 'road' | 'address';
type AddressSelection = LoqateSuggestion | DemoAddressSelection;

const ROAD_SUFFIX_PATTERN =
  '(?:avenue|boulevard|close|court|crescent|drive|gardens|green|grove|hill|lane|mews|park|place|road|row|square|street|terrace|vale|way|wharf)';
const ROAD_NAME_PATTERN = new RegExp(
  `\\b([a-z][a-z'’.-]*(?:\\s+[a-z][a-z'’.-]*){0,4}\\s+${ROAD_SUFFIX_PATTERN})\\b`,
  'i',
);
const NUMBER_FEEDBACK_HOLD_MS = 650;
const NUMBER_FEEDBACK_FADE_MS = 180;
const LEFT_DIGITS = ['1', '2', '3', '4', '5'] as const;
const RIGHT_DIGITS = ['6', '7', '8', '9', '0'] as const;

function suggestionLabel(suggestion: AddressSelection): string {
  return [suggestion.text, suggestion.description]
    .filter(Boolean)
    .join(', ');
}

function roadForSuggestion(suggestion: AddressSelection): string | null {
  const descriptionSegments = suggestion.description
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);
  // Loqate normally places the street in Description and the premise in Text.
  const segments = [...descriptionSegments, suggestion.text];
  for (const segment of segments) {
    const match = segment.trim().match(ROAD_NAME_PATTERN);
    if (match?.[1]) return match[1].trim();
  }

  if (suggestion.isContainer && suggestion.text) {
    return suggestion.text.trim();
  }

  const numberedText = suggestion.text.match(/^\d+[a-z]?\s+(.+)$/i);
  if (numberedText?.[1]) return numberedText[1].trim();

  const providerRoadSegment = descriptionSegments[0];
  return providerRoadSegment && !/\d/.test(providerRoadSegment)
    ? providerRoadSegment
    : null;
}

function distinctRoads(suggestions: AddressSelection[]): string[] {
  const roads = new Map<string, string>();
  suggestions.forEach((suggestion) => {
    const road = roadForSuggestion(suggestion);
    if (road && !roads.has(road.toLocaleLowerCase())) {
      roads.set(road.toLocaleLowerCase(), road);
    }
  });
  return [...roads.values()];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildingNumberForSuggestion(
  suggestion: AddressSelection,
  road: string,
): string | null {
  const label = suggestionLabel(suggestion);
  const match = label.match(
    new RegExp(`\\b(\\d+[a-z]?)\\s+${escapeRegExp(road)}\\b`, 'i'),
  );
  if (match?.[1]) return match[1];

  const flatMatch = suggestion.text.match(/\bflat\s+(\d+[a-z]?)\b/i);
  return flatMatch?.[1] ?? null;
}

function compareAddressSuggestions(
  left: AddressSelection,
  right: AddressSelection,
  road: string,
): number {
  const leftNumber = buildingNumberForSuggestion(left, road);
  const rightNumber = buildingNumberForSuggestion(right, road);
  if (!leftNumber || !rightNumber) return leftNumber ? -1 : rightNumber ? 1 : 0;

  const leftNumeric = Number.parseInt(leftNumber, 10);
  const rightNumeric = Number.parseInt(rightNumber, 10);
  if (leftNumeric !== rightNumeric) return leftNumeric - rightNumeric;
  return leftNumber.localeCompare(rightNumber, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function clearPostcodeCache(
  cache: Map<string, LoqateSuggestion[]>,
  postcode: string,
) {
  for (const key of [...cache.keys()]) {
    if (key.startsWith(`${postcode}:`)) cache.delete(key);
  }
}

export function AddressEntryScreen({
  onComplete,
  demoMode = false,
  onBack,
}: Props) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const requestSequenceRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);
  const suggestionsByContextRef = useRef(
    new Map<string, LoqateSuggestion[]>(),
  );
  const didReportMissingConfiguration = useRef(false);
  const [postcodeDraft, setPostcodeDraft] = useState(
    demoMode ? DEMO_POSTCODE : '',
  );
  const [containerId, setContainerId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSelection[]>(
    demoMode ? [...DEMO_OX3_8SE_ADDRESSES] : [],
  );
  const [emptyPostcode, setEmptyPostcode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookupPaused, setLookupPaused] = useState(false);
  const [lookupNonce, setLookupNonce] = useState(0);
  const [phase, setPhase] = useState<AddressPhase>(
    demoMode ? 'road' : 'postcode',
  );
  const [selectedRoad, setSelectedRoad] = useState<string | null>(null);
  const [houseNumberDraft, setHouseNumberDraft] = useState('');
  const entrance = useRef(new Animated.Value(0)).current;
  const numberFeedbackOpacity = useRef(new Animated.Value(0)).current;
  const numberFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const showingAddressResults = phase !== 'postcode';
  const roads = useMemo(() => distinctRoads(suggestions), [suggestions]);
  const roadSuggestions = useMemo(() => {
    if (!selectedRoad) return [];
    const normalizedRoad = selectedRoad.toLocaleLowerCase();
    return suggestions
      .filter((suggestion) => {
        const road = roadForSuggestion(suggestion);
        return !road || road.toLocaleLowerCase() === normalizedRoad;
      })
      .filter((suggestion) => {
        if (!houseNumberDraft) return true;
        return buildingNumberForSuggestion(suggestion, selectedRoad)
          ?.toLocaleLowerCase()
          .startsWith(houseNumberDraft.toLocaleLowerCase());
      })
      .map((suggestion, providerIndex) => ({ suggestion, providerIndex }))
      .sort(
        (left, right) =>
          compareAddressSuggestions(
            left.suggestion,
            right.suggestion,
            selectedRoad,
          ) || left.providerIndex - right.providerIndex,
      )
      .map(({ suggestion }) => suggestion);
  }, [houseNumberDraft, selectedRoad, suggestions]);

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      Keyboard.dismiss();
    });
  }, []);

  useEffect(() => {
    if (showingAddressResults) return;
    focusInput();
  }, [focusInput, showingAddressResults]);

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  useEffect(() => {
    return () => {
      requestControllerRef.current?.abort();
      if (numberFeedbackTimerRef.current) {
        clearTimeout(numberFeedbackTimerRef.current);
      }
      numberFeedbackOpacity.stopAnimation();
    };
  }, [numberFeedbackOpacity]);

  useEffect(() => {
    const requestId = ++requestSequenceRef.current;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setEmptyPostcode(null);
    setIsLoading(false);

    if (demoMode || lookupPaused) return;
    if (!isValidUkPostcode(postcodeDraft)) return;

    if (!hasLoqateConfiguration()) {
      setSuggestions([]);
      setError(
        __DEV__
          ? loqateConfigurationMessage()
          : 'Address search is not configured.',
      );
      if (__DEV__ && !didReportMissingConfiguration.current) {
        didReportMissingConfiguration.current = true;
        console.warn(loqateConfigurationMessage());
      }
      return;
    }

    const contextKey = `${postcodeDraft}:${containerId ?? 'root'}`;
    const cachedSuggestions = suggestionsByContextRef.current.get(contextKey);
    if (cachedSuggestions) {
      setSuggestions(cachedSuggestions);
      setEmptyPostcode(cachedSuggestions.length === 0 ? postcodeDraft : null);
      setError(null);
      if (!containerId && cachedSuggestions.length > 0) {
        setPhase((current) => (current === 'postcode' ? 'road' : current));
      }
      return;
    }

    const controller = new AbortController();
    requestControllerRef.current = controller;
    setIsLoading(true);
    setError(null);

    void findLoqateAddresses(postcodeDraft, containerId, controller.signal)
      .then((nextSuggestions) => {
        if (requestId !== requestSequenceRef.current) return;
        suggestionsByContextRef.current.set(contextKey, nextSuggestions);
        setSuggestions(nextSuggestions);
        setEmptyPostcode(nextSuggestions.length === 0 ? postcodeDraft : null);
        if (!containerId && nextSuggestions.length > 0) {
          setPhase((current) => (current === 'postcode' ? 'road' : current));
        }
      })
      .catch((requestError: unknown) => {
        if (requestId !== requestSequenceRef.current) return;
        if ((requestError as { name?: string })?.name === 'AbortError') {
          logLoqateError(requestError, {
            operation: 'find',
            postcode: postcodeDraft,
            endpoint:
              'https://api.addressy.com/Capture/Interactive/Find/v1.10/json3.ws',
            aborted: true,
          });
          return;
        }

        logLoqateError(requestError, {
          operation: 'find',
          postcode: postcodeDraft,
          endpoint:
            'https://api.addressy.com/Capture/Interactive/Find/v1.10/json3.ws',
        });
        setSuggestions([]);
        setError(
          __DEV__
            ? getLoqateDevelopmentMessage(requestError, 'Find', postcodeDraft)
            : 'Address search is unavailable. You can try again.',
        );
      })
      .finally(() => {
        if (requestId === requestSequenceRef.current) setIsLoading(false);
      });
  }, [containerId, demoMode, lookupNonce, lookupPaused, postcodeDraft]);

  const clearNumberFeedback = useCallback(() => {
    if (numberFeedbackTimerRef.current) {
      clearTimeout(numberFeedbackTimerRef.current);
      numberFeedbackTimerRef.current = null;
    }
    numberFeedbackOpacity.stopAnimation();
    numberFeedbackOpacity.setValue(0);
  }, [numberFeedbackOpacity]);

  const returnToPostcodeEntry = useCallback(() => {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    requestSequenceRef.current += 1;
    if (demoMode) {
      clearNumberFeedback();
      onBack();
      return;
    }

    clearPostcodeCache(suggestionsByContextRef.current, postcodeDraft);
    setLookupPaused(true);
    setSuggestions([]);
    setContainerId(null);
    setEmptyPostcode(null);
    setError(null);
    setIsLoading(false);
    setPhase('postcode');
    setSelectedRoad(null);
    setHouseNumberDraft('');
    if (numberFeedbackTimerRef.current) {
      clearTimeout(numberFeedbackTimerRef.current);
      numberFeedbackTimerRef.current = null;
    }
    numberFeedbackOpacity.setValue(0);
  }, [clearNumberFeedback, demoMode, numberFeedbackOpacity, onBack, postcodeDraft]);

  const flashNumberFeedback = useCallback(
    (value: string) => {
      if (numberFeedbackTimerRef.current) {
        clearTimeout(numberFeedbackTimerRef.current);
      }
      numberFeedbackOpacity.stopAnimation();
      if (!value) {
        numberFeedbackOpacity.setValue(0);
        numberFeedbackTimerRef.current = null;
        return;
      }
      numberFeedbackOpacity.setValue(1);
      numberFeedbackTimerRef.current = setTimeout(() => {
        numberFeedbackTimerRef.current = null;
        Animated.timing(numberFeedbackOpacity, {
          toValue: 0,
          duration: NUMBER_FEEDBACK_FADE_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      }, NUMBER_FEEDBACK_HOLD_MS);
    },
    [numberFeedbackOpacity],
  );

  const handleHouseNumberChange = useCallback(
    (nextValue: string) => {
      setHouseNumberDraft(nextValue);
      flashNumberFeedback(nextValue);
    },
    [flashNumberFeedback],
  );

  const returnToRoadSelection = useCallback(() => {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    requestSequenceRef.current += 1;
    setContainerId(null);
    const rootSuggestions = demoMode
      ? DEMO_OX3_8SE_ADDRESSES
      : suggestionsByContextRef.current.get(`${postcodeDraft}:root`);
    if (rootSuggestions) setSuggestions([...rootSuggestions]);
    setPhase('road');
    setSelectedRoad(null);
    setHouseNumberDraft('');
    setError(null);
    setIsLoading(false);
    clearNumberFeedback();
  }, [clearNumberFeedback, demoMode, postcodeDraft]);

  const handlePostcodeChange = useCallback((nextValue: string) => {
    setLookupPaused(false);
    setError(null);
    setEmptyPostcode(null);
    setContainerId(null);
    setSuggestions([]);
    setPostcodeDraft(normalizeUkPostcodeInput(nextValue));
    setPhase('postcode');
    setSelectedRoad(null);
    setHouseNumberDraft('');
    clearNumberFeedback();
  }, [clearNumberFeedback]);

  const dataEntryGesture = useDataEntrySwipe({
    enabled: true,
    fieldKey: `${phase}:${postcodeDraft}:${selectedRoad ?? ''}:${
      containerId ?? 'root'
    }`,
    value:
      phase === 'postcode'
        ? postcodeDraft
        : phase === 'address'
          ? houseNumberDraft
          : '',
    onChangeText:
      phase === 'address' ? handleHouseNumberChange : handlePostcodeChange,
    onNavigateBack: () => {
      if (phase === 'address') {
        returnToRoadSelection();
        return true;
      }
      if (phase === 'road') {
        returnToPostcodeEntry();
        return true;
      }
      return false;
    },
    navigateBackEnabled: phase !== 'postcode',
  });

  const handleSuggestionPress = useCallback(
    async (suggestion: AddressSelection) => {
      if (demoMode) {
        if (!('address' in suggestion)) {
          setError('Demo selection is missing saved address data.');
          return;
        }
        clearNumberFeedback();
        onComplete(suggestion.address);
        return;
      }

      if (suggestion.isContainer) {
        setContainerId(suggestion.id);
        return;
      }

      const requestId = ++requestSequenceRef.current;
      requestControllerRef.current?.abort();
      const controller = new AbortController();
      requestControllerRef.current = controller;
      setIsLoading(true);
      setError(null);

      try {
        const address = await retrieveLoqateAddress(
          suggestion.id,
          postcodeDraft,
          controller.signal,
        );
        if (requestId !== requestSequenceRef.current) return;

        const resolvedPostcode = address.postalCode
          ? normalizeUkPostcodeForComparison(address.postalCode)
          : '';
        if (
          !resolvedPostcode ||
          resolvedPostcode !== normalizeUkPostcodeForComparison(postcodeDraft)
        ) {
          setError(
            `Selected address is outside ${postcodeDraft}. Choose an address in that postcode.`,
          );
          return;
        }
        clearNumberFeedback();
        onComplete(address);
      } catch (requestError: unknown) {
        if (requestId !== requestSequenceRef.current) return;
        if ((requestError as { name?: string })?.name === 'AbortError') {
          logLoqateError(requestError, {
            operation: 'retrieve',
            postcode: postcodeDraft,
            endpoint:
              'https://api.addressy.com/Capture/Interactive/Retrieve/v1.20/json3.ws',
            aborted: true,
          });
          return;
        }

        logLoqateError(requestError, {
          operation: 'retrieve',
          postcode: postcodeDraft,
          endpoint:
            'https://api.addressy.com/Capture/Interactive/Retrieve/v1.20/json3.ws',
        });
        setError(
          __DEV__
            ? getLoqateDevelopmentMessage(
                requestError,
                'Retrieve',
                postcodeDraft,
              )
            : 'That address could not be selected. Try again.',
        );
      } finally {
        if (requestId === requestSequenceRef.current) setIsLoading(false);
      }
    },
    [clearNumberFeedback, demoMode, onComplete, postcodeDraft],
  );

  const handleSubmit = useCallback(() => {
    if (!isValidUkPostcode(postcodeDraft)) {
      setError('Enter a valid UK postcode to continue.');
      return;
    }
    clearPostcodeCache(suggestionsByContextRef.current, postcodeDraft);
    setLookupPaused(false);
    setContainerId(null);
    setSuggestions([]);
    setEmptyPostcode(null);
    setError(null);
    setPhase('postcode');
    setSelectedRoad(null);
    setHouseNumberDraft('');
    clearNumberFeedback();
    setLookupNonce((value) => value + 1);
  }, [clearNumberFeedback, postcodeDraft]);

  const renderSuggestion = useCallback(
    ({ item }: { item: AddressSelection }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Select ${suggestionLabel(item)}`}
        onPress={() => void handleSuggestionPress(item)}
        style={({ pressed }) => [
          styles.suggestionRow,
          pressed ? styles.suggestionRowPressed : null,
        ]}>
        <Text style={styles.suggestionText}>{suggestionLabel(item)}</Text>
      </Pressable>
    ),
    [handleSuggestionPress],
  );

  const renderRoad = useCallback(
    ({ item, index }: { item: string; index: number }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Road ${item}`}
        onPress={() => {
          setSelectedRoad(item);
          setHouseNumberDraft('');
          clearNumberFeedback();
          setPhase('address');
        }}
        style={({ pressed }) => [
          styles.roadChoice,
          index % 2 === 1 ? styles.roadChoiceRight : null,
          pressed ? styles.roadChoicePressed : null,
        ]}>
        <Text
          style={[
            styles.roadChoiceText,
            index % 2 === 1 ? styles.roadChoiceTextRight : null,
          ]}>
          [{item}]
        </Text>
      </Pressable>
    ),
    [clearNumberFeedback],
  );

  const renderDigitColumn = useCallback(
    (digits: readonly string[]) => (
      <View style={styles.digitColumn}>
        {digits.map((digit) => (
          <Pressable
            key={digit}
            accessibilityRole="button"
            accessibilityLabel={`Enter ${digit}`}
            onPress={() => handleHouseNumberChange(`${houseNumberDraft}${digit}`)}
            style={styles.digitTouchTarget}>
            {({ pressed }) => (
              <View
                style={[
                  styles.digitFeedback,
                  pressed ? styles.digitFeedbackPressed : null,
                ]}>
                <Text style={styles.digitText}>{digit}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>
    ),
    [handleHouseNumberChange, houseNumberDraft],
  );

  return (
    <Animated.View
      style={[
        styles.screen,
        {
          opacity: entrance,
          transform: [
            {
              translateY: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        },
      ]}>
      <GestureDetector gesture={dataEntryGesture}>
        <View style={styles.screen}>
          {phase === 'road' ? (
            <View
              style={[
                styles.roadMode,
                {
                  paddingTop: insets.top + Spacing.md,
                  paddingBottom: insets.bottom + Spacing.md,
                },
              ]}>
              <FlatList
                data={roads}
                keyExtractor={(item) => item.toLocaleLowerCase()}
                renderItem={renderRoad}
                numColumns={2}
                columnWrapperStyle={styles.roadRow}
                style={styles.roadList}
                contentContainerStyle={styles.roadListContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              />
            </View>
          ) : phase === 'address' ? (
            <View
              style={[
                styles.addressMode,
                {
                  paddingTop: insets.top,
                  paddingBottom: insets.bottom,
                  paddingLeft: insets.left,
                  paddingRight: insets.right,
                },
              ]}>
              <View style={styles.digitPanel}>{renderDigitColumn(LEFT_DIGITS)}</View>
              <View style={styles.addressWorkspace}>
                <FlatList
                  data={roadSuggestions}
                  keyExtractor={(item) => item.id}
                  renderItem={renderSuggestion}
                  style={styles.addressList}
                  contentContainerStyle={styles.addressListContent}
                  showsVerticalScrollIndicator={false}
                  horizontal={false}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    <Text style={styles.statusText}>No matching addresses.</Text>
                  }
                  ListFooterComponent={
                    isLoading ? (
                      <Text style={styles.statusText}>Searching...</Text>
                    ) : error ? (
                      <Text style={styles.errorText}>{error}</Text>
                    ) : null
                  }
                />
                <Animated.View
                  pointerEvents="none"
                  accessibilityElementsHidden
                  style={[
                    styles.numberFeedback,
                    { opacity: numberFeedbackOpacity },
                  ]}>
                  <Text style={styles.numberFeedbackText}>
                    {houseNumberDraft}
                  </Text>
                </Animated.View>
              </View>
              <View style={styles.digitPanel}>{renderDigitColumn(RIGHT_DIGITS)}</View>
            </View>
          ) : (
            <>
              <View style={styles.workspace}>
                <View style={styles.statusArea}>
                  {isLoading ? (
                    <Text style={styles.statusText}>Searching...</Text>
                  ) : null}
                  {emptyPostcode ? (
                    <Text style={styles.statusText}>
                      No addresses found for {emptyPostcode}.
                    </Text>
                  ) : null}
                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                </View>
                <View style={styles.spaceWorkspace} />
              </View>

              <View style={styles.inputRegion}>
                <Text style={styles.phaseLabel}>POSTCODE</Text>
                <Pressable onPress={focusInput} style={styles.inputRow}>
                  <TextInput
                    ref={inputRef}
                    value={postcodeDraft}
                    onChangeText={handlePostcodeChange}
                    onSubmitEditing={handleSubmit}
                    showSoftInputOnFocus={false}
                    autoFocus
                    autoCapitalize="characters"
                    autoCorrect={false}
                    spellCheck={false}
                    placeholder=""
                    caretHidden={postcodeDraft.length === 0}
                    accessibilityLabel="Postcode"
                    style={styles.input}
                  />
                  {postcodeDraft.length === 0 ? <PulsingCaret /> : null}
                </Pressable>
              </View>

              <SplitTextKeyboard
                value={postcodeDraft}
                onChangeText={handlePostcodeChange}
                onSubmit={handleSubmit}
                showNumericMode
              />
            </>
          )}
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  workspace: {
    flex: 1,
    minHeight: 0,
  },
  statusArea: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.section,
  },
  roadMode: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
  },
  roadList: {
    flex: 1,
    width: '100%',
    maxWidth: 920,
  },
  roadListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.section,
  },
  roadRow: {
    justifyContent: 'space-between',
  },
  roadChoice: {
    width: '42%',
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.xs,
  },
  roadChoiceRight: {
    alignItems: 'flex-end',
  },
  roadChoicePressed: {
    opacity: 0.7,
  },
  roadChoiceText: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.text,
  },
  roadChoiceTextRight: {
    textAlign: 'right',
  },
  addressMode: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
  },
  digitPanel: {
    width: '20%',
    maxWidth: 220,
    minWidth: 92,
    backgroundColor: Colors.concrete,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  digitColumn: {
    flex: 1,
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  digitTouchTarget: {
    width: 56,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitFeedback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitFeedbackPressed: {
    backgroundColor: Colors.accentSoft,
  },
  digitText: {
    fontFamily: Fonts.mono,
    fontSize: Type.body,
    color: Colors.text,
  },
  addressWorkspace: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  addressList: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
  },
  addressListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.section,
  },
  numberFeedback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberFeedbackText: {
    fontFamily: Fonts.mono,
    fontSize: 32,
    color: Colors.slate,
  },
  suggestionRow: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  suggestionRowPressed: {
    backgroundColor: Colors.accentSoft,
  },
  suggestionText: {
    fontFamily: Fonts.sans,
    fontSize: Type.body,
    color: Colors.text,
    textAlign: 'left',
  },
  statusText: {
    paddingTop: Spacing.sm,
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  errorText: {
    paddingTop: Spacing.sm,
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    color: Colors.danger,
    textAlign: 'center',
  },
  spaceWorkspace: {
    flex: 1,
    minHeight: 0,
  },
  inputRegion: {
    width: '100%',
    alignItems: 'center',
  },
  phaseLabel: {
    paddingBottom: Spacing.xs,
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    letterSpacing: 0.8,
    color: Colors.textSecondary,
  },
  inputRow: {
    position: 'relative',
    width: '100%',
    maxWidth: 560,
  },
  input: {
    width: '100%',
    minHeight: 58,
    paddingHorizontal: 20,
    paddingVertical: Spacing.md,
    fontFamily: Fonts.mono,
    fontSize: 18,
    lineHeight: 24,
    color: Colors.text,
    textAlign: 'center',
  },
});
