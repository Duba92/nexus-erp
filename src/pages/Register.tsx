import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '@/src/lib/db';
import { auth, formatPhoneToEmail, normalizePhone } from '@/src/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/src/lib/firebase';
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

    try {
      const normalizedPhone = normalizePhone(formData.phone);
      // 1. Firebase Auth Registration
      const firebaseEmail = formatPhoneToEmail(normalizedPhone);
      const userCredential = await createUserWithEmailAndPassword(auth, firebaseEmail, formData.password);
      await updateProfile(userCredential.user, { displayName: formData.fullName });

      // 2. Local DB Sync
      await db.transaction('rw', [db.companies, db.users], async () => {
        // 1. Create Company
        const companyId = crypto.randomUUID();
        const companyData = {
          id: companyId,
          name: formData.companyName,
          email: '', 
          createdAt: new Date(),
        };
        await db.companies.add(companyData);

        const userData = {
          id: userCredential.user.uid,
          companyId,
          fullName: formData.fullName,
          phone: normalizedPhone,
          email: `${normalizedPhone}@hullee.app`,
          passwordHash: formData.password,
          role: 'COMPANY_ADMIN' as const,
          permissions: ['pos', 'inventory', 'hr', 'sales'],
          createdAt: new Date(),
        };

        // 2. Create User as COMPANY_ADMIN
        await db.users.add(userData);

        // 3. Sync to Firestore for multi-device login
        await setDoc(doc(firestore, 'companies', companyId), {
          ...companyData,
          createdAt: serverTimestamp(),
        });
        
        await setDoc(doc(firestore, 'users', userCredential.user.uid), {
          ...userData,
          firebaseUid: userCredential.user.uid,
          createdAt: serverTimestamp(),
        });
      });

      toast.success('Registration successful! Please login.');
      navigate('/login');
    } catch (error) {
      toast.error('Registration failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
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
          <h1 className="text-3xl font-bold tracking-tight text-primary">Hullee</h1>
          <p className="text-muted-foreground">Professional Business Solutions</p>
        </div>

        <Card className="border-none shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Create Account</CardTitle>
            <CardDescription>
              Register your company to start managing your business.
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
                <Label htmlFor="companyName">Company Name</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="companyName"
                    placeholder="My Business"
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
          &copy; 2026 Hullee. Secure & Reliable POS.
        </div>
        </motion.div>
      </div>
    </div>
  );
}
