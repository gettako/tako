'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, Layers, SearchX, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ViewToggle, ViewMode } from '@/components/ui/view-toggle';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProjectDetailHeader } from '@/components/projects/project-detail-header';
import { ServiceCard } from '@/components/projects/service-card';
import { ServiceRow } from '@/components/projects/service-row';
import { CreateServiceDialog } from '@/components/services/create-service-dialog';
import { DeleteProjectDialog } from '@/components/projects/delete-project-dialog';
import { EditProjectDialog } from '@/components/projects/edit-project-dialog';
import { getProjectById } from '@/lib/api/projects';
import { getServices } from '@/lib/api/services';

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = React.use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [createServiceOpen, setCreateServiceOpen] = useState(false);
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setCreateServiceOpen(true);
    window.addEventListener('open-create-service-dialog', handleOpen);
    return () => window.removeEventListener('open-create-service-dialog', handleOpen);
  }, []);

  const {
    data: project,
    isLoading: loadingProject,
    error: errorProject,
    refetch: refetchProject,
  } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProjectById(projectId),
  });

  const {
    data: services = [],
    isLoading: loadingServices,
    error: errorServices,
  } = useQuery({
    queryKey: ['services', projectId],
    queryFn: () => getServices(projectId),
    enabled: !!project,
  });

  const filteredServices = useMemo(() => {
    if (!searchQuery.trim()) return services;
    const q = searchQuery.toLowerCase();
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.type.toLowerCase().includes(q) ||
        s.nodeName.toLowerCase().includes(q) ||
        s.domains.some((d) => d.domain.toLowerCase().includes(q))
    );
  }, [services, searchQuery]);

  const titleText = project ? `${project.name} — Takō Cloud` : 'Project Details — Takō Cloud';

  if (errorProject || errorServices) {
    return (
      <>
        <title>{titleText}</title>
        <ErrorState
          title="Failed to load project"
          description="Could not retrieve the project details and services. Please retry."
          retry={() => refetchProject()}
        />
      </>
    );
  }

  if (loadingProject || !project) {
    return (
      <>
        <title>{titleText}</title>
        <LoadingSkeleton variant="detail" />
      </>
    );
  }

  return (
    <>
      <title>{titleText}</title>
      <div className="space-y-6">
        {/* Project KPI Header */}
        <ProjectDetailHeader
          project={project}
          services={services}
          onNewService={() => setCreateServiceOpen(true)}
          onEditProject={() => setEditProjectOpen(true)}
          onDeleteProject={() => setDeleteProjectOpen(true)}
        />

        {/* Services Controls Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Filter services by name, type, domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm rounded-lg bg-card/60 border-border focus-visible:ring-3"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">
              Showing <strong className="text-foreground font-semibold">{filteredServices.length}</strong> of{' '}
              {services.length} services
            </span>
            <ViewToggle mode={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {/* Main Services Listing */}
        {loadingServices ? (
          <LoadingSkeleton variant={viewMode === 'grid' ? 'cards' : 'table'} count={3} />
        ) : filteredServices.length === 0 ? (
          searchQuery ? (
            <EmptyState
              title="No services match search"
              description={`No workloads match "${searchQuery}" in this project.`}
              icon={SearchX}
              action={{
                label: 'Clear Search',
                onClick: () => setSearchQuery(''),
              }}
            />
          ) : (
            <EmptyState
              title="No services added yet"
              description="This project currently has no active services or databases. Deploy your first workload now."
              icon={Layers}
              action={{
                label: 'Deploy First Service',
                icon: Plus,
                onClick: () => setCreateServiceOpen(true),
              }}
            />
          )
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredServices.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40 border-b border-border">
                <TableRow className="h-10 hover:bg-transparent">
                  <TableHead className="w-[260px]">Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Node</TableHead>
                  <TableHead className="hidden md:table-cell">Primary Domain / Endpoint</TableHead>
                  <TableHead className="hidden lg:table-cell">Resources & Replicas</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredServices.map((service) => (
                  <ServiceRow key={service.id} service={service} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <CreateServiceDialog
        open={createServiceOpen}
        onOpenChange={setCreateServiceOpen}
        projectId={projectId}
        onSuccess={(newService) => {
          router.push(`/projects/${projectId}/services/${newService.id}`);
        }}
      />

      <EditProjectDialog
        open={editProjectOpen}
        onOpenChange={setEditProjectOpen}
        project={project}
        onSuccess={(updatedProject) => {
          if (updatedProject.id !== projectId && updatedProject.slug !== projectId) {
            router.push(`/projects/${updatedProject.slug || updatedProject.id}`);
          } else {
            refetchProject();
          }
        }}
      />

      <DeleteProjectDialog
        open={deleteProjectOpen}
        onOpenChange={setDeleteProjectOpen}
        project={project}
        servicesCount={services.length}
        onSuccess={() => {
          router.push('/projects');
        }}
      />

    </>
  );
}
