'use client';

import { useState, useEffect } from 'react';

export interface DeploymentLogEvent {
  deployment_id: string;
  step: string;
  message: string;
  status: string;
}

export function useDeploymentLogs(deploymentId: string | null) {
  const [logs, setLogs] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('Queued');
  const [status, setStatus] = useState<string>('queued');
  const [isLive, setIsLive] = useState<boolean>(false);

  useEffect(() => {
    if (!deploymentId || typeof window === 'undefined') return;

    setIsLive(true);
    const es = new EventSource(`/api/sse/deployments/${deploymentId}/logs`);

    es.addEventListener('log', (e) => {
      try {
        const data = JSON.parse(e.data) as DeploymentLogEvent;
        if (data.message) {
          setLogs((prev) => [...prev, data.message]);
        }
        if (data.step) {
          setCurrentStep(data.step);
        }
        if (data.status) {
          setStatus(data.status);
          if (data.status === 'live' || data.status === 'failed') {
            setIsLive(false);
          }
        }
      } catch {
        if (e.data) {
          setLogs((prev) => [...prev, e.data]);
        }
      }
    });

    es.onerror = () => {
      setIsLive(false);
      es.close();
    };

    return () => {
      es.close();
      setIsLive(false);
    };
  }, [deploymentId]);

  return { logs, currentStep, status, isLive };
}
