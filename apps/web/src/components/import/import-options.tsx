import { useQuery } from "@tanstack/react-query"
import { Pencil, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { AccountSelect } from "@/components/accounts/account-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { CsvProfile, ImportPreview } from "@/lib/api"
import { importFormatLabels } from "@/lib/labels"
import { csvProfilesQuery } from "@/lib/queries"
import { CsvProfileDialog } from "./csv-profile-dialog"

type ImportOptionsProps = {
  file: File
  preview: ImportPreview
  profileId: string | undefined
  accountId: string | undefined
  onProfileChange: (profileId: string) => void
  onAccountChange: (accountId: string | undefined) => void
}

export function ImportOptions({
  file,
  preview,
  profileId,
  accountId,
  onProfileChange,
  onAccountChange,
}: ImportOptionsProps) {
  const { t } = useTranslation()
  const isCsv = preview.format === "csv"
  const needsAccount = preview.accountResolution === "required"

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2">
        <Label>{t("importWorkspace.options.detectedFormat")}</Label>
        <div className="flex h-9 items-center">
          <Badge variant="secondary">{importFormatLabels[preview.format]}</Badge>
        </div>
      </div>
      {isCsv && (
        <ProfileSelect
          file={file}
          value={profileId ?? preview.profile?.id}
          detected={preview.profile !== null}
          onChange={onProfileChange}
        />
      )}
      {needsAccount && (
        <div className="space-y-2">
          <Label htmlFor="import-account">{t("importWorkspace.options.destinationAccount")}</Label>
          <AccountSelect id="import-account" value={accountId} onChange={onAccountChange} />
          {!accountId && <p className="text-xs text-destructive">{t("importWorkspace.options.accountMissing")}</p>}
        </div>
      )}
    </div>
  )
}

type ProfileSelectProps = {
  file: File
  value: string | undefined
  detected: boolean
  onChange: (profileId: string) => void
}

function ProfileSelect({ file, value, detected, onChange }: ProfileSelectProps) {
  const { t } = useTranslation()
  const { data: profiles = [] } = useQuery(csvProfilesQuery)
  const selected = profiles.find((profile) => profile.id === value)
  const selectSaved = (saved: CsvProfile) => onChange(saved.id)

  return (
    <div className="space-y-2">
      <Label htmlFor="import-profile">{t("importWorkspace.options.profile")}</Label>
      <div className="flex gap-1">
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger id="import-profile" className="min-w-0 flex-1">
            <SelectValue placeholder={t("importWorkspace.options.profilePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {profiles.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profile.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected && (
          <CsvProfileDialog
            profile={selected}
            sourceFile={file}
            onSaved={selectSaved}
            trigger={
              <Button variant="ghost" size="icon" aria-label={t("importWorkspace.options.edit", { name: selected.name })}>
                <Pencil />
              </Button>
            }
          />
        )}
        <CsvProfileDialog
          sourceFile={file}
          onSaved={selectSaved}
          trigger={
            <Button variant="ghost" size="icon" aria-label={t("importWorkspace.options.newProfile")}>
              <Plus />
            </Button>
          }
        />
      </div>
      {!detected && <p className="text-xs text-destructive">{t("importWorkspace.options.profileUnrecognized")}</p>}
    </div>
  )
}
