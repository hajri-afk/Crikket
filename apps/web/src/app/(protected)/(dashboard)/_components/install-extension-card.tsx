"use client"

import { Button } from "@crikket/ui/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@crikket/ui/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@crikket/ui/components/ui/dialog"
import { Chrome, Download, ExternalLink } from "lucide-react"
import { useEffect, useState } from "react"

const DOCS_URL =
  process.env.NEXT_PUBLIC_DOCS_URL ?? "http://localhost:4000/docs/extension"
const DISMISS_KEY = "crikket:install-extension-dismissed"

export function InstallExtensionCard() {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setDismissed(
      typeof window !== "undefined" &&
        window.localStorage.getItem(DISMISS_KEY) === "1"
    )
  }, [])

  if (dismissed) {
    return null
  }

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1")
    setDismissed(true)
  }

  return (
    <Card className="border-dashed bg-primary/[0.03]">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <Chrome className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base">
              Install Without Web Store
            </CardTitle>
            <CardDescription>
              Build and load the Crikket extension locally to start capturing
              bug reports right away.
            </CardDescription>
          </div>
        </div>
        <Button
          aria-label="Dismiss"
          onClick={dismiss}
          size="sm"
          variant="ghost"
        >
          Dismiss
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row">
        <Dialog>
          <DialogTrigger
            render={
              <Button size="sm">
                <Download className="size-4" />
                Quick install steps
              </Button>
            }
          />
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Install extension (unpacked)</DialogTitle>
              <DialogDescription>
                No Chrome Web Store required.
              </DialogDescription>
            </DialogHeader>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>
                Build the extension:
                <pre className="mt-1 rounded bg-muted px-2 py-1 text-xs">
                  bun run --filter extension build
                </pre>
              </li>
              <li>
                Open{" "}
                <code className="rounded bg-muted px-1">
                  chrome://extensions
                </code>{" "}
                in your browser.
              </li>
              <li>
                Toggle <strong>Developer mode</strong> (top-right).
              </li>
              <li>
                Click <strong>Load unpacked</strong>.
              </li>
              <li>
                Select the folder:
                <pre className="mt-1 rounded bg-muted px-2 py-1 text-xs">
                  apps/extension/.output/chrome-mv3
                </pre>
              </li>
              <li>Pin the Crikket extension and start capturing.</li>
            </ol>
          </DialogContent>
        </Dialog>
        <Button
          nativeButton={false}
          render={
            <a href={DOCS_URL} rel="noopener noreferrer" target="_blank">
              <ExternalLink className="size-4" />
              Full guide
            </a>
          }
          size="sm"
          variant="outline"
        />
      </CardContent>
    </Card>
  )
}
