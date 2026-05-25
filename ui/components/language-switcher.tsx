"use client";

import { Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useLocale } from "@/contexts/locale-context";
import { locales, localeNames, localeFlags, type Locale } from "@/i18n/config";

export function LanguageSwitcher() {
  const { locale, setLocale, isPending } = useLocale();

  const handleChange = (value: string | null) => {
    if (value && locales.includes(value as Locale)) {
      setLocale(value as Locale);
    }
  };

  return (
    <Select value={locale} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger className="w-[140px] h-8">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          <span className="text-sm">
            {localeFlags[locale]} {localeNames[locale]}
          </span>
        </div>
      </SelectTrigger>
      <SelectContent>
        {locales.map((loc) => (
          <SelectItem key={loc} value={loc}>
            <span className="flex items-center gap-2">
              {localeFlags[loc]} {localeNames[loc]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
