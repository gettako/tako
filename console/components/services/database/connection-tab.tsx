'use client';

import React, { useState } from 'react';
import { Copy, Check, Eye, EyeOff, Database, Server, Key, User, Globe } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { Button } from '@/components/ui/button';
import { Service } from '@/lib/types';

export interface ConnectionTabProps {
  service: Service;
}

export function ConnectionTab({ service }: ConnectionTabProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const envMap = new Map((service.envVars || []).map((e) => [e.key, e.value]));
  const dbUser = envMap.get('POSTGRES_USER') || envMap.get('MYSQL_USER') || envMap.get('MONGO_INITDB_ROOT_USERNAME') || envMap.get('DB_USER') || 'tako_admin';
  const dbPass = envMap.get('POSTGRES_PASSWORD') || envMap.get('MYSQL_PASSWORD') || envMap.get('MYSQL_ROOT_PASSWORD') || envMap.get('REDIS_PASSWORD') || envMap.get('DB_PASSWORD') || 'p@ssw0rd123!';
  const dbHost = service.nodeName || '127.0.0.1';
  const defaultPort = service.databaseType === 'mysql' ? 3306 : service.databaseType === 'redis' ? 6379 : service.databaseType === 'mongodb' ? 27017 : 5432;
  const dbPort = service.ports?.[0] || defaultPort;
  const dbName = envMap.get('POSTGRES_DB') || envMap.get('MYSQL_DATABASE') || envMap.get('MONGO_INITDB_DATABASE') || envMap.get('DB_NAME') || 'production_db';

  const connectionUri = service.connectionString || (
    service.databaseType === 'redis'
      ? `redis://:${dbPass}@${dbHost}:${dbPort}/0`
      : `${service.databaseType || 'postgresql'}://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${dbName}`
  );
  const maskedUri = service.connectionString
    ? service.connectionString.replace(/:([^@]+)@/, ':••••••••@')
    : (service.databaseType === 'redis'
        ? `redis://:••••••••@${dbHost}:${dbPort}/0`
        : `${service.databaseType || 'postgresql'}://${dbUser}:••••••••@${dbHost}:${dbPort}/${dbName}`);

  const copyValue = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Database}
        title="Database Connection Parameters"
        description="Credentials and connection endpoints for internal workloads and client tools"
      />

      {/* Main Connection URI Card */}
      <Card className="p-6 space-y-4">
        <SectionHeader
          icon={Key}
          title="Direct Connection URI"
          description="Driver connection string for ORMs and database clients"
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPassword(!showPassword)}
                className="gap-1 text-xs h-7"
              >
                {showPassword ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                <span>{showPassword ? 'Mask' : 'Reveal'}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => copyValue(connectionUri, 'uri')}
                className="gap-1 text-xs h-7"
              >
                {copiedKey === 'uri' ? (
                  <>
                    <Check className="size-3 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3" />
                    <span>Copy URI</span>
                  </>
                )}
              </Button>
            </div>
          }
        />

        <div className="rounded-md border border-border bg-[#0B0C14] p-3 font-mono text-xs text-white select-all overflow-x-auto">
          {showPassword ? connectionUri : maskedUri}
        </div>
      </Card>

      {/* Discrete Parameters Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Server className="size-3.5" />
              Host
            </span>
            <button
              onClick={() => copyValue(dbHost, 'host')}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              {copiedKey === 'host' ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
            </button>
          </div>
          <p className="font-mono text-xs font-semibold text-foreground">{dbHost}</p>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Globe className="size-3.5" />
              Port
            </span>
            <button
              onClick={() => copyValue(String(dbPort), 'port')}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              {copiedKey === 'port' ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
            </button>
          </div>
          <p className="font-mono text-xs font-semibold text-foreground">{dbPort}</p>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Database className="size-3.5" />
              Database
            </span>
            <button
              onClick={() => copyValue(dbName, 'db')}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              {copiedKey === 'db' ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
            </button>
          </div>
          <p className="font-mono text-xs font-semibold text-foreground">{dbName}</p>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <User className="size-3.5" />
              User
            </span>
            <button
              onClick={() => copyValue(dbUser, 'user')}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              {copiedKey === 'user' ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
            </button>
          </div>
          <p className="font-mono text-xs font-semibold text-foreground">{dbUser}</p>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Key className="size-3.5" />
              Password
            </span>
            <button
              onClick={() => copyValue(dbPass, 'pass')}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              {copiedKey === 'pass' ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
            </button>
          </div>
          <p className="font-mono text-xs font-semibold text-foreground">
            {showPassword ? dbPass : '••••••••••••'}
          </p>
        </Card>
      </div>
    </div>
  );
}
