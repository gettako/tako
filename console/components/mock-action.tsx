"use client";

import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function MockAction({
  label,
  variant = "default",
  message,
  icon,
}: {
  label: string;
  variant?: "default" | "outline" | "ghost";
  message?: string;
  icon?: ReactNode;
}) {
  return (
    <Button
      variant={variant}
      onClick={() => toast(message ?? `${label} is not wired yet in this prototype.`)}
      className="cursor-pointer"
    >
      {icon}
      {label}
    </Button>
  );
}
