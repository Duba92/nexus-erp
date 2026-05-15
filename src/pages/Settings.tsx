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
  Building2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Separator } from '@/src/components/ui/separator';
import { format as formatDateFns } from 'date-fns';
import { Badge } from '@/src/components/ui/badge';
import { Avatar, AvatarFallback } from '@/src/components/ui/avatar';

import { useTranslation } from '@/src/lib/i18n';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';

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
      const categories = await db.categories.toArray();
      const suppliers = await db.suppliers.toArray();
      const departments = await db.departments.toArray();
      const sales = await db.sales.toArray();
      const saleItems = await db.saleItems.toArray();
      const purchases = await db.purchases.toArray();
      const purchaseItems = await db.purchaseItems.toArray();
      const transactions = await db.transactions.toArray();
      const attendance = await db.attendance.toArray();
      
      const backupData = {
        type: 'NEXUS_EXPORT',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        data: {
          companies, users, products, categories, suppliers, 
          departments, sales, saleItems, purchases, 
          purchaseItems, transactions, attendance
        }
      };
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexus_erp_full_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      toast.success('Full database backup generated');
    } catch (err) {
      toast.error('Backup failed');
      console.error(err);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('WARNING: This will wipe ALL current local data and replace it with the backup. Continue?')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string);
        if (backup.type === 'NEXUS_EXPORT' && backup.data) {
          const { 
            companies, users, products, categories, suppliers, 
            departments, sales, saleItems, purchases, 
            purchaseItems, transactions, attendance 
          } = backup.data;
          
          await db.transaction('rw', [
            db.companies, db.users, db.products, db.categories, 
            db.suppliers, db.departments, db.sales, db.saleItems, 
            db.purchases, db.purchaseItems, db.transactions, db.attendance
          ], async () => {
            await Promise.all([
              db.companies.clear(), db.users.clear(), db.products.clear(), 
              db.categories.clear(), db.suppliers.clear(), db.departments.clear(), 
              db.sales.clear(), db.saleItems.clear(), db.purchases.clear(), 
              db.purchaseItems.clear(), db.transactions.clear(), db.attendance.clear()
            ]);
            
            if (companies) await db.companies.bulkAdd(companies);
            if (users) await db.users.bulkAdd(users);
            if (products) await db.products.bulkAdd(products);
            if (categories) await db.categories.bulkAdd(categories);
            if (suppliers) await db.suppliers.bulkAdd(suppliers);
            if (departments) await db.departments.bulkAdd(departments);
            if (sales) await db.sales.bulkAdd(sales);
            if (saleItems) await db.saleItems.bulkAdd(saleItems);
            if (purchases) await db.purchases.bulkAdd(purchases);
            if (purchaseItems) await db.purchaseItems.bulkAdd(purchaseItems);
            if (transactions) await db.transactions.bulkAdd(transactions);
            if (attendance) await db.attendance.bulkAdd(attendance);
          });
          
          toast.success('Database restored successfully. System will reload.');
          setTimeout(() => window.location.reload(), 1500);
        } else {
          toast.error('Invalid backup file format');
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to parse or apply backup');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Settings</h1>
        <p className="text-muted-foreground">Manage your personal profile and business configurations.</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="profile">Account</TabsTrigger>
          {isAdmin && <TabsTrigger value="company">Company</TabsTrigger>}
          {isAdmin && <TabsTrigger value="data">Data Management</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>User Profile</CardTitle>
              <CardDescription>Your personal information and system role.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                  {currentUser?.fullName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold">{currentUser?.fullName}</h3>
                  <p className="text-sm text-muted-foreground">{currentUser?.email}</p>
                  <Badge variant="outline" className="mt-1 uppercase text-[10px]">{currentUser?.role}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Update your password to keep your account secure.</CardDescription>
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
                <Button type="submit" className="gap-2">
                  <Shield className="h-4 w-4" />
                  Save New Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="company" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Business Profile</CardTitle>
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
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="data" className="space-y-6">
            <Card className="border-amber-200 bg-amber-50/20">
              <CardHeader>
                <CardTitle className="text-amber-800 flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Backup & Recovery
                </CardTitle>
                <CardDescription>Nexus ERP stores data locally. Frequent backups are recommended.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-4 border bg-white rounded-lg">
                    <h4 className="font-bold text-sm mb-2">Export Data</h4>
                    <p className="text-xs text-muted-foreground mb-4">Save all system data to a JSON file for safe keeping.</p>
                    <Button onClick={handleBackup} disabled={isBackingUp} variant="outline" className="w-full gap-2">
                      <Download className="h-4 w-4" />
                      Download Backup
                    </Button>
                  </div>
                  <div className="p-4 border bg-white rounded-lg">
                    <h4 className="font-bold text-sm mb-2">Import Data</h4>
                    <p className="text-xs text-muted-foreground mb-4">Restore data from a previously exported Nexus file.</p>
                    <Input 
                      type="file" 
                      id="restore-upload" 
                      className="hidden" 
                      accept=".json" 
                      onChange={handleRestore} 
                    />
                    <Button 
                      onClick={() => document.getElementById('restore-upload')?.click()}
                      variant="outline" 
                      className="w-full gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    >
                      <Upload className="h-4 w-4" />
                      Upload & Restore
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive/20 bg-destructive/5">
              <CardHeader>
                <CardTitle className="text-destructive text-sm">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 border border-destructive/10 rounded-lg bg-white">
                  <div>
                    <h4 className="font-bold text-sm">Wipe Local Storage</h4>
                    <p className="text-xs text-muted-foreground">Clear all databases and reset the application.</p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => {
                    if(confirm('This will DELETE all local data forever. Are you sure?')) {
                      db.delete().then(() => {
                        localStorage.clear();
                        window.location.reload();
                      });
                    }
                  }}>Reset System</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
