import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/src/lib/db';
import { useAuthStore } from '@/src/store/useAuthStore';
import { cn } from '@/src/lib/utils';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Label } from '@/src/components/ui/label';
import { toast } from 'sonner';
import { Building2, Lock, Mail } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const user = await db.users.where('email').equals(email).first();

      if (user && user.passwordHash === password) {
        let company = null;
        if (user.companyId) {
          company = (await db.companies.get(user.companyId)) || null;
        }
        
        setIsSyncing(true);
        await new Promise(r => setTimeout(r, 1200));

        setAuth(user, company);
        toast.success(`Welcome back, ${user.fullName}`);
        navigate('/');
      } else {
        toast.error('Invalid email or password');
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
          <h1 className="text-3xl font-bold tracking-tight">Hullee POS & HRM</h1>
          <p className="text-muted-foreground">Professional Efficient POS Solutions</p>
        </div>

        <Card className="border-none shadow-xl overflow-hidden">
          <CardHeader>
            <CardTitle className="text-2xl">Login</CardTitle>
            <CardDescription>
              Enter your credentials to access your workspace.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {isSyncing ? (
                <div className="py-8 flex flex-col items-center gap-4 text-center">
                  <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <div className="space-y-1">
                    <p className="font-bold text-primary animate-pulse">Syncing Local Data...</p>
                    <p className="text-xs text-muted-foreground">Securing your business records</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="name@example.com"
                        className="pl-10"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
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
                <Button type="submit" className="w-full h-11" disabled={isLoading}>
                  {isLoading ? 'Checking credentials...' : 'Sign in'}
                </Button>
              </CardFooter>
            )}
          </form>
        </Card>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          &copy; 2026 Hullee. All data is stored locally on this device.
        </div>
      </motion.div>
    </div>
  );
}
