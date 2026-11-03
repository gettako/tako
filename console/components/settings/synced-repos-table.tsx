"use client"

import * as React from "react"
import { ExternalLink, GitBranch, Lock, Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import {
  SearchableSelect,
  type SelectOption,
} from "@/components/ui/searchable-select"
import { type SyncedGitRepo } from "@/types/platform"
import { GitHubIcon } from "@/components/settings/git-connect-modal"

interface SyncedReposTableProps {
  repos: SyncedGitRepo[]
  onToggleAutoDeploy: (repoId: string) => void
}

export function SyncedReposTable({
  repos,
  onToggleAutoDeploy,
}: SyncedReposTableProps) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedOrg, setSelectedOrg] = React.useState("all")

  // Filter organizations from repos
  const orgs = React.useMemo(() => {
    const set = new Set<string>()
    repos.forEach((r) => {
      const parts = r.fullName.split("/")
      if (parts[0]) set.add(parts[0])
    })
    return Array.from(set)
  }, [repos])

  const orgOptions: SelectOption[] = React.useMemo(() => {
    return [
      {
        value: "all",
        label: "All Orgs",
        description: "All connected repository organizations",
      },
      ...orgs.map((org) => ({
        value: org,
        label: org,
        description: `Repositories belonging to ${org}`,
      })),
    ]
  }, [orgs])

  const filteredRepos = React.useMemo(() => {
    return repos.filter((repo) => {
      const matchesSearch =
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        repo.fullName.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesOrg =
        selectedOrg === "all" || repo.fullName.startsWith(`${selectedOrg}/`)
      return matchesSearch && matchesOrg
    })
  }, [repos, searchQuery, selectedOrg])

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-xs sm:p-6">
      <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xs font-semibold text-foreground sm:text-sm">
            Synced Repositories ({filteredRepos.length})
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Repositories synchronized from connected Git integrations available
            for service deployments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Input using shadcn Input */}
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Filter repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-44 rounded-md pr-3 pl-8 text-xs sm:w-56"
            />
          </div>

          {/* Org Filter using SearchableSelect */}
          {orgs.length > 1 && (
            <SearchableSelect
              size="sm"
              className="w-40"
              value={selectedOrg}
              onChange={(val) => setSelectedOrg(val)}
              options={orgOptions}
              placeholder="Filter org..."
              searchPlaceholder="Search organizations..."
            />
          )}
        </div>
      </div>

      {/* Repositories Table */}
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 font-mono text-[11px] text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Repository</th>
                <th className="px-4 py-2.5 font-semibold">Visibility</th>
                <th className="px-4 py-2.5 font-semibold">Default Branch</th>
                <th className="px-4 py-2.5 font-semibold">Last Synced</th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  Auto Deploy on Push
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono text-xs">
              {filteredRepos.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center font-sans text-xs text-muted-foreground"
                  >
                    No repositories match your search filter.
                  </td>
                </tr>
              ) : (
                filteredRepos.map((repo) => (
                  <tr
                    key={repo.id}
                    className="transition-colors hover:bg-muted/20"
                  >
                    <td className="px-4 py-3 font-semibold text-foreground">
                      <a
                        href={repo.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 transition-colors hover:text-primary"
                      >
                        <GitHubIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        <span>{repo.fullName}</span>
                        <ExternalLink className="size-3 text-muted-foreground/60" />
                      </a>
                    </td>

                    <td className="px-4 py-3">
                      {repo.isPrivate ? (
                        <span className="inline-flex items-center gap-1 rounded border border-border/50 bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          <Lock className="size-2.5" />
                          <span>Private</span>
                        </span>
                      ) : (
                        <span className="rounded border border-border/50 bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          Public
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <GitBranch className="size-3 text-muted-foreground" />
                        <span>{repo.defaultBranch}</span>
                      </span>
                    </td>

                    <td className="px-4 py-3 text-[11px] text-muted-foreground">
                      {repo.updatedAt}
                    </td>

                    <td
                      className="px-4 py-3 text-right"
                      aria-label="Auto Deploy on Push"
                    >
                      <label className="inline-flex cursor-pointer items-center gap-2">
                        <span className="font-sans text-[11px] text-muted-foreground">
                          {repo.autoDeploy ? "Enabled" : "Disabled"}
                        </span>
                        <input
                          type="checkbox"
                          aria-label={`Toggle auto deploy for ${repo.name}`}
                          checked={repo.autoDeploy}
                          onChange={() => onToggleAutoDeploy(repo.id)}
                          className="size-3.5 cursor-pointer rounded accent-primary"
                        />
                      </label>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

