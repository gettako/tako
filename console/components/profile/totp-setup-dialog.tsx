'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { QrCode, Copy, Check, ArrowRight, Download, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface TotpSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => Promise<void>;
}

const SECRET_KEY = 'JBSWY3DPEHPK3PXP';
const RECOVERY_CODES = [
  '8a7b-9c2d',
  '4e5f-6a7b',
  '1c2d-3e4f',
  '9a0b-1c2d',
  '5e6f-7a8b',
  '2c3d-4e5f',
  '0a1b-2c3d',
  '6e7f-8a9b',
];

export function TotpSetupDialog({
  open,
  onOpenChange,
  onComplete,
}: TotpSetupDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [code, setCode] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleCopySecret = () => {
    navigator.clipboard.writeText(SECRET_KEY);
    setCopiedSecret(true);
    toast.success('Secret key copied');
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleCopyRecoveryCodes = () => {
    navigator.clipboard.writeText(RECOVERY_CODES.join('\n'));
    setCopiedCodes(true);
    toast.success('Recovery codes copied');
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) {
      toast.error('Please enter a 6-digit authentication code');
      return;
    }

    setIsVerifying(true);
    await new Promise((r) => setTimeout(r, 400));
    setIsVerifying(false);
    setStep(3); // proceed to recovery codes step
  };

  const handleFinish = async () => {
    await onComplete();
    toast.success('Two-factor authentication successfully enabled');
    onOpenChange(false);
    setStep(1);
    setCode('');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        onOpenChange(val);
        if (!val) {
          setStep(1);
          setCode('');
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Set Up Two-Factor Authentication (TOTP)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Step {step} of 3: {step === 1 ? 'Scan QR Code' : step === 2 ? 'Verify 6-Digit Code' : 'Save Recovery Codes'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: QR Code & Manual Secret Key */}
        {step === 1 && (
          <div className="space-y-4 py-3 text-xs">
            <div className="flex flex-col items-center justify-center p-4 rounded-lg border border-border/60 bg-white dark:bg-card">
              {/* Simulated QR Code matrix illustration */}
              <div className="size-40 p-2 border-2 border-zinc-900 rounded-md bg-white flex flex-col justify-between">
                <div className="flex justify-between">
                  <div className="size-9 bg-zinc-950 rounded-xs flex items-center justify-center">
                    <div className="size-4 bg-white" />
                  </div>
                  <div className="size-9 bg-zinc-950 rounded-xs flex items-center justify-center">
                    <div className="size-4 bg-white" />
                  </div>
                </div>
                <div className="flex justify-center items-center">
                  <QrCode className="size-10 text-zinc-950" />
                </div>
                <div className="flex justify-between">
                  <div className="size-9 bg-zinc-950 rounded-xs flex items-center justify-center">
                    <div className="size-4 bg-white" />
                  </div>
                  <div className="size-4 bg-zinc-950" />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3 text-center">
                Scan with Google Authenticator, 1Password, or Authy.
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] text-muted-foreground">Or enter manual key:</span>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={SECRET_KEY}
                  className="font-mono text-xs text-center font-bold tracking-wider bg-muted/40"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopySecret}
                  className="h-9 px-3 text-xs shrink-0"
                >
                  {copiedSecret ? (
                    <Check className="size-3.5 text-status-success" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                size="sm"
                onClick={() => setStep(2)}
                className="w-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5"
              >
                <span>Continue</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: 6-Digit Code Verification Input */}
        {step === 2 && (
          <form onSubmit={handleVerifyCode} className="space-y-4 py-3 text-xs">
            <p className="text-muted-foreground">
              Enter the 6-digit code displayed in your authenticator app to confirm configuration:
            </p>

            <div className="flex justify-center py-2">
              <Input
                type="text"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                autoFocus
                className="w-48 text-center text-xl font-mono tracking-widest h-12 font-bold"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep(1)}
                className="text-xs"
              >
                Back
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={code.length < 6 || isVerifying}
                className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5"
              >
                {isVerifying ? 'Verifying...' : 'Verify Code'}
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* Step 3: Emergency Recovery Codes */}
        {step === 3 && (
          <div className="space-y-4 py-3 text-xs">
            <div className="flex items-center gap-2 text-status-success text-xs font-semibold">
              <CheckCircle2 className="size-4" />
              <span>Authenticator Verified Successfully</span>
            </div>

            <p className="text-muted-foreground">
              Save these one-time recovery codes in a safe location. They allow emergency access if you lose your phone or security device.
            </p>

            <div className="grid grid-cols-2 gap-2 p-3 rounded-lg border border-border/80 bg-[#0B0C14] text-[#939DB8] font-mono text-[11px] text-center">
              {RECOVERY_CODES.map((c, i) => (
                <div key={i} className="py-1">
                  {c}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyRecoveryCodes}
                className="flex-1 text-xs gap-1.5"
              >
                {copiedCodes ? (
                  <Check className="size-3.5 text-status-success" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                Copy Codes
              </Button>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                size="sm"
                onClick={handleFinish}
                className="w-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              >
                Complete Two-Factor Setup
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
