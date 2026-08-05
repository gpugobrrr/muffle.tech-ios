import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';

type Props = {
  onPressBackground?: () => void;
};

export function WorkspaceHeader({ onPressBackground }: Props) {
  return (
    <Pressable
      onPress={onPressBackground}
      accessibilityRole="none"
      style={styles.header}>
      <View style={styles.brandRow}>
        <Text style={styles.brand}>muffle.tech</Text>
        <Text style={styles.product}>WORKSPACE</Text>
      </View>
      <View style={styles.profile}>
        <View style={styles.profileDot} />
        <View>
          <Text style={styles.profileName}>aslan sayfi</Text>
          <Text style={styles.profileRole}>Surveyor · indep</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  brand: {
    fontFamily: Fonts.sans,
    fontSize: Type.brand,
    fontWeight: '600',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  product: {
    fontFamily: Fonts.sans,
    fontSize: Type.label,
    fontWeight: '500',
    color: Colors.textMuted,
    letterSpacing: 1.2,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  profileDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.slate,
  },
  profileName: {
    fontFamily: Fonts.sans,
    fontSize: Type.body,
    fontWeight: '500',
    color: Colors.text,
    textAlign: 'right',
  },
  profileRole: {
    fontFamily: Fonts.sans,
    fontSize: Type.label,
    color: Colors.slate,
    textAlign: 'right',
    marginTop: 1,
  },
});
