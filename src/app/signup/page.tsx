"use client";
import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/firebase/config';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Flame, ArrowLeft } from 'lucide-react'
import Navigation from '@/components/Navigation'

export default function SignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      alert("Passwords do not match")
      return
    }

    setIsLoading(true)
    try {
      // Registro directo con Firebase Client SDK (Fricción Cero)
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // Inicializar el perfil del usuario en Firestore
      try {
        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          role: "Free User",
          stripeId: null,
          subscriptionId: null,
          subscriptionStatus: null,
          createdAt: Date.now()
        })
      } catch (firestoreError) {
        console.warn('Could not initialize user in Firestore:', firestoreError)
      }

      router.push("/dashboard")
    } catch (error: any) {
      console.error('Error signing up', error)
      let message = 'An error occurred during registration'
      if (error?.code === 'auth/email-already-in-use') {
        message = 'This email is already registered. Please sign in instead.'
      } else if (error?.code === 'auth/weak-password') {
        message = 'Password should be at least 6 characters.'
      } else if (error?.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.'
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
          <form onSubmit={handleSignup}>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center">Create an account</CardTitle>
              <CardDescription className="text-center">
                Enter your details below to create your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input onChange={(e) => setEmail(e.target.value)} id="email" type="email" placeholder="john@example.com" className="bg-white border-[#FFB3B0] focus:border-[#FF6F61] focus:ring-[#FF6F61]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input onChange={(e) => setPassword(e.target.value)} id="password" type="password" className="bg-white border-[#FFB3B0] focus:border-[#FF6F61] focus:ring-[#FF6F61]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input onChange={(e) => setConfirmPassword(e.target.value)} id="confirm-password" type="password" className="bg-white border-[#FFB3B0] focus:border-[#FF6F61] focus:ring-[#FF6F61]" />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="terms" />
                <label
                  htmlFor="terms"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I agree to the{" "}
                  <Link href="#" className="text-[#FF6F61] hover:underline">
                    terms and conditions
                  </Link>
                </label>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" disabled={isLoading} className="w-full bg-[#FF6F61] text-white hover:bg-[#FFB3B0]">
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Button>
              <p className="text-sm text-center">
                Already have an account?{" "}
                <Link href="/login" className="text-[#FF6F61] hover:underline">
                  Sign in
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
  )
}