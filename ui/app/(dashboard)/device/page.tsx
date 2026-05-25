/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Loader2, ChevronLeft, ChevronRight, Search, Copy, Check, Plus, RefreshCw, Eye, EyeOff } from "lucide-react";
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
  fetchDeviceInfos,
  fetchDeviceProfiles,
  fetchDeviceById,
  fetchDeviceCredentials,
  createDeviceWithCredentials,
  DeviceInfo,
  DeviceProfile,
  DeviceCredentials,
  DeviceCredentialsType,
  CreateDevicePayload,
} from "@/lib/device";
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

function CredentialField({
  label,
  value,
  copyKey,
  copiedKey,
  onCopy,
  secret = false,
  multiline = false,
}: {
  label: string;
  value: string;
  copyKey: string;
  copiedKey: string | null;
  onCopy: (key: string, value: string) => void;
  secret?: boolean;
  multiline?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const isCopied = copiedKey === copyKey;
  const displayed = secret && !revealed ? "•".repeat(Math.min(value.length, 16)) : value;

  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
        {label}
      </div>
      <div className="flex items-start gap-2">
        <code
          className={
            "flex-1 font-mono text-xs break-all rounded-md bg-muted px-2 py-1.5 " +
            (multiline ? "whitespace-pre-wrap" : "")
          }
        >
          {displayed}
        </code>
        {secret && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRevealed((r) => !r)}
            className="shrink-0"
            aria-label={revealed ? "Hide" : "Show"}
          >
            {revealed ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onCopy(copyKey, value)}
          className="shrink-0"
          aria-label="Copy"
        >
          {isCopied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detail, setDetail] = useState<DeviceInfo | null>(null);
  const [credentials, setCredentials] = useState<DeviceCredentials | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [attributes, setAttributes] = useState<AttributeValue[] | null>(null);
  const [isLoadingAttributes, setIsLoadingAttributes] = useState(false);
  const [attributesError, setAttributesError] = useState<string | null>(null);

  // Add device state
  const [addOpen, setAddOpen] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formName, setFormName] = useState("");
  const [formLabel, setFormLabel] = useState("");
  const [formProfileId, setFormProfileId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIsGateway, setFormIsGateway] = useState(false);
  const [credType, setCredType] =
    useState<DeviceCredentialsType>("ACCESS_TOKEN");
  const [credAccessToken, setCredAccessToken] = useState("");
  const [credClientId, setCredClientId] = useState("");
  const [credUserName, setCredUserName] = useState("");
  const [credPassword, setCredPassword] = useState("");
  const [credX509, setCredX509] = useState("");

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

  const handleRowClick = async (deviceId: string) => {
    setDialogOpen(true);
    setIsLoadingDetail(true);
    setDetailError(null);
    setDetail(null);
    setCredentials(null);
    setCopiedKey(null);
    setAttributes(null);
    setAttributesError(null);
    setIsLoadingAttributes(true);
    try {
      const [info, creds] = await Promise.all([
        fetchDeviceById(deviceId),
        fetchDeviceCredentials(deviceId).catch(() => null),
      ]);
      setDetail(info);
      setCredentials(creds);
    } catch (error) {
      console.error("Failed to load device detail:", error);
      setDetailError(
        error instanceof Error ? error.message : "Failed to load device"
      );
    } finally {
      setIsLoadingDetail(false);
    }

    try {
      const attrs = await fetchAttributes("DEVICE", deviceId, "SERVER_SCOPE");
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

  const resetAddForm = () => {
    setAddStep(1);
    setFormName("");
    setFormLabel("");
    setFormProfileId("");
    setFormDescription("");
    setFormIsGateway(false);
    setCredType("ACCESS_TOKEN");
    setCredAccessToken("");
    setCredClientId("");
    setCredUserName("");
    setCredPassword("");
    setCredX509("");
  };

  const handleAddOpenChange = (open: boolean) => {
    setAddOpen(open);
    if (!open) resetAddForm();
  };

  const buildCredentialsPayload = (): CreateDevicePayload["credentials"] => {
    if (credType === "ACCESS_TOKEN") {
      if (!credAccessToken.trim()) return undefined;
      return {
        credentialsType: "ACCESS_TOKEN",
        credentialsId: credAccessToken.trim(),
        credentialsValue: null,
      };
    }
    if (credType === "X509_CERTIFICATE") {
      if (!credX509.trim()) return undefined;
      return {
        credentialsType: "X509_CERTIFICATE",
        credentialsId: null,
        credentialsValue: credX509.trim(),
      };
    }
    // MQTT_BASIC
    if (!credClientId.trim() && !credUserName.trim()) return undefined;
    return {
      credentialsType: "MQTT_BASIC",
      credentialsId: null,
      credentialsValue: JSON.stringify({
        clientId: credClientId.trim(),
        userName: credUserName.trim(),
        password: credPassword,
      }),
    };
  };

  const handleSubmitNewDevice = async () => {
    if (!formName.trim()) {
      toast.error("Name is required");
      setAddStep(1);
      return;
    }
    if (!formProfileId) {
      toast.error("Device profile is required");
      setAddStep(1);
      return;
    }

    setIsSubmitting(true);
    try {
      const credentialsPayload = buildCredentialsPayload();
      const created = await createDeviceWithCredentials({
        device: {
          name: formName.trim(),
          label: formLabel.trim(),
          deviceProfileId: {
            entityType: "DEVICE_PROFILE",
            id: formProfileId,
          },
          additionalInfo: {
            gateway: formIsGateway,
            overwriteActivityTime: false,
            description: formDescription.trim(),
          },
          customerId: null,
        },
        credentials: credentialsPayload,
      });
      toast.success(`Device "${created.name}" created`);
      handleAddOpenChange(false);
      loadDevices();
    } catch (error) {
      console.error("Failed to create device:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create device"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyValue = async (key: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(
        () => setCopiedKey((curr) => (curr === key ? null : curr)),
        1500
      );
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const parseMqttCredentialsValue = (
    value: string | null
  ): { clientId?: string; userName?: string; password?: string } => {
    if (!value) return {};
    try {
      const parsed = JSON.parse(value);
      return {
        clientId: parsed.clientId || undefined,
        userName: parsed.userName || undefined,
        password: parsed.password || undefined,
      };
    } catch {
      return {};
    }
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
          <Button onClick={() => setAddOpen(true)} size="sm">
            <Plus className="h-4 w-4" />
            Add Device
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
                  <TableRow
                    key={device.id.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(device.id.id)}
                  >
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

        {/* Device Detail Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {detail?.name || (isLoadingDetail ? "Loading..." : "Device")}
              </DialogTitle>
              <DialogDescription>
                Device information and access credentials
              </DialogDescription>
            </DialogHeader>

            {isLoadingDetail ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : detailError ? (
              <div className="py-4 text-sm text-destructive">{detailError}</div>
            ) : detail ? (
              <div className="flex flex-col gap-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <DetailRow label="Name" value={detail.name} />
                  <DetailRow label="Type" value={detail.type} />
                  <DetailRow label="Label" value={detail.label || "-"} />
                  <DetailRow label="Profile" value={detail.deviceProfileName} />
                  <DetailRow
                    label="Status"
                    value={
                      <Badge
                        variant={detail.active ? "default" : "outline"}
                        className={
                          detail.active
                            ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                            : "text-muted-foreground"
                        }
                      >
                        {detail.active ? "Online" : "Offline"}
                      </Badge>
                    }
                  />
                  <DetailRow label="Created" value={formatDate(detail.createdTime)} />
                  <DetailRow
                    label="Gateway"
                    value={detail.additionalInfo?.gateway ? "Yes" : "No"}
                  />
                  <DetailRow
                    label="Version"
                    value={detail.version?.toString() ?? "-"}
                  />
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Device ID
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

                <div className="border-t border-border pt-3">
                  <div className="text-sm font-medium mb-2">Credentials</div>
                  {credentials ? (
                    <div className="flex flex-col gap-2">
                      <DetailRow
                        label="Type"
                        value={credentials.credentialsType}
                      />

                      {credentials.credentialsType === "ACCESS_TOKEN" && (
                        <CredentialField
                          label="Access Token"
                          value={credentials.credentialsId}
                          copyKey="token"
                          copiedKey={copiedKey}
                          onCopy={handleCopyValue}
                        />
                      )}

                      {credentials.credentialsType === "MQTT_BASIC" &&
                        (() => {
                          const mqtt = parseMqttCredentialsValue(
                            credentials.credentialsValue
                          );
                          return (
                            <>
                              <CredentialField
                                label="Client ID"
                                value={mqtt.clientId || "-"}
                                copyKey="mqtt-client"
                                copiedKey={copiedKey}
                                onCopy={handleCopyValue}
                              />
                              <CredentialField
                                label="User Name"
                                value={mqtt.userName || "-"}
                                copyKey="mqtt-user"
                                copiedKey={copiedKey}
                                onCopy={handleCopyValue}
                              />
                              <CredentialField
                                label="Password"
                                value={mqtt.password || "-"}
                                copyKey="mqtt-pass"
                                copiedKey={copiedKey}
                                onCopy={handleCopyValue}
                                secret
                              />
                            </>
                          );
                        })()}

                      {credentials.credentialsType === "X509_CERTIFICATE" && (
                        <CredentialField
                          label="RSA Public Key"
                          value={credentials.credentialsValue || "-"}
                          copyKey="x509"
                          copiedKey={copiedKey}
                          onCopy={handleCopyValue}
                          multiline
                        />
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No credentials available
                    </div>
                  )}
                </div>

                <AttributesSection
                  title="Server attributes"
                  isLoading={isLoadingAttributes}
                  error={attributesError}
                  attributes={attributes}
                />
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Add Device Dialog */}
        <Dialog open={addOpen} onOpenChange={handleAddOpenChange}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Add new device</DialogTitle>
              <DialogDescription>
                Step {addStep} of 2 — {addStep === 1 ? "Device details" : "Credentials (optional)"}
              </DialogDescription>
            </DialogHeader>

            {/* Stepper */}
            <div className="flex items-center gap-2 text-xs">
              <div
                className={
                  "flex items-center gap-1.5 " +
                  (addStep === 1
                    ? "text-foreground font-medium"
                    : "text-muted-foreground")
                }
              >
                <span
                  className={
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px] " +
                    (addStep >= 1
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted")
                  }
                >
                  {addStep > 1 ? <Check className="h-3 w-3" /> : "1"}
                </span>
                Device details
              </div>
              <div className="h-px flex-1 bg-border" />
              <div
                className={
                  "flex items-center gap-1.5 " +
                  (addStep === 2
                    ? "text-foreground font-medium"
                    : "text-muted-foreground")
                }
              >
                <span
                  className={
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px] " +
                    (addStep === 2
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted")
                  }
                >
                  2
                </span>
                Credentials
                <span className="text-muted-foreground">(optional)</span>
              </div>
            </div>

            {addStep === 1 ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="device-name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="device-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="My device"
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="device-label">Label</Label>
                  <Input
                    id="device-label"
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                    placeholder="Optional label"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>
                    Device profile <span className="text-destructive">*</span>
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
                  <Label htmlFor="device-description">Description</Label>
                  <Input
                    id="device-description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Optional description"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formIsGateway}
                    onChange={(e) => setFormIsGateway(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  Is gateway
                </label>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Credentials type</Label>
                  <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
                    {(
                      [
                        { v: "ACCESS_TOKEN", l: "Access token" },
                        { v: "X509_CERTIFICATE", l: "X.509" },
                        { v: "MQTT_BASIC", l: "MQTT Basic" },
                      ] as { v: DeviceCredentialsType; l: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setCredType(opt.v)}
                        className={
                          "rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors " +
                          (credType === opt.v
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground")
                        }
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>

                {credType === "ACCESS_TOKEN" && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cred-token">Access token</Label>
                    <div className="flex gap-2">
                      <Input
                        id="cred-token"
                        value={credAccessToken}
                        onChange={(e) => setCredAccessToken(e.target.value)}
                        placeholder="Leave empty for auto-generated"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCredAccessToken(
                            Array.from(
                              crypto.getRandomValues(new Uint8Array(15))
                            )
                              .map((b) =>
                                "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".charAt(
                                  b % 62
                                )
                              )
                              .join("")
                          )
                        }
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {credType === "MQTT_BASIC" && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="cred-client">Client ID</Label>
                      <Input
                        id="cred-client"
                        value={credClientId}
                        onChange={(e) => setCredClientId(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="cred-user">User name</Label>
                      <Input
                        id="cred-user"
                        value={credUserName}
                        onChange={(e) => setCredUserName(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="cred-pass">Password</Label>
                      <Input
                        id="cred-pass"
                        type="password"
                        value={credPassword}
                        onChange={(e) => setCredPassword(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Client ID and/or User name are required.
                    </p>
                  </>
                )}

                {credType === "X509_CERTIFICATE" && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cred-x509">
                      RSA public key (PEM)
                    </Label>
                    <textarea
                      id="cred-x509"
                      value={credX509}
                      onChange={(e) => setCredX509(e.target.value)}
                      rows={6}
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="-----BEGIN PUBLIC KEY-----"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAddOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                {addStep === 2 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddStep(1)}
                    disabled={isSubmitting}
                  >
                    Back
                  </Button>
                )}
                {addStep === 1 ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!formName.trim()) {
                        toast.error("Name is required");
                        return;
                      }
                      if (!formProfileId) {
                        toast.error("Device profile is required");
                        return;
                      }
                      setAddStep(2);
                    }}
                  >
                    Next: Credentials
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleSubmitNewDevice}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Add"
                    )}
                  </Button>
                )}
              </div>
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
