import { Stack } from 'expo-router';
import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

export type BudgetLevel = 'low' | 'medium' | 'high';

/**
 * Draft state shared across the three onboarding pages. It lives in the
 * onboarding layout (which stays mounted while navigating between the pages),
 * so selections survive Back navigation without any DB round-trip. The single
 * `users` save still happens once, at the end of Page 2 (Constraints).
 */
type OnboardingDraft = {
  favorite: string | null;
  setFavorite: Dispatch<SetStateAction<string | null>>;
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
  const [favorite, setFavorite] = useState<string | null>(null);
  const [disliked, setDisliked] = useState<Set<string>>(new Set());
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [effort, setEffort] = useState<number | null>(null);
  const [budget, setBudget] = useState<BudgetLevel | null>(null);
  const [pantry, setPantry] = useState<Set<string>>(new Set());

  const value: OnboardingDraft = {
    favorite,
    setFavorite,
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
