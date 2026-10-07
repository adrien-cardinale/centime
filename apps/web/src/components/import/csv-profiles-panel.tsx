import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import i18n from "@/i18n"
import { api, type CsvProfile } from "@/lib/api"
import { accountKindLabels, csvDelimiterLabels, csvEncodingLabels } from "@/lib/labels"
import { csvProfilesQuery, invalidateCsvProfileData } from "@/lib/queries"
import { CsvProfileDialog } from "./csv-profile-dialog"

export function CsvProfilesPanel() {
  const { t } = useTranslation()
  const { data: profiles, isPending, error } = useQuery(csvProfilesQuery)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {t("csvProfiles.panel.intro")}
        </p>
        <CsvProfileDialog
          trigger={
            <Button>
              <Plus />
              {t("csvProfiles.panel.new")}
            </Button>
          }
        />
      </div>
      <Card className="py-0">
        <CardContent className="px-0">
          {isPending && <Skeleton className="m-6 h-5" />}
          {error && <p className="p-6 text-sm text-destructive">{error.message}</p>}
          {profiles && <CsvProfilesTable profiles={profiles} />}
        </CardContent>
      </Card>
    </div>
  )
}

function CsvProfilesTable({ profiles }: { profiles: CsvProfile[] }) {
  const { t } = useTranslation()
  if (profiles.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">{t("csvProfiles.panel.empty")}</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">{t("csvProfiles.panel.columns.name")}</TableHead>
          <TableHead>{t("csvProfiles.panel.columns.type")}</TableHead>
          <TableHead>{t("csvProfiles.panel.columns.encoding")}</TableHead>
          <TableHead>{t("csvProfiles.panel.columns.delimiter")}</TableHead>
          <TableHead>{t("csvProfiles.panel.columns.dateFormat")}</TableHead>
          <TableHead className="pr-6 text-right">{t("csvProfiles.panel.columns.actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {profiles.map((profile) => (
          <TableRow key={profile.id}>
            <TableCell className="pl-6 font-medium">{profile.name}</TableCell>
            <TableCell>
              <Badge variant="secondary">{accountKindLabels[profile.accountKind]}</Badge>
            </TableCell>
            <TableCell>{csvEncodingLabels[profile.encoding]}</TableCell>
            <TableCell>{csvDelimiterLabels[profile.delimiter]}</TableCell>
            <TableCell className="font-mono text-xs">{profile.dateFormat}</TableCell>
            <TableCell className="pr-6">
              <div className="flex justify-end gap-1">
                <CsvProfileDialog
                  profile={profile}
                  trigger={
                    <Button variant="ghost" size="icon" aria-label={t("csvProfiles.panel.edit", { name: profile.name })}>
                      <Pencil />
                    </Button>
                  }
                />
                <DeleteProfileButton profile={profile} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function DeleteProfileButton({ profile }: { profile: CsvProfile }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => api.csvProfiles.remove(profile.id),
    onSuccess: async () => {
      await invalidateCsvProfileData(queryClient)
      toast.success(t("csvProfiles.panel.deleted", { name: profile.name }))
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("csvProfiles.panel.deleteAria", { name: profile.name })}>
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("csvProfiles.panel.deleteTitle", { name: profile.name })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("csvProfiles.panel.deleteDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => remove.mutate()}>{t("csvProfiles.panel.delete")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
