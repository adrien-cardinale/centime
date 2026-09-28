import { useQuery } from "@tanstack/react-query"
import { AccountSelect } from "@/components/accounts/account-select"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ImportPreview } from "@/lib/api"
import { importFormatLabels } from "@/lib/labels"
import { csvProfilesQuery } from "@/lib/queries"

type ImportOptionsProps = {
  preview: ImportPreview
  profileId: string | undefined
  accountId: string | undefined
  onProfileChange: (profileId: string) => void
  onAccountChange: (accountId: string | undefined) => void
}

export function ImportOptions({ preview, profileId, accountId, onProfileChange, onAccountChange }: ImportOptionsProps) {
  const isCsv = preview.format === "csv"
  const needsAccount = preview.accountResolution === "required"

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2">
        <Label>Format détecté</Label>
        <div className="flex h-9 items-center">
          <Badge variant="secondary">{importFormatLabels[preview.format]}</Badge>
        </div>
      </div>
      {isCsv && (
        <ProfileSelect value={profileId ?? preview.profile?.id} detected={preview.profile !== null} onChange={onProfileChange} />
      )}
      {needsAccount && (
        <div className="space-y-2">
          <Label htmlFor="import-account">Compte de destination</Label>
          <AccountSelect id="import-account" value={accountId} onChange={onAccountChange} />
          {!accountId && <p className="text-xs text-destructive">Ce fichier n'indique pas le compte : choisissez-le.</p>}
        </div>
      )}
    </div>
  )
}

type ProfileSelectProps = {
  value: string | undefined
  detected: boolean
  onChange: (profileId: string) => void
}

function ProfileSelect({ value, detected, onChange }: ProfileSelectProps) {
  const { data: profiles = [] } = useQuery(csvProfilesQuery)

  return (
    <div className="space-y-2">
      <Label htmlFor="import-profile">Profil CSV</Label>
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger id="import-profile" className="w-full">
          <SelectValue placeholder="Choisir un profil" />
        </SelectTrigger>
        <SelectContent>
          {profiles.map((profile) => (
            <SelectItem key={profile.id} value={profile.id}>
              {profile.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!detected && <p className="text-xs text-destructive">Profil non reconnu : choisissez-le.</p>}
    </div>
  )
}
