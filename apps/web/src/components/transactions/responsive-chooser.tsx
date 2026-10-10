import type { ReactNode } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"

type ResponsiveChooserProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  trigger: ReactNode
  children: ReactNode
}

export function ResponsiveChooser({ open, onOpenChange, title, trigger, children }: ResponsiveChooserProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          aria-describedby={undefined}
          // Le focus initial ouvrirait le clavier virtuel et masquerait la liste ; la recherche reste accessible au tap.
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="gap-0"
        >
          <SheetHeader className="pr-14">
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="border-t **:data-[slot=command-list]:max-h-[60dvh]">{children}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        {children}
      </PopoverContent>
    </Popover>
  )
}
