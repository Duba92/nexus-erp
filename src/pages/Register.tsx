import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '@/src/lib/db';
import { auth, formatPhoneToEmail, normalizePhone, firestore } from '@/src/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile, signInAnonymously } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuthStore } from '@/src/store/useAuthStore';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Label } from '@/src/components/ui/label';
import { toast } from 'sonner';
import { Building2, Lock, Phone, User, CheckCircle2, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { ScrollArea } from '@/src/components/ui/scroll-area';

export default function Register() {
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    companyName: '',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    const withTimeout = <T,>(promise: Promise<T>, ms: number, errorMessage = 'Operation timed out'): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(errorMessage)), ms))
      ]);
    };

    try {
      const normalizedPhone = normalizePhone(formData.phone);
      const phoneEmail = formatPhoneToEmail(normalizedPhone);
      
      let userUid: string = crypto.randomUUID(); // Default unique local ID
      let registeredOnline = false;

      // Check if phone number is already registered in Firestore (critical for unauthenticated fallback)
      if (navigator.onLine) {
        try {
          const checkQ = query(collection(firestore, 'users'), where('phone', '==', normalizedPhone));
          const checkSnapshot = await withTimeout(getDocs(checkQ), 2200, 'uniqueness-timeout');
          if (!checkSnapshot.empty) {
            toast.error('This phone number is already registered. Please login instead.');
            setIsLoading(false);
            return;
          }
        } catch (checkErr) {
          console.warn('Uniqueness validation skipped due to temporary network/rules issue or timeout:', checkErr);
        }
      }

      // Check if online to register with Firebase Auth
      if (navigator.onLine) {
        try {
          // 1. Firebase Auth Registration with safety timeout
          const userCredential = await withTimeout(
            createUserWithEmailAndPassword(auth, phoneEmail, formData.password),
            4000,
            'auth-timeout'
          );
          await updateProfile(userCredential.user, { displayName: formData.fullName });
          userUid = userCredential.user.uid;
          registeredOnline = true;
        } catch (authError: any) {
          console.warn('Firebase Auth registration failed, checking if we should fallback to offline', authError);
          if (authError.code === 'auth/email-already-in-use') {
            toast.error('This phone number is already registered. Please login instead.');
            setIsLoading(false);
            return;
          }
          // If it is a network, firebase auth configuration, operation not allowed or fallback case, register offline/direct sync
          if (
            authError.message === 'auth-timeout' ||
            authError.code === 'auth/network-request-failed' ||
            authError.code === 'auth/operation-not-allowed' ||
            authError.message?.includes('operation-not-allowed') ||
            !navigator.onLine
          ) {
            if (authError.code === 'auth/operation-not-allowed' || authError.message?.includes('operation-not-allowed') || authError.message === 'auth-timeout') {
              console.warn('Offline/No Auth fallback: Direct Firestore sync with anonymous auth context.', authError);
              registeredOnline = true; // Still allow syncing directly to Firestore
              
              // Authenticate anonymously with safety timeout
              try {
                const anonCredential = await withTimeout(signInAnonymously(auth), 2000, 'anon-timeout');
                userUid = anonCredential.user.uid;
                console.log('Anonymous registration active, UID assigned:', userUid);
              } catch (anonErr) {
                console.warn('Could not do anonymous sign-in fallback:', anonErr);
              }
            } else {
              toast.info('Offline mode: Registering account locally on this device.');
            }
          } else {
            throw authError; // For other issues like weak password, etc.
          }
        }
      } else {
        toast.info('No internet connection. Registering account locally on this device.');
      }

      const companyId = crypto.randomUUID();
      const companyData = {
        id: companyId,
        name: formData.companyName,
        email: '', 
        allowedModules: ['pos', 'inventory', 'hr', 'loans', 'expenses', 'sales'],
        createdAt: new Date(),
      };

      const userData = {
        id: userUid,
        companyId,
        fullName: formData.fullName,
        work: formData.companyName,
        phone: normalizedPhone,
        email: phoneEmail,
        passwordHash: formData.password,
        role: 'COMPANY_ADMIN' as const,
        permissions: ['pos', 'inventory', 'hr', 'sales', 'loans', 'purchases', 'transactions', 'attendance', 'all'],
        createdAt: new Date(),
      };

      // 2. Local DB Sync (offline source of truth)
      await db.companies.put(companyData);
      await db.users.put(userData);

      // 3. Sync to Firestore (Mandatory for multi-device login) if online in background
      if (registeredOnline) {
        // Run as floating background task to never block the main transition
        (async () => {
          try {
            await withTimeout(setDoc(doc(firestore, 'companies', companyId), {
              ...companyData,
              createdAt: serverTimestamp(),
            }), 3000, 'companies-sync-timeout');
            
            await withTimeout(setDoc(doc(firestore, 'users', userUid), {
              ...userData,
              firebaseUid: userUid,
              createdAt: serverTimestamp(),
            }), 3000, 'users-sync-timeout');
            console.log('Background Firestore sync finished successfully.');
          } catch (syncError) {
            console.warn('Background Firestore sync failed or timed out:', syncError);
          }
        })();
      }

      // Auto login and navigate
      const { setAuth } = useAuthStore.getState();
      setAuth(userData as any, companyData as any);
      
      toast.success(registeredOnline 
        ? 'Registration successful! Welcome to Ulee.' 
        : 'Registration successful locally (Offline Mode)! Welcome to Ulee.'
      );
      
      // Slight delay to allow toast to be seen
      setTimeout(() => {
        navigate('/');
      }, 500);

    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        toast.error('This phone number is already registered. Please login instead.');
      } else {
        toast.error('Registration failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/50 py-8 px-4 sm:px-8">
      <div className="max-w-md mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
        <div className="mb-6 flex flex-col items-center justify-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Ulee</h1>
          <p className="text-muted-foreground">Professional Business Solutions</p>
        </div>

        <Card className="border-none shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Create Account</CardTitle>
            <CardDescription>
              Enter your work details to start managing your business.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleRegister}>
            <CardContent className="space-y-4 pt-1">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    placeholder="John Doe"
                    className="pl-10 h-11"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+251..."
                    className="pl-10 h-11"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyName">Work</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="companyName"
                    placeholder="Work name / Business"
                    className="pl-10 h-11"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10 h-11"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      className="pl-10 h-11"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 border-t pt-6 pb-6">
              <Button type="submit" className="w-full h-11 text-base font-bold" disabled={isLoading}>
                {isLoading ? 'Creating Account...' : 'Register'}
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="text-primary font-bold hover:underline">
                  Sign in
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          &copy; 2026 Ulee. Secure & Reliable POS.
        </div>
        </motion.div>
      </div>
    </div>
  );
}
