'use client';

import { useState, useEffect, useRef } from 'react';
import { getDeploymentLogsStreamUrl } from '@/lib/api/deployments';

export interface DeploymentLogEvent {
  deployment_id: string;
  step: string;
  message: string;
  status: string;
}

const MAX_LOGS = 1500;
const BATCH_INTERVAL_MS = 60;

export function useDeploymentLogs(deploymentId: string | null) {
  const [logs, setLogs] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('Queued');
  const [status, setStatus] = useState<string>('queued');
  const [isLive, setIsLive] = useState<boolean>(false);

  const bufferRef = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!deploymentId || typeof window === 'undefined') return;

    setIsLive(true);
    setLogs([]);
    bufferRef.current = [];

    const flushBuffer = () => {
      if (bufferRef.current.length > 0) {
        const chunk = bufferRef.current;
        bufferRef.current = [];
        setLogs((prev) => {
          const next = [...prev, ...chunk];
          return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next;
        });
      }
      timerRef.current = null;
    };

    const scheduleFlush = () => {
      if (!timerRef.current) {
        timerRef.current = setTimeout(flushBuffer, BATCH_INTERVAL_MS);
      }
    };

    const es = new EventSource(getDeploymentLogsStreamUrl(deploymentId));

    es.addEventListener('log', (e) => {
      try {
        const data = JSON.parse(e.data) as DeploymentLogEvent;
        if (data.message) {
          bufferRef.current.push(data.message);
          scheduleFlush();
        }
        if (data.step) {
          setCurrentStep(data.step);
        }
        if (data.status) {
          setStatus(data.status);
          if (data.status === 'live' || data.status === 'failed') {
            setIsLive(false);
            flushBuffer();
          }
        }
      } catch {
        if (e.data) {
          bufferRef.current.push(e.data);
          scheduleFlush();
        }
      }
    });

    es.onerror = () => {
      setIsLive(false);
      flushBuffer();
      es.close();
    };

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      flushBuffer();
      es.close();
      setIsLive(false);
    };
  }, [deploymentId]);

  return { logs, currentStep, status, isLive };
}

