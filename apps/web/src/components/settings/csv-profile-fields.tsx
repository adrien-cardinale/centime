import type { CsvProfileInput } from "@centime/core"
import type { Control, FieldPathByValue } from "react-hook-form"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { CsvProfileFormValues } from "@/lib/csv-profile-form"

export type CsvProfileControl = Control<CsvProfileFormValues, unknown, CsvProfileInput>

type TextFieldProps = {
  control: CsvProfileControl
  name: FieldPathByValue<CsvProfileFormValues, string>
  label: string
  placeholder?: string
  description?: string
}

export function TextField({ control, name, label, placeholder, description }: TextFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input placeholder={placeholder} {...field} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

type SelectFieldProps = {
  control: CsvProfileControl
  name: FieldPathByValue<CsvProfileFormValues, string>
  label: string
  options: Record<string, string>
}

export function SelectField({ control, name, label, options }: SelectFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {Object.entries(options).map(([value, optionLabel]) => (
                <SelectItem key={value} value={value}>
                  {optionLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
