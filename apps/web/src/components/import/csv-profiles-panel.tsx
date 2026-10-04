import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, Trash2 } from "lucide-react"
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
import { api, type CsvProfile } from "@/lib/api"
import { accountKindLabels, csvDelimiterLabels, csvEncodingLabels } from "@/lib/labels"
import { csvProfilesQuery, invalidateCsvProfileData } from "@/lib/queries"
import { CsvProfileDialog } from "./csv-profile-dialog"

export function CsvProfilesPanel() {
  const { data: profiles, isPending, error } = useQuery(csvProfilesQuery)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Chaque profil décrit le format CSV d'une banque ou d'un émetteur de carte.
        </p>
        <CsvProfileDialog
          trigger={
            <Button>
              <Plus />
              Nouveau profil
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
  if (profiles.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">Aucun profil CSV.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Nom</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Encodage</TableHead>
          <TableHead>Séparateur</TableHead>
          <TableHead>Format de date</TableHead>
          <TableHead className="pr-6 text-right">Actions</TableHead>
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
                    <Button variant="ghost" size="icon" aria-label={`Modifier ${profile.name}`}>
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
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => api.csvProfiles.remove(profile.id),
    onSuccess: async () => {
      await invalidateCsvProfileData(queryClient)
      toast.success(`Profil « ${profile.name} » supprimé`)
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Supprimer ${profile.name}`}>
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer le profil « {profile.name} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            Il ne sera plus proposé à l'import. Les transactions déjà importées sont conservées.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={() => remove.mutate()}>Supprimer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
