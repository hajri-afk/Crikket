import { Video } from "lucide-react"
import type { Metadata } from "next"

import { BugReportsList } from "./_components/bug-reports/bug-reports-list"
import { InstallExtensionCard } from "./_components/install-extension-card"

const META = {
  title: "Bug Reports",
  description: "View and manage your bug reports",
}

export const metadata: Metadata = {
  title: META.title,
  description: META.description,
}

export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 pt-2">
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <Video className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="font-bold text-2xl tracking-tight sm:text-3xl">
            {META.title}
          </h1>
          <p className="mt-0.5 text-muted-foreground text-sm">
            {META.description}
          </p>
        </div>
      </div>
      <InstallExtensionCard />
      <BugReportsList />
    </div>
  )
}
