"use client";

import { createContext, useContext, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { type Locale, defaultLocale } from "@/i18n/config";

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  isPending: boolean;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: defaultLocale,
  setLocale: () => {},
  isPending: false,
});

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const setLocale = useCallback(
    (newLocale: Locale) => {
      // Set cookie
      document.cookie = `locale=${newLocale};path=/;max-age=31536000`;

      // Refresh the page to apply new locale
      startTransition(() => {
        router.refresh();
      });
    },
    [router]
  );

  return (
    <LocaleContext.Provider
      value={{ locale: initialLocale, setLocale, isPending }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
}
