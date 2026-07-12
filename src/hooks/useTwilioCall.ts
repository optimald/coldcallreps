'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Device, Call } from '@twilio/voice-sdk';

type Options = {
  onCallStarted?: () => void;
  onCallEnded?: (duration: number, callLogId: string | null) => void;
  onCallError?: (error: string) => void;
};

type State = {
  isConnected: boolean;
  isCallActive: boolean;
  isMuted: boolean;
  callDuration: number;
  callerNumber: string;
  /** Brand / platform CallerId shown to the prospect (masked). */
  fromNumber: string | null;
  matchedLocal: boolean | null;
  brandName: string | null;
  error: string | null;
  currentCallLogId: string | null;
  configured: boolean | null;
  /** Inbound callback ringing the browser client. */
  incomingFrom: string | null;
  incomingCall: boolean;
};

export function useTwilioCall(options: Options = {}) {
  const [state, setState] = useState<State>({
    isConnected: false,
    isCallActive: false,
    isMuted: false,
    callDuration: 0,
    callerNumber: '',
    fromNumber: null,
    matchedLocal: null,
    brandName: null,
    error: null,
    currentCallLogId: null,
    configured: null,
    incomingFrom: null,
    incomingCall: false,
  });

  const optionsRef = useRef(options);
  optionsRef.current = options;
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const currentCallLogIdRef = useRef<string | null>(null);
  const bindCallRef = useRef<(call: Call) => void>(() => undefined);

  const bindCall = useCallback((call: Call) => {
    callRef.current = call;

    call.on('accept', () => {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setState((s) => ({
          ...s,
          callDuration: Math.floor((Date.now() - startTimeRef.current) / 1000),
        }));
      }, 1000);
      const callSid = (call.parameters as { CallSid?: string } | undefined)?.CallSid || null;
      setState((s) => ({ ...s, isCallActive: true }));

      const logId = currentCallLogIdRef.current;
      if (logId && callSid) {
        void fetch('/api/calls/outbound', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callLogId: logId, telephonyCallSid: callSid, status: 'in-progress' }),
        });
      }
      optionsRef.current.onCallStarted?.();
    });

    call.on('disconnect', () => {
      const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
      if (timerRef.current) clearInterval(timerRef.current);
      callRef.current = null;
      const logId = currentCallLogIdRef.current;
      if (logId) {
        void fetch('/api/calls/outbound', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callLogId: logId, duration, status: 'completed' }),
        });
      }
      setState((s) => ({
        ...s,
        isCallActive: false,
        isMuted: false,
        callDuration: 0,
        currentCallLogId: null,
        incomingCall: false,
        incomingFrom: null,
      }));
      optionsRef.current.onCallEnded?.(duration, logId);
    });

    call.on('error', (err: { message?: string }) => {
      const msg = err.message || 'Call error';
      setState((s) => ({ ...s, error: msg, isCallActive: false, incomingCall: false }));
      optionsRef.current.onCallError?.(msg);
      if (timerRef.current) clearInterval(timerRef.current);
      callRef.current = null;
    });
  }, []);

  bindCallRef.current = bindCall;

  useEffect(() => {
    let mounted = true;
    let pending: Device | null = null;

    async function init() {
      try {
        const tokenRes = await fetch('/api/twilio/token');
        if (!mounted) return;
        if (!tokenRes.ok) {
          setState((s) => ({ ...s, configured: false, error: 'Could not load dialer token' }));
          return;
        }
        const data = await tokenRes.json();
        if (!mounted) return;
        if (!data.token) {
          setState((s) => ({
            ...s,
            configured: false,
            error: null,
          }));
          return;
        }

        const device = new Device(data.token, {
          logLevel: 1,
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
        });
        pending = device;

        device.on('registered', () => {
          if (mounted) setState((s) => ({ ...s, isConnected: true, configured: true, error: null }));
        });
        device.on('unregistered', () => {
          deviceRef.current = null;
          if (mounted) setState((s) => ({ ...s, isConnected: false }));
        });
        device.on('error', (err: { message?: string }) => {
          if (mounted) setState((s) => ({ ...s, error: err.message || 'Twilio connection error' }));
        });
        device.on('tokenWillExpire', async () => {
          try {
            const refresh = await fetch('/api/twilio/token');
            if (refresh.ok) {
              const { token } = await refresh.json();
              if (token && mounted) device.updateToken(token);
            }
          } catch {
            /* ignore */
          }
        });

        device.on('incoming', (call: Call) => {
          if (!mounted) return;
          const params = call.parameters as Record<string, string> | undefined;
          const from = params?.From || params?.Caller || 'Unknown';
          setState((s) => ({
            ...s,
            incomingCall: true,
            incomingFrom: String(from),
            error: null,
          }));
          call.on('cancel', () => {
            setState((s) => ({ ...s, incomingCall: false, incomingFrom: null }));
          });
          try {
            call.accept();
            bindCallRef.current(call);
            setState((s) => ({
              ...s,
              incomingCall: false,
              isCallActive: true,
              callerNumber: String(from),
            }));
            optionsRef.current.onCallStarted?.();
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Could not answer inbound call';
            setState((s) => ({ ...s, error: msg, incomingCall: false }));
          }
        });

        await device.register();
        pending = null;
        if (!mounted) {
          device.destroy();
          return;
        }
        deviceRef.current = device;
        setState((s) => ({ ...s, configured: true }));
      } catch (err: unknown) {
        pending = null;
        const msg = err instanceof Error ? err.message : 'Unknown error';
        if (mounted) setState((s) => ({ ...s, configured: false, error: `Dialer init failed: ${msg}` }));
      }
    }

    void init();
    return () => {
      mounted = false;
      (deviceRef.current || pending)?.destroy();
      deviceRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const makeCall = useCallback(
    async (toNumber: string, prospectId?: string, _ignoredFrom?: string, campaignId?: string) => {
      try {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => t.stop());
        } catch (micErr: unknown) {
          const name = micErr instanceof DOMException ? micErr.name : '';
          const denied = name === 'NotAllowedError' || name === 'PermissionDeniedError';
          const msg = denied
            ? 'Microphone access denied. Allow mic in the browser address bar, then try again.'
            : `Microphone not available: ${micErr instanceof Error ? micErr.message : 'error'}`;
          setState((s) => ({ ...s, error: msg }));
          optionsRef.current.onCallError?.(msg);
          return;
        }

        if (!deviceRef.current) {
          const tokenRes = await fetch('/api/twilio/token');
          if (!tokenRes.ok) throw new Error('Token fetch failed');
          const { token } = await tokenRes.json();
          if (!token) {
            setState((s) => ({
              ...s,
              configured: false,
              error: 'Voice calling is not configured. Add Twilio env vars (see .env.example).',
            }));
            return;
          }
          const device = new Device(token, {
            logLevel: 1,
            codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
          });
          await device.register();
          deviceRef.current = device;
          setState((s) => ({ ...s, isConnected: true, configured: true, error: null }));
        }

        currentCallLogIdRef.current = null;
        setState((s) => ({
          ...s,
          currentCallLogId: null,
          fromNumber: null,
          matchedLocal: null,
          brandName: null,
        }));

        const digits = toNumber.replace(/\D/g, '');
        const destination = toNumber.startsWith('+')
          ? toNumber
          : digits.length === 10
            ? `+1${digits}`
            : `+${digits}`;

        // Server resolves CallerId (brand pool for campaigns; platform for training)
        const res = await fetch('/api/calls/outbound', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prospectId, toNumber: destination, campaignId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = (data as { error?: string }).error || 'Could not start call';
          setState((s) => ({ ...s, error: msg }));
          optionsRef.current.onCallError?.(msg);
          return;
        }

        currentCallLogIdRef.current = data.callLogId;
        const serverFrom: string | null = data.fromNumber || null;
        setState((s) => ({
          ...s,
          currentCallLogId: data.callLogId,
          fromNumber: serverFrom,
          matchedLocal: typeof data.matchedLocal === 'boolean' ? data.matchedLocal : null,
          brandName: data.brandName || null,
        }));

        const params: Record<string, string> = { To: destination };
        if (serverFrom) {
          params.CallerId = serverFrom;
        } else if (process.env.NEXT_PUBLIC_TWILIO_FROM_NUMBER) {
          params.CallerId = process.env.NEXT_PUBLIC_TWILIO_FROM_NUMBER;
        }

        const call = await deviceRef.current!.connect({ params });
        bindCall(call);
        setState((s) => ({ ...s, callerNumber: destination, error: null }));
      } catch (err: unknown) {
        let msg = err instanceof Error ? err.message : 'Failed to make call';
        if (/PermissionDenied|31401|NotFound/i.test(msg)) {
          msg = 'Microphone access denied or unavailable.';
        }
        setState((s) => ({ ...s, error: msg }));
        optionsRef.current.onCallError?.(msg);
      }
    },
    [bindCall]
  );

  const endCall = useCallback(() => {
    callRef.current?.disconnect();
  }, []);

  const toggleMute = useCallback(() => {
    if (!callRef.current) return;
    const next = !state.isMuted;
    callRef.current.mute(next);
    setState((s) => ({ ...s, isMuted: next }));
  }, [state.isMuted]);

  return { ...state, makeCall, endCall, toggleMute };
}
