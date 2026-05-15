import { useLanguageStore } from '../store/useLanguageStore';
import { translations, TranslationKey } from './translations';

export function useTranslation() {
  const { language } = useLanguageStore();

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations['en'][key] || key;
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString()} ETB`;
  };

  return { t, formatCurrency, language };
}
