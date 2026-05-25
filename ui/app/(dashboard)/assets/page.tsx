/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { Loader2, ChevronLeft, ChevronRight, Search, Plus, Pencil } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  fetchAssetInfos,
  fetchAssetProfiles,
  createAsset,
  fetchAssetById,
  updateAsset,
  AssetInfo,
  AssetProfile,
} from "@/lib/asset";
import { fetchAttributes, AttributeValue } from "@/lib/telemetry";
import { AttributesSection } from "@/components/attributes-section";

const PAGE_SIZE = 10;

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

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

  const [addOpen, setAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formName, setFormName] = useState("");
  const [formLabel, setFormLabel] = useState("");
  const [formProfileId, setFormProfileId] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<AssetInfo | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [editProfileId, setEditProfileId] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [attributes, setAttributes] = useState<AttributeValue[] | null>(null);
  const [isLoadingAttributes, setIsLoadingAttributes] = useState(false);
  const [attributesError, setAttributesError] = useState<string | null>(null);

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

  const resetAddForm = () => {
    setFormName("");
    setFormLabel("");
    setFormProfileId("");
    setFormDescription("");
  };

  const handleAddOpenChange = (open: boolean) => {
    setAddOpen(open);
    if (!open) resetAddForm();
  };

  const handleRowClick = async (assetId: string) => {
    setDetailOpen(true);
    setIsLoadingDetail(true);
    setDetailError(null);
    setDetail(null);
    setIsEditing(false);
    setAttributes(null);
    setAttributesError(null);
    setIsLoadingAttributes(true);
    try {
      const info = await fetchAssetById(assetId);
      setDetail(info);
      setEditName(info.name);
      setEditLabel(info.label || "");
      setEditProfileId(info.assetProfileId.id);
      setEditDescription(info.additionalInfo?.description || "");
    } catch (error) {
      console.error("Failed to load asset detail:", error);
      setDetailError(
        error instanceof Error ? error.message : "Failed to load asset"
      );
    } finally {
      setIsLoadingDetail(false);
    }

    try {
      const attrs = await fetchAttributes("ASSET", assetId, "SERVER_SCOPE");
      setAttributes(attrs);
    } catch (error) {
      console.error("Failed to load attributes:", error);
      setAttributesError(
        error instanceof Error ? error.message : "Failed to load attributes"
      );
    } finally {
      setIsLoadingAttributes(false);
    }
  };

  const handleDetailOpenChange = (open: boolean) => {
    setDetailOpen(open);
    if (!open) {
      setIsEditing(false);
      setDetail(null);
      setDetailError(null);
    }
  };

  const handleStartEdit = () => {
    if (!detail) return;
    setEditName(detail.name);
    setEditLabel(detail.label || "");
    setEditProfileId(detail.assetProfileId.id);
    setEditDescription(detail.additionalInfo?.description || "");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!detail) return;
    if (!editName.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!editProfileId) {
      toast.error("Asset profile is required");
      return;
    }

    const profile = profiles.find((p) => p.id.id === editProfileId);
    const profileChanged = editProfileId !== detail.assetProfileId.id;

    setIsSubmitting(true);
    try {
      const updated = await updateAsset({
        ...detail,
        name: editName.trim(),
        label: editLabel.trim() || null,
        type: profileChanged && profile ? profile.name : detail.type,
        assetProfileId: {
          entityType: "ASSET_PROFILE",
          id: editProfileId,
        },
        additionalInfo: {
          ...(detail.additionalInfo || {}),
          description: editDescription.trim(),
        },
      });
      setDetail(updated);
      setIsEditing(false);
      toast.success(`Asset "${updated.name}" updated`);
      loadAssets();
    } catch (error) {
      console.error("Failed to update asset:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update asset"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitNewAsset = async () => {
    if (!formName.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!formProfileId) {
      toast.error("Asset profile is required");
      return;
    }

    const profile = profiles.find((p) => p.id.id === formProfileId);

    setIsSubmitting(true);
    try {
      const created = await createAsset({
        name: formName.trim(),
        label: formLabel.trim(),
        type: profile?.name,
        assetProfileId: {
          entityType: "ASSET_PROFILE",
          id: formProfileId,
        },
        additionalInfo: {
          description: formDescription.trim(),
        },
        customerId: null,
      });
      toast.success(`Asset "${created.name}" created`);
      handleAddOpenChange(false);
      loadAssets();
    } catch (error) {
      console.error("Failed to create asset:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create asset"
      );
    } finally {
      setIsSubmitting(false);
    }
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
          <Button onClick={() => setAddOpen(true)} size="sm">
            <Plus className="h-4 w-4" />
            Add Asset
          </Button>
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
                  <TableRow
                    key={asset.id.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(asset.id.id)}
                  >
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

        {/* Asset Detail / Edit Dialog */}
        <Dialog open={detailOpen} onOpenChange={handleDetailOpenChange}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {isEditing
                  ? "Edit asset"
                  : detail?.name || (isLoadingDetail ? "Loading..." : "Asset")}
              </DialogTitle>
              <DialogDescription>
                {isEditing
                  ? "Update asset information"
                  : "Asset information"}
              </DialogDescription>
            </DialogHeader>

            {isLoadingDetail ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : detailError ? (
              <div className="py-4 text-sm text-destructive">{detailError}</div>
            ) : detail ? (
              isEditing ? (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-asset-name">
                      Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="edit-asset-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-asset-label">Label</Label>
                    <Input
                      id="edit-asset-label"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>
                      Asset profile <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={editProfileId || undefined}
                      onValueChange={(v) => v && setEditProfileId(v)}
                    >
                      <SelectTrigger className="w-full">
                        <span className="truncate">
                          {profiles.find((p) => p.id.id === editProfileId)
                            ?.name || "Select profile"}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.map((profile) => (
                          <SelectItem key={profile.id.id} value={profile.id.id}>
                            {profile.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-asset-description">Description</Label>
                    <Input
                      id="edit-asset-description"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEdit}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Save"
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <DetailRow label="Name" value={detail.name} />
                    <DetailRow label="Type" value={detail.type} />
                    <DetailRow label="Label" value={detail.label || "-"} />
                    <DetailRow
                      label="Profile"
                      value={
                        <Badge variant="secondary">
                          {detail.assetProfileName}
                        </Badge>
                      }
                    />
                    <DetailRow
                      label="Created"
                      value={formatDate(detail.createdTime)}
                    />
                    <DetailRow
                      label="Version"
                      value={detail.version?.toString() ?? "-"}
                    />
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      Asset ID
                    </div>
                    <div className="font-mono text-xs break-all rounded-md bg-muted px-2 py-1.5">
                      {detail.id.id}
                    </div>
                  </div>

                  {detail.additionalInfo?.description && (
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                        Description
                      </div>
                      <div className="text-sm">
                        {detail.additionalInfo.description}
                      </div>
                    </div>
                  )}

                  <AttributesSection
                    title="Server attributes"
                    isLoading={isLoadingAttributes}
                    error={attributesError}
                    attributes={attributes}
                  />

                  <div className="flex items-center justify-end pt-2">
                    <Button size="sm" onClick={handleStartEdit}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </div>
                </div>
              )
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Add Asset Dialog */}
        <Dialog open={addOpen} onOpenChange={handleAddOpenChange}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Add new asset</DialogTitle>
              <DialogDescription>
                Create a new asset under an asset profile
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="asset-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="asset-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="My asset"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="asset-label">Label</Label>
                <Input
                  id="asset-label"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="Optional label"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>
                  Asset profile <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formProfileId || undefined}
                  onValueChange={(v) => v && setFormProfileId(v)}
                >
                  <SelectTrigger className="w-full">
                    <span className="truncate">
                      {profiles.find((p) => p.id.id === formProfileId)?.name ||
                        "Select profile"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id.id} value={profile.id.id}>
                        {profile.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="asset-description">Description</Label>
                <Input
                  id="asset-description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAddOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmitNewAsset}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Add"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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
