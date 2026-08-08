import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import { signUpSchema, signInSchema } from '@/lib/validationSchemas';
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  FileCheck2,
  Loader2,
  LockKeyhole,
  Monitor,
  ScanLine,
  ShieldCheck,
} from 'lucide-react';

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/');
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Validate input
    const validation = signUpSchema.safeParse({ email, password, fullName });
    if (!validation.success) {
      const newErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: validation.data.email,
        password: validation.data.password,
        options: {
          data: {
            full_name: validation.data.fullName,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('This email is already registered. Please sign in instead.');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Account created successfully! You can now sign in.');
        setIsSignUp(false);
        setPassword('');
        setFullName('');
      }
    } catch (error) {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Validate input
    const validation = signInSchema.safeParse({ email, password });
    if (!validation.success) {
      const newErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: validation.data.email,
        password: validation.data.password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Invalid email or password. Please try again.');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Signed in successfully!');
      }
    } catch (error) {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-full min-h-0 overflow-y-auto bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,hsl(var(--primary)/0.08),transparent_34%),linear-gradient(135deg,hsl(var(--canvas-top))_0%,hsl(var(--background))_52%,hsl(var(--canvas-bottom))_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'linear-gradient(to bottom, black, transparent 72%)',
        }}
      />

      <header className="absolute inset-x-0 top-0 z-20 flex h-16 items-center px-4 sm:px-6 lg:h-20 lg:px-10">
        <Button
          variant="ghost"
          className="h-10 gap-2 rounded-lg border border-transparent px-3 text-muted-foreground hover:border-border/70 hover:bg-secondary/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Button>
      </header>

      <main className="relative z-10 mx-auto grid min-h-full w-full max-w-[1440px] lg:grid-cols-[minmax(0,1.08fr)_minmax(440px,0.92fr)]">
        <section className="hidden min-h-full flex-col justify-between px-10 pb-12 pt-28 lg:flex xl:px-16 xl:pb-16 xl:pt-32">
          <div className="max-w-2xl">
            <div className="mb-10 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)]">
                <ScanLine className="h-6 w-6 text-primary" strokeWidth={1.75} />
              </div>
              <div>
                <h1 className="text-sm font-semibold tracking-[0.16em] text-foreground">
                  RT INSPECTOR
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">Controlled NDT workspace</p>
              </div>
            </div>

            <div className="max-w-xl">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-primary/90">
                Technique planning &amp; control
              </p>
              <h2 className="text-4xl font-semibold leading-[1.12] tracking-[-0.035em] text-foreground xl:text-5xl">
                Inspection documentation with clarity built in.
              </h2>
              <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground xl:text-lg">
                Prepare, review and manage radiographic technique sheets in a focused workspace designed for disciplined inspection planning.
              </p>
            </div>

            <div className="mt-10 grid max-w-2xl grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/70 bg-card/40 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)]">
                <FileCheck2 className="h-5 w-5 text-primary/80" strokeWidth={1.75} />
                <p className="mt-5 text-sm font-semibold text-foreground">RT Film</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Technique planning</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/40 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)]">
                <Monitor className="h-5 w-5 text-primary/80" strokeWidth={1.75} />
                <p className="mt-5 text-sm font-semibold text-foreground">Digital / DDA</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">X-ray workflows</p>
              </div>
            </div>
          </div>

          <div className="flex max-w-2xl items-center gap-3 border-t border-border/60 pt-6 text-sm text-muted-foreground">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary/80" strokeWidth={1.75} />
            <span>Independent RT workspace</span>
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-border" />
            <span>Controlled document access</span>
          </div>
        </section>

        <section className="flex min-h-full items-center justify-center px-4 pb-10 pt-20 sm:px-8 sm:pb-14 lg:border-l lg:border-border/60 lg:bg-card/10 lg:px-10 lg:py-24 xl:px-16">
          <div className="w-full max-w-[500px]">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
                <ScanLine className="h-5 w-5 text-primary" strokeWidth={1.75} />
              </div>
              <div>
                <h1 className="text-sm font-semibold tracking-[0.12em] text-foreground">RT INSPECTOR</h1>
                <p className="text-xs text-muted-foreground">Controlled NDT workspace</p>
              </div>
            </div>

            <Card className="w-full overflow-hidden border-border/80 bg-card/95 shadow-xl backdrop-blur-xl">
              <CardHeader className="space-y-0 border-b border-border/70 px-6 py-6 sm:px-8 sm:py-7">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-secondary/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    <LockKeyhole className="h-3.5 w-3.5 text-primary/80" />
                    Secure workspace access
                  </div>
                  <span className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground/80">
                    RT
                  </span>
                </div>
                <h2 className="text-2xl font-semibold leading-tight tracking-[-0.025em] sm:text-[1.75rem]">
                  {isSignUp ? 'Create your account' : 'Welcome back'}
                </h2>
                <CardDescription className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  {isSignUp
                    ? 'Create an account to save and manage your radiographic technique sheets'
                    : 'Sign in to access your radiographic technique sheets'}
                </CardDescription>
              </CardHeader>

              <CardContent className="px-6 py-6 sm:px-8 sm:py-7">
                <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-5">
                  {isSignUp && (
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-sm font-medium text-foreground">
                        Full Name
                      </Label>
                      <Input
                        id="fullName"
                        data-testid="input-fullname"
                        type="text"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={loading}
                        aria-invalid={Boolean(errors.fullName)}
                        aria-describedby={errors.fullName ? 'fullName-error' : undefined}
                        className={`h-11 rounded-lg bg-background/70 px-3 focus-visible:ring-2 focus-visible:ring-offset-0 ${
                          errors.fullName
                            ? 'border-destructive/80 bg-destructive/5 hover:border-destructive/80 focus-visible:border-destructive focus-visible:ring-destructive/25'
                            : 'border-input hover:border-muted-foreground/60 focus-visible:border-primary/70 focus-visible:ring-primary/25'
                        }`}
                      />
                      {errors.fullName && (
                        <p id="fullName-error" role="alert" className="flex items-start gap-2 text-sm leading-5 text-destructive">
                          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                          {errors.fullName}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-foreground">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="text"
                      placeholder="inspector@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? 'email-error' : undefined}
                      className={`h-11 rounded-lg bg-background/70 px-3 focus-visible:ring-2 focus-visible:ring-offset-0 ${
                        errors.email
                          ? 'border-destructive/80 bg-destructive/5 hover:border-destructive/80 focus-visible:border-destructive focus-visible:ring-destructive/25'
                          : 'border-input hover:border-muted-foreground/60 focus-visible:border-primary/70 focus-visible:ring-primary/25'
                      }`}
                      data-testid="input-email"
                    />
                    {errors.email && (
                      <p id="email-error" role="alert" className="flex items-start gap-2 text-sm leading-5 text-destructive">
                        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        {errors.email}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-foreground">
                      Password
                    </Label>
                    <Input
                      id="password"
                      data-testid="input-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={errors.password ? 'password-error' : undefined}
                      className={`h-11 rounded-lg bg-background/70 px-3 focus-visible:ring-2 focus-visible:ring-offset-0 ${
                        errors.password
                          ? 'border-destructive/80 bg-destructive/5 hover:border-destructive/80 focus-visible:border-destructive focus-visible:ring-destructive/25'
                          : 'border-input hover:border-muted-foreground/60 focus-visible:border-primary/70 focus-visible:ring-primary/25'
                      }`}
                    />
                    {errors.password && (
                      <p id="password-error" role="alert" className="flex items-start gap-2 text-sm leading-5 text-destructive">
                        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        {errors.password}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3 pt-1">
                    <Button
                      type="submit"
                      className="h-11 w-full justify-between rounded-lg px-4 font-semibold shadow-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                      data-testid="submit-button"
                      disabled={loading}
                    >
                      <span className="flex items-center gap-2">
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isSignUp ? 'Sign Up' : 'Sign In'}
                      </span>
                      {!loading && <ArrowRight className="h-4 w-4" />}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full rounded-lg border-border/90 bg-secondary/30 text-foreground hover:border-primary/30 hover:bg-secondary/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30"
                      onClick={() => {
                        setIsSignUp(!isSignUp);
                        setErrors({});
                      }}
                      disabled={loading}
                    >
                      {isSignUp
                        ? 'Already have an account? Sign In'
                        : "Don't have an account? Sign Up"}
                    </Button>
                  </div>
                </form>

                <div className="mt-6 flex items-start gap-2 border-t border-border/60 pt-5 text-xs leading-5 text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary/75" strokeWidth={1.75} />
                  <p>Your session is used only to access your RT inspection workspace.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}

