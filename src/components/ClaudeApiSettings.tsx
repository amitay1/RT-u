/**
 * Claude API Key Settings Component
 * Allows users to configure their Claude API key for AI-powered geometry detection
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Key, ExternalLink, Check, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react';

interface ClaudeApiSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onKeyConfigured?: () => void;
}

export function ClaudeApiSettings({ open, onOpenChange, onKeyConfigured }: ClaudeApiSettingsProps) {
  const [apiKey, setApiKey] = useState('');
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Check if running in Electron
  const isElectron = typeof window !== 'undefined' &&
    window.electron &&
    window.electron.isElectron === true;

  // Load current key status on open
  useEffect(() => {
    if (open && isElectron && window.electron?.claude?.loadApiKey) {
      loadKeyStatus();
    }
  }, [open, isElectron]);

  const loadKeyStatus = async () => {
    try {
      const result = await window.electron!.claude!.loadApiKey();
      if (result.success) {
        setHasKey(result.hasKey);
        setMaskedKey(result.maskedKey || null);
      }
    } catch (err) {
      console.error('Failed to load key status:', err);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    if (!apiKey.startsWith('sk-ant-')) {
      setError('Invalid API key format. Claude API keys start with "sk-ant-"');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      if (isElectron && window.electron?.claude?.saveApiKey) {
        const result = await window.electron.claude.saveApiKey(apiKey);
        if (result.success) {
          setSuccess(true);
          setHasKey(true);
          setMaskedKey(`••••${apiKey.slice(-4)}`);
          setApiKey('');
          onKeyConfigured?.();

          // Close dialog after short delay
          setTimeout(() => {
            onOpenChange(false);
            setSuccess(false);
          }, 1500);
        } else {
          setError(result.error || 'Failed to save API key');
        }
      } else {
        // Browser mode - save to localStorage
        localStorage.setItem('claude_api_key', apiKey);
        setSuccess(true);
        setHasKey(true);
        setMaskedKey(`••••${apiKey.slice(-4)}`);
        setApiKey('');
        onKeyConfigured?.();

        setTimeout(() => {
          onOpenChange(false);
          setSuccess(false);
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setError(null);

    try {
      if (isElectron && window.electron?.claude?.deleteApiKey) {
        const result = await window.electron.claude.deleteApiKey();
        if (result.success) {
          setHasKey(false);
          setMaskedKey(null);
          setApiKey('');
        } else {
          setError(result.error || 'Failed to delete API key');
        }
      } else {
        localStorage.removeItem('claude_api_key');
        setHasKey(false);
        setMaskedKey(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Claude AI API Key
          </DialogTitle>
          <DialogDescription>
            Configure your Anthropic API key for AI-powered geometry detection in technical drawings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Status */}
          {hasKey && (
            <Alert className="bg-green-50 border-green-200">
              <Check className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-800">
                API key configured: <code className="text-xs">{maskedKey}</code>
              </AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {success && (
            <Alert className="bg-green-50 border-green-200">
              <Check className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-800">
                API key saved successfully!
              </AlertDescription>
            </Alert>
          )}

          {/* Input Field */}
          <div className="space-y-2">
            <Label htmlFor="apiKey">
              {hasKey ? 'Update API Key' : 'Enter API Key'}
            </Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Help Link */}
          <div className="text-sm text-gray-500">
            Don't have an API key?{' '}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              Get one from Anthropic
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          {hasKey && (
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={saving}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete Key
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !apiKey.trim()}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Key className="w-4 h-4 mr-1" />
                {hasKey ? 'Update Key' : 'Save Key'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ClaudeApiSettings;
