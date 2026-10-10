'use client';

import React, { useState, useEffect } from 'react';
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
import { CopyButton } from '@/components/ui/copy-button';
import { ArrowRight, Download, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react';
import { use2FASetup, useVerifyAndEnable2FA } from '@/lib/queries';
import { toast } from 'sonner';

interface TotpSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => Promise<void>;
}

export function TotpSetupDialog({
  open,
  onOpenChange,
  onComplete,
}: TotpSetupDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const { data: setupData, isLoading: isLoadingSetup } = use2FASetup(open);
  const verifyMutation = useVerifyAndEnable2FA();

  useEffect(() => {
    if (open) {
      setStep(1);
      setCode('');
    }
  }, [open]);

  const handleDownloadRecoveryCodes = () => {
    if (!setupData) return;
    const blob = new Blob([
      `TAKO CLUSTER - EMERGENCY RECOVERY CODES\nGenerated: ${new Date().toISOString()}\n\n` +
      setupData.recoveryCodes.join('\n') +
      `\n\nKeep these codes in a safe place. Each code can be used once.`
    ], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tako-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Recovery codes downloaded');
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupData) return;
    if (code.length < 6) {
      toast.error('Please enter the 6-digit code from your authenticator');
      return;
    }

    try {
      setIsVerifying(true);
      await verifyMutation.mutateAsync({
        code,
        secret: setupData.secret,
        recoveryCodes: setupData.recoveryCodes,
      });
      setStep(3); // Proceed to recovery codes confirmation
    } catch {
      // Error handled by mutation toast
    } finally {
      setIsVerifying(false);
    }
  };

  const handleFinish = async () => {
    await onComplete();
    toast.success('Two-factor authentication successfully enabled');
    onOpenChange(false);
    setStep(1);
    setCode('');
  };

  const qrImageUrl = setupData?.otpauthUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&format=svg&data=${encodeURIComponent(setupData.otpauthUrl)}`
    : '';

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
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Two-Factor Authentication Setup
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Step {step} of 3: {step === 1 ? 'Scan Authenticator QR' : step === 2 ? 'Verify 6-Digit Code' : 'Save Recovery Codes'}
          </DialogDescription>
        </DialogHeader>

        {isLoadingSetup ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground text-xs">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span>Generating secure cryptographic key...</span>
          </div>
        ) : setupData ? (
          <>
            {/* Step 1: Scan QR Code */}
            {step === 1 && (
              <div className="space-y-4 py-2 text-xs">
                <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-white dark:bg-card">
                  {qrImageUrl && (
                    <img
                      src={qrImageUrl}
                      alt="TOTP QR Code"
                      className="size-40 rounded-lg p-1 bg-white border border-border object-contain"
                    />
                  )}
                  <p className="text-[11px] text-muted-foreground mt-3 text-center">
                    Scan with Google Authenticator, 1Password, Bitwarden, or Apple Keychain.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] text-muted-foreground">Or enter manual secret key:</span>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={setupData.secret}
                      className="font-mono text-xs text-center font-bold tracking-widest bg-muted/40 h-9"
                    />
                    <CopyButton
                      text={setupData.secret}
                      size="sm"
                      className="h-9 px-3 text-xs shrink-0"
                      title="Copy Secret"
                    />
                  </div>
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setStep(2)}
                    className="w-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5 h-9 active:not-aria-[haspopup]:translate-y-px"
                  >
                    <span>Next: Verify Code</span>
                    <ArrowRight className="size-3.5" />
                  </Button>
                </DialogFooter>
              </div>
            )}

            {/* Step 2: Code Verification */}
            {step === 2 && (
              <form onSubmit={handleVerifyCode} className="space-y-4 py-2 text-xs">
                <p className="text-muted-foreground">
                  Enter the 6-digit code currently shown in your authenticator app to complete setup:
                </p>

                <div className="flex justify-center py-3">
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    autoFocus
                    className="w-48 text-center text-2xl font-mono tracking-widest h-12 font-bold bg-muted/20 border-primary/50 focus-visible:ring-primary"
                  />
                </div>

                <DialogFooter className="gap-2 sm:gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setStep(1)}
                    disabled={isVerifying}
                    className="text-xs h-9 active:not-aria-[haspopup]:translate-y-px"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={code.length < 6 || isVerifying}
                    className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1.5 h-9 active:not-aria-[haspopup]:translate-y-px"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify Code'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            )}

            {/* Step 3: Emergency Recovery Codes */}
            {step === 3 && (
              <div className="space-y-4 py-2 text-xs">
                <div className="flex items-center gap-2 text-status-success text-xs font-semibold">
                  <CheckCircle2 className="size-4" />
                  <span>Authenticator Verified Successfully</span>
                </div>

                <p className="text-muted-foreground">
                  Store these one-time recovery codes safely. If you lose access to your device, each code can be used once as an emergency backup.
                </p>

                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg border border-border bg-muted/40 font-mono text-[11px] text-center text-foreground font-semibold">
                  {setupData.recoveryCodes.map((c, i) => (
                    <div key={i} className="py-1">
                      {c}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <CopyButton
                    text={setupData.recoveryCodes.join('\n')}
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs gap-1.5 h-8"
                    title="Copy Codes"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadRecoveryCodes}
                    className="flex-1 text-xs gap-1.5 h-8 active:not-aria-[haspopup]:translate-y-px"
                  >
                    <Download className="size-3.5" />
                    Download .txt
                  </Button>
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleFinish}
                    className="w-full text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-9 active:not-aria-[haspopup]:translate-y-px"
                  >
                    Complete Two-Factor Setup
                  </Button>
                </DialogFooter>
              </div>
            )}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
