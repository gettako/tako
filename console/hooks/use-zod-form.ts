"use client"

import * as React from "react"
import type { z } from "zod"

export type FormErrors = Record<string, string>

export function useZodForm<T extends z.ZodType>(schema: T) {
  const [errors, setErrors] = React.useState<FormErrors>({})

  const validate = React.useCallback(
    (values: z.input<T>): z.output<T> | null => {
      const result = schema.safeParse(values)
      if (result.success) {
        setErrors({})
        return result.data
      }

      const nextErrors: FormErrors = {}
      for (const issue of result.error.issues) {
        const field = issue.path.map((segment) => String(segment)).join(".")
        if (field && !nextErrors[field]) {
          nextErrors[field] = issue.message
        }
      }

      setErrors(nextErrors)
      return null
    },
    [schema]
  )

  const clearError = React.useCallback((field: string) => {
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }, [])

  return { errors, validate, clearError, setErrors }
}
