import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '../../components/Text';
import { colors, spacing } from '../../theme/tokens';

export type BudgetLevel = 'low' | 'medium' | 'high';

/**
 * Multi-select row with a checkbox indicator — makes "pick as many as you like"
 * obvious. Whole row is tappable; 44px min height for the accessibility target.
 * Checked = accent filled checkbox; unchecked = muted outline square.
 */
export function CheckRow({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={sharedStyles.checkRow}
    >
      <Ionicons
        name={checked ? 'checkbox' : 'square-outline'}
        size={24}
        color={checked ? colors.accent : colors.textSecondary}
      />
      <Text variant="body">{label}</Text>
    </Pressable>
  );
}

/**
 * An added free-text item, shown as an accent pill with a trailing × so it's
 * clear that tapping removes it. Whole pill is tappable.
 */
export function RemovableTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Pressable
      onPress={onRemove}
      accessibilityRole="button"
      accessibilityLabel={`Remove ${label}`}
      style={sharedStyles.tag}
    >
      <Text variant="body" color="bg">
        {label}
      </Text>
      <Text variant="body" color="bg">
        ×
      </Text>
    </Pressable>
  );
}

const sharedStyles = StyleSheet.create({
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 44,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
});

/**
 * Draft state shared across the three onboarding pages. It lives in the
 * onboarding layout (which stays mounted while navigating between the pages),
 * so selections survive Back navigation without any DB round-trip. The single
 * `users` save still happens once, at the end of Page 2 (Constraints).
 */
type OnboardingDraft = {
  favorites: string[]; // ordered, max 3; [0] = top favorite
  setFavorites: Dispatch<SetStateAction<string[]>>;
  disliked: Set<string>;
  setDisliked: Dispatch<SetStateAction<Set<string>>>;
  ingredients: string[];
  setIngredients: Dispatch<SetStateAction<string[]>>;
  effort: number | null;
  setEffort: Dispatch<SetStateAction<number | null>>;
  budget: BudgetLevel | null;
  setBudget: Dispatch<SetStateAction<BudgetLevel | null>>;
  pantry: Set<string>;
  setPantry: Dispatch<SetStateAction<Set<string>>>;
};

const OnboardingContext = createContext<OnboardingDraft | null>(null);

export function useOnboarding(): OnboardingDraft {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding must be used within the onboarding layout');
  }
  return ctx;
}

export default function OnboardingLayout() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [disliked, setDisliked] = useState<Set<string>>(new Set());
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [effort, setEffort] = useState<number | null>(null);
  const [budget, setBudget] = useState<BudgetLevel | null>(null);
  const [pantry, setPantry] = useState<Set<string>>(new Set());

  const value: OnboardingDraft = {
    favorites,
    setFavorites,
    disliked,
    setDisliked,
    ingredients,
    setIngredients,
    effort,
    setEffort,
    budget,
    setBudget,
    pantry,
    setPantry,
  };

  return (
    <OnboardingContext.Provider value={value}>
      <Stack screenOptions={{ headerShown: false }} />
    </OnboardingContext.Provider>
  );
}
