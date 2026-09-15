import { useColorScheme } from 'react-native';
import { themes, ThemeColors } from '../theme/colors';
import { useLibraryStore } from '../store/libraryStore';
import { ThemeId } from '../types';

export function useAppTheme(): ThemeColors {
  const system = useColorScheme();
  const themeId = useLibraryStore((s) => s.preferences.themeId);
  const followSystem = useLibraryStore((s) => s.preferences.followSystemTheme);

  let resolved: ThemeId = themeId;
  if (followSystem) {
    resolved = system === 'dark' ? 'dark' : 'light';
  }
  return themes[resolved];
}
