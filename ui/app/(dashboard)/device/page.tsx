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
  fetchDeviceInfos,
  fetchDeviceProfiles,
  DeviceInfo,
  DeviceProfile,
} from "@/lib/device";

const PAGE_SIZE = 10;

export default function DevicePage() {
  const t = useTranslations();
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [profiles, setProfiles] = useState<DeviceProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [selectedProfile, setSelectedProfile] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
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

  const loadDevices = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchDeviceInfos({
        pageSize: PAGE_SIZE,
        page: currentPage,
        active: selectedStatus === "all" ? undefined : selectedStatus === "online",
        deviceProfileId: selectedProfile === "all" ? undefined : selectedProfile,
        textSearch: debouncedSearch || undefined,
      });
      setDevices(response.data);
      setTotalPages(response.totalPages);
      setTotalElements(response.totalElements);
    } catch (error) {
      console.error("Failed to load devices:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, selectedProfile, selectedStatus, debouncedSearch]);

  const loadProfiles = useCallback(async () => {
    try {
      const response = await fetchDeviceProfiles({ pageSize: 100 });
      setProfiles(response.data);
    } catch (error) {
      console.error("Failed to load profiles:", error);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const handleProfileChange = (value: string | null) => {
    if (value) {
      setSelectedProfile(value);
      setCurrentPage(0);
    }
  };

  const handleStatusChange = (value: string | null) => {
    if (value) {
      setSelectedStatus(value);
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
    if (selectedProfile === "all") return t("devices.allProfiles");
    const profile = profiles.find((p) => p.id.id === selectedProfile);
    return profile?.name || t("devices.profile");
  };

  const getSelectedStatusName = () => {
    if (selectedStatus === "all") return t("devices.allStatus");
    return selectedStatus === "online" ? t("common.online") : t("common.offline");
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
              {t("devices.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("devices.description")} ({totalElements} {t("devices.title").toLowerCase()})
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
              <SelectItem value="all">{t("devices.allProfiles")}</SelectItem>
              {profiles.map((profile) => (
                <SelectItem key={profile.id.id} value={profile.id.id}>
                  {profile.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <span>{getSelectedStatusName()}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("devices.allStatus")}</SelectItem>
              <SelectItem value="online">{t("common.online")}</SelectItem>
              <SelectItem value="offline">{t("common.offline")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : devices.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              {t("devices.noDevices")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("devices.name")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("devices.label")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("devices.profile")}</TableHead>
                  <TableHead>{t("devices.status")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("devices.created")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => (
                  <TableRow key={device.id.id}>
                    <TableCell className="font-medium">{device.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {device.label || "-"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="secondary">{device.deviceProfileName}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={device.active ? "default" : "outline"}
                        className={
                          device.active
                            ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                            : "text-muted-foreground"
                        }
                      >
                        {device.active ? t("common.online") : t("common.offline")}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {formatDate(device.createdTime)}
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
