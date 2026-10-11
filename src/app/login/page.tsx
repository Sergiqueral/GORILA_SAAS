"use client";
import Navigation from '@/components/Navigation'
import Link from 'next/link'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '@/firebase/config'
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Flame } from 'lucide-react'
import { ensureUserWorkspace } from '@/lib/workspace-bootstrap'

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" {...props}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const invitedTenantId = searchParams?.get('tenantId') || undefined;
  const initialEmail = searchParams?.get('email') || "";

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Limpiar cualquier tenant residual de sesiones de prueba previas si es login directo
      if (!invitedTenantId && typeof window !== 'undefined') {
        localStorage.removeItem('gorila_active_tenant');
      }

      // Garantizar Workspace Soberano como Propietario (o unirse si fue invitado)
      await ensureUserWorkspace(user, { invitedTenantId });

      router.push("/dashboard");
    } catch (error: any) {
      if (error?.code === 'auth/popup-closed-by-user') {
        return
      }
      console.error('Error con Google Sign-In:', error)
      let message = 'Error al iniciar sesión con Google.'
      if (error?.code === 'auth/operation-not-allowed' || error?.code === 'auth/configuration-not-found') {
        message = 'El proveedor de Google no está habilitado en Firebase. Ve a Firebase Console > Authentication > Sign-in method y activa "Google".'
      } else if (error instanceof Error) {
        message = error.message
      }
      alert(message)
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      if (cred.user) {
        // Limpiar cualquier tenant residual de sesiones de prueba previas si es login directo
        if (!invitedTenantId && typeof window !== 'undefined') {
          localStorage.removeItem('gorila_active_tenant');
        }

        // Garantizar Workspace Soberano como Propietario (o unirse si fue invitado)
        await ensureUserWorkspace(cred.user, { invitedTenantId })
      }
      router.push("/dashboard")
    } catch (error: any) {
      console.error('Error signing in', error)
      let message = 'An error occurred during sign in'
      if (error?.code === 'auth/invalid-credential' || error?.code === 'auth/user-not-found' || error?.code === 'auth/wrong-password') {
        message = 'Invalid email or password.'
      } else if (error?.code === 'auth/configuration-not-found') {
        message = 'El método de Correo/Contraseña no está habilitado en Firebase. Ve a la Consola de Firebase > Authentication > Sign-in method y activa "Correo electrónico/contraseña".'
      } else if (error instanceof Error) {
        message = error.message
      }
      alert(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#333333] flex flex-col">
      <Navigation showBackButton={true} />
      {/* Main content */}
      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md bg-[#FFE5E5] border-none">
          <form onSubmit={handleLogin}>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center">Log in to your account</CardTitle>
              <CardDescription className="text-center">
                Enter your email and password to access your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input onChange={(e) => setEmail(e.target.value)} id="email" type="email" placeholder="john@example.com" className="bg-white border-[#FFB3B0] focus:border-[#FF6F61] focus:ring-[#FF6F61]" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-sm text-[#FF6F61] hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Input onChange={(e) => setPassword(e.target.value)} id="password" type="password" className="bg-white border-[#FFB3B0] focus:border-[#FF6F61] focus:ring-[#FF6F61]" />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="remember" />
                <label
                  htmlFor="remember"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Remember me
                </label>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" disabled={isLoading || isGoogleLoading} className="w-full bg-[#FF6F61] text-white hover:bg-[#FFB3B0]">
                {isLoading ? 'Logging in...' : 'Log In'}
              </Button>

              <div className="relative w-full flex items-center justify-center my-2">
                <div className="border-t border-[#FFB3B0] w-full" />
                <span className="bg-[#FFE5E5] px-2 text-xs text-gray-500 uppercase tracking-wider absolute">O continúa con</span>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleLogin}
                disabled={isLoading || isGoogleLoading}
                className="w-full bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 flex items-center justify-center gap-2 shadow-sm font-medium"
              >
                <GoogleIcon className="w-5 h-5" />
                {isGoogleLoading ? 'Conectando con Google...' : 'Continuar con Google'}
              </Button>

              <p className="text-sm text-center">
                Don't have an account?{" "}
                <Link href="/signup" className="text-[#FF6F61] hover:underline">
                  Sign up
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#FFE5E5] w-full">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between py-8 space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <Flame className="h-6 w-6 text-[#FF6F61]" />
            <span className="text-sm font-medium">© 2024 SaaSBoiler. All rights reserved.</span>
          </div>
          <nav className="flex items-center space-x-4">
            <Link href="#" className="text-sm font-medium hover:text-[#FF6F61] transition-colors">
              Terms
            </Link>
            <Link href="#" className="text-sm font-medium hover:text-[#FF6F61] transition-colors">
              Privacy
            </Link>
            <Link href="#" className="text-sm font-medium hover:text-[#FF6F61] transition-colors">
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FFFFFF] text-[#333333] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF6F61]" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}