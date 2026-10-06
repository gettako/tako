'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getServiceById } from '@/lib/api/services';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

export default function ServiceRedirectPage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const resolvedParams = React.use(params);
  const router = useRouter();

  const { data: service, isLoading, error } = useQuery({
    queryKey: ['service', resolvedParams.serviceId],
    queryFn: () => getServiceById(resolvedParams.serviceId),
  });

  useEffect(() => {
    if (service) {
      router.replace(`/projects/${service.projectId}/services/${service.id}`);
    }
  }, [service, router]);

  if (error) {
    return (
      <>
        <title>Service Not Found — Takō Cloud</title>
        <ErrorState
          title="Service not found"
          description={`Could not resolve service ID: ${resolvedParams.serviceId}`}
        />
      </>
    );
  }

  return (
    <>
      <title>Redirecting to Service — Takō Cloud</title>
      <LoadingSkeleton variant="detail" />
    </>
  );
}
