/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Loader2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  fetchAssetInfos,
  fetchAssetProfiles,
  AssetInfo,
  AssetProfile,
} from "@/lib/asset";

const PAGE_SIZE = 10;

export default function AssetsPage() {
  const t = useTranslations();
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [profiles, setProfiles] = useState<AssetProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [selectedProfile, setSelectedProfile] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadAssets = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchAssetInfos({
        pageSize: PAGE_SIZE,
        page: currentPage,
        assetProfileId: selectedProfile === "all" ? undefined : selectedProfile,
        textSearch: debouncedSearch || undefined,
      });
      setAssets(response.data);
      setTotalPages(response.totalPages);
      setTotalElements(response.totalElements);
    } catch (error) {
      console.error("Failed to load assets:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, selectedProfile, debouncedSearch]);

  const loadProfiles = useCallback(async () => {
    try {
      const response = await fetchAssetProfiles({ pageSize: 100 });
      setProfiles(response.data);
    } catch (error) {
      console.error("Failed to load profiles:", error);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const handleProfileChange = (value: string | null) => {
    if (value) {
      setSelectedProfile(value);
      setCurrentPage(0);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getSelectedProfileName = () => {
    if (selectedProfile === "all") return t("assets.allProfiles");
    const profile = profiles.find((p) => p.id.id === selectedProfile);
    return profile?.name || t("assets.profile");
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
              {t("assets.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("assets.description")} ({totalElements} {t("assets.title").toLowerCase()})
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-[300px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("common.searchByName")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={selectedProfile} onValueChange={handleProfileChange}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <span className="truncate">{getSelectedProfileName()}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("assets.allProfiles")}</SelectItem>
              {profiles.map((profile) => (
                <SelectItem key={profile.id.id} value={profile.id.id}>
                  {profile.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : assets.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              {t("assets.noAssets")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("assets.name")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("assets.label")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("common.type")}</TableHead>
                  <TableHead>{t("assets.profile")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("assets.created")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => (
                  <TableRow key={asset.id.id}>
                    <TableCell className="font-medium">{asset.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {asset.label || "-"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline">{asset.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{asset.assetProfileName}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {formatDate(asset.createdTime)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t("common.page")} {currentPage + 1} {t("common.of")} {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
                disabled={currentPage === 0 || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
                {t("common.previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))
                }
                disabled={currentPage >= totalPages - 1 || isLoading}
              >
                {t("common.next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
