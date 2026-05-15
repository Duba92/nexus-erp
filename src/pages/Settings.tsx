import React, { useState } from 'react';
import { db } from '@/src/lib/db';
import { useAuthStore } from '@/src/store/useAuthStore';
import { cn } from '@/src/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import {
  Settings as SettingsIcon,
  Shield,
  Palette,
  Database,
  User,
  Save,
  Download,
  Upload,
  User as UserIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Separator } from '@/src/components/ui/separator';
import { format as formatDateFns } from 'date-fns';

import { useTranslation } from '@/src/lib/i18n';

export default function Settings() {
  const { currentCompany, currentUser, updateUser } = useAuthStore();
  const { t } = useTranslation();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany) return;

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const updates = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      taxId: formData.get('taxId') as string,
      phone: formData.get('phone') as string,
      address: formData.get('address') as string,
    };

    try {
      await db.companies.update(currentCompany.id!, updates);
      toast.success('Company settings saved');
    } catch (err) {
      toast.error('Failed to save settings');
    }
  };

  const isAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'COMPANY_ADMIN';

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.new !== passwordData.confirm) {
      return toast.error('New passwords do not match');
    }
    if (currentUser?.passwordHash !== passwordData.current) {
      return toast.error('Current password incorrect');
    }

    try {
      await db.users.update(currentUser.id!, { passwordHash: passwordData.new });
      updateUser({ ...currentUser, passwordHash: passwordData.new });
      toast.success('Password updated successfully');
      setPasswordData({ current: '', new: '', confirm: '' });
    } catch (err) {
      toast.error('Failed to update password');
    }
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const companies = await db.companies.toArray();
      const users = await db.users.toArray();
      const products = await db.products.toArray();
      const sales = await db.sales.toArray();
      // ... add other tables as needed
      
      const backupData = {
        type: 'NEXUS_EXPORT',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        data: {
          companies,
          users,
          products,
          sales
        }
      };
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexus_erp_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      toast.success('Backup file generated successfully');
    } catch (err) {
      toast.error('Backup failed');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('WARNING: This will overwrite all CURRENT data with the backup. Continue?')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string);
        if (backup.type === 'NEXUS_EXPORT' && backup.data) {
          const { companies, users, products, sales } = backup.data;
          
          await db.transaction('rw', [db.companies, db.users, db.products, db.sales], async () => {
            await db.companies.clear();
            await db.users.clear();
            await db.products.clear();
            await db.sales.clear();
            
            if (companies) await db.companies.bulkAdd(companies);
            if (users) await db.users.bulkAdd(users);
            if (products) await db.products.bulkAdd(products);
            if (sales) await db.sales.bulkAdd(sales);
          });
          
          toast.success('Database restored successfully. Refreshing...');
          setTimeout(() => window.location.reload(), 1500);
        } else {
          toast.error('Invalid backup file format');
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to parse backup file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('settings')}</h1>
        <p className="text-muted-foreground">{t('system_overview')}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <aside className="space-y-1">
          <Button variant="ghost" className="w-full justify-start gap-2 bg-muted">
            <User className="h-4 w-4" />
            {t('profile')}
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2">
            <SettingsIcon className="h-4 w-4" />
            {t('settings')}
          </Button>
        </aside>

        <div className="md:col-span-2 space-y-6">
          {/* Company Profile Section */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Company Profile</CardTitle>
                <CardDescription>Setup your business identity for invoices and reports.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveCompany} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Business Name</Label>
                      <Input id="name" name="name" defaultValue={currentCompany?.name} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Business Email</Label>
                      <Input id="email" name="email" defaultValue={currentCompany?.email} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="taxId">Tax ID / VAT</Label>
                      <Input id="taxId" name="taxId" defaultValue={currentCompany?.taxId} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" name="phone" defaultValue={currentCompany?.phone} />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="address">Address</Label>
                      <Input id="address" name="address" defaultValue={currentCompany?.address} />
                    </div>
                  </div>
                  <Button type="submit" className="gap-2">
                    <Save className="h-4 w-4" />
                    Save Changes
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Account Security Section */}
          <Card>
            <CardHeader>
              <CardTitle>Account Security</CardTitle>
              <CardDescription>Update your login credentials.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input 
                      id="currentPassword" 
                      type="password" 
                      value={passwordData.current}
                      onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                      required
                    />
                  </div>
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
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input 
                      id="confirmPassword" 
                      type="password" 
                      value={passwordData.confirm}
                      onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" variant="outline" className="gap-2">
                  <Shield className="h-4 w-4" />
                  Update Password
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Backup Section */}
          {isAdmin && (
            <Card className="border-amber-200 bg-amber-50/30">
              <CardHeader>
                <CardTitle className="text-amber-800">Local Data Backup</CardTitle>
                <CardDescription className="text-amber-700/70">
                  Nexus ERP stores all data locally. Download backups to keep your data safe outside this device.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-2 p-4 bg-white/50 rounded-lg border border-amber-200">
                  <h4 className="font-bold text-sm">Automatic Backups</h4>
                  <p className="text-xs text-muted-foreground">The system automatically backs up data every 24 hours to your local cache.</p>
                </div>
                <div className="flex gap-4">
                  <Button className="flex-1 gap-2" variant="outline" onClick={handleBackup} disabled={isBackingUp}>
                    <Download className="h-4 w-4" />
                    Export Database
                  </Button>
                  <div className="flex-1">
                    <Input 
                      type="file" 
                      id="restore-upload" 
                      className="hidden" 
                      accept=".json" 
                      onChange={handleRestore} 
                    />
                    <Button 
                      className="w-full gap-2" 
                      variant="outline" 
                      onClick={() => document.getElementById('restore-upload')?.click()}
                    >
                      <Upload className="h-4 w-4" />
                      Import Restore
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Danger Zone */}
          {isAdmin && (
            <Card className="border-destructive/20">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-bold text-sm">Clear Local Data</p>
                    <p className="text-xs text-muted-foreground">Wipe all databases and start fresh. This cannot be undone.</p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => {
                    if(confirm('Wipe everything?')) {
                      db.delete().then(() => window.location.reload());
                    }
                  }}>Wipe Storage</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
