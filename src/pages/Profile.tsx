import React, { useState } from 'react';
import { db } from '@/src/lib/db';
import { useAuthStore } from '@/src/store/useAuthStore';
import { auth, firestore } from '@/src/lib/firebase';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Shield, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/src/components/ui/badge';

export default function Profile() {
  const { currentUser, updateUser } = useAuthStore();
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (passwordData.new !== passwordData.confirm) {
      return toast.error('New passwords do not match');
    }
    if (currentUser.passwordHash !== passwordData.current) {
      return toast.error('Current password incorrect');
    }

    setIsLoading(true);
    try {
      // 1. Update Firebase Auth Password (if online)
      if (auth.currentUser) {
        try {
          await updatePassword(auth.currentUser, passwordData.new);
        } catch (authError: any) {
          if (authError.code === 'auth/requires-recent-login') {
            toast.error('Please logout and login again to change password (security requirement)');
            setIsLoading(false);
            return;
          }
          throw authError;
        }
      }

      // 2. Update Local DB
      await db.users.update(currentUser.id!, { passwordHash: passwordData.new });
      
      // 3. Update Firestore (if online)
      if (auth.currentUser) {
        try {
          await updateDoc(doc(firestore, 'users', auth.currentUser.uid), {
            passwordHash: passwordData.new
          });
        } catch (syncError) {
          console.warn('Firestore sync failed', syncError);
        }
      }

      updateUser({ ...currentUser, passwordHash: passwordData.new });
      toast.success('Password updated successfully');
      setPasswordData({ current: '', new: '', confirm: '' });
    } catch (err) {
      console.error(err);
      toast.error('Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 text-foreground">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Profile</h1>
        <p className="text-muted-foreground">Manage your personal account and security.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Profile</CardTitle>
          <CardDescription>Your personal information and system role.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">
              {currentUser?.fullName.charAt(0)}
            </div>
            <div>
              <h3 className="font-bold text-lg">{currentUser?.fullName}</h3>
              <p className="text-sm text-muted-foreground">{currentUser?.email}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="uppercase text-[10px]">{currentUser?.role}</Badge>
                {currentUser?.role === 'SUPER_ADMIN' && (
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 uppercase text-[10px]">Super Admin</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Security
          </CardTitle>
          <CardDescription>Update your password to keep your account secure.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input 
                  id="currentPassword" 
                  type="password" 
                  value={passwordData.current}
                  onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input 
                    id="newPassword" 
                    type="password" 
                    value={passwordData.new}
                    onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input 
                    id="confirmPassword" 
                    type="password" 
                    value={passwordData.confirm}
                    onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>
            <Button type="submit" className="w-full sm:w-auto gap-2">
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
