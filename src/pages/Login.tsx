import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/src/lib/db';
import { auth, formatPhoneToEmail, normalizePhone } from '@/src/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '@/src/lib/firebase';
import { useAuthStore } from '@/src/store/useAuthStore';
import { cn } from '@/src/lib/utils';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Label } from '@/src/components/ui/label';
import { toast } from 'sonner';
import { Building2, Lock, Phone } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const normalizedPhone = normalizePhone(phone);
      // 1. Firebase Auth Sign In
      const firebaseEmail = formatPhoneToEmail(normalizedPhone);
      let firebaseUser = null;
      try {
        const userCredential = await signInWithEmailAndPassword(auth, firebaseEmail, password);
        firebaseUser = userCredential.user;
      } catch (fError) {
        console.warn('Firebase login failed, checking local DB (offline fallback)', fError);
      }

      // 2. Fetch/Update Local DB from Firestore if online and authenticated
      let user = await db.users.where('phone').equals(normalizedPhone).first();
      
      if (firebaseUser) {
        setIsSyncing(true);
        try {
          const userDoc = await getDoc(doc(firestore, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const syncedUserData = {
              companyId: userData.companyId,
              fullName: userData.fullName,
              phone: userData.phone,
              email: userData.email,
              passwordHash: userData.passwordHash,
              role: userData.role,
              permissions: userData.permissions,
              createdAt: userData.createdAt?.toDate() || new Date(),
            };

            if (user) {
              // Update local profile with latest from Firestore
              await db.users.update(user.id!, syncedUserData);
              user = { ...user, ...syncedUserData };
            } else {
              // First time on this device
              const userId = await db.users.add(syncedUserData);
              user = { id: userId, ...syncedUserData };
            }

            // Also sync company data
            if (user.companyId) {
              const companyDoc = await getDoc(doc(firestore, 'companies', user.companyId.toString()));
              if (companyDoc.exists()) {
                const companyData = companyDoc.data();
                const company = {
                  id: user.companyId,
                  name: companyData.name,
                  email: companyData.email,
                  phone: companyData.phone,
                  address: companyData.address,
                  taxId: companyData.taxId,
                  allowedModules: companyData.allowedModules,
                  createdAt: companyData.createdAt?.toDate() || new Date(),
                };
                await db.companies.put(company);
              }
            }
          }
        } catch (syncError) {
          console.error('Firestore sync failed during login', syncError);
        }
      }

      // 3. Final validation (works offline using local hash)
      if (user && user.passwordHash === password) {
        let company = null;
        if (user.companyId) {
          company = (await db.companies.get(user.companyId)) || null;
        }
        
        if (firebaseUser) {
          // Add a small delay for visual feedback if syncing happened
          await new Promise(r => setTimeout(r, 800));
        }

        setAuth(user, company);
        toast.success(`Welcome back, ${user.fullName}`);
        navigate('/');
      } else {
        toast.error('Invalid phone number or password');
      }
    } catch (error) {
      toast.error('An error occurred during login');
      console.error(error);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="mb-8 flex flex-col items-center justify-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Hullee</h1>
          <p className="text-muted-foreground">Mobile-First Professional POS</p>
        </div>

        <Card className="border-none shadow-xl overflow-hidden">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription>
              Enter your phone number and password to continue.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {isSyncing ? (
                <div className="py-8 flex flex-col items-center gap-4 text-center">
                  <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <div className="space-y-1">
                    <p className="font-bold text-primary animate-pulse">Syncing Business Data...</p>
                    <p className="text-xs text-muted-foreground">Preparing your dashboard</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+251..."
                        className="pl-10 h-11"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10 h-11"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
            {!isSyncing && (
              <CardFooter className="flex flex-col gap-4">
                <Button type="submit" className="w-full h-11 text-base font-bold" disabled={isLoading}>
                  {isLoading ? 'Checking...' : 'Login'}
                </Button>
              </CardFooter>
            )}
          </form>
        </Card>

        <div className="mt-8 text-center text-xs text-muted-foreground space-y-2">
          <p>&copy; 2026 Hullee. All rights reserved.</p>
          <p className="opacity-0 hover:opacity-100 transition-opacity">Super Admin: +251992932031 / 341256</p>
        </div>
      </motion.div>
    </div>
  );
}
