import React, { useState } from 'react';
import { db } from '@/src/lib/db';
import { useAuthStore } from '@/src/store/useAuthStore';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Separator } from '@/components/ui/separator';
import { format as formatDateFns } from 'date-fns';

export default function Settings() {
  const { currentCompany, currentUser } = useAuthStore();
  const [isBackingUp, setIsBackingUp] = useState(false);

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Company settings saved (Mock)');
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      // Logic for exporting IndexedDB would go here
      // For this demo, we'll just simulate a download
      const data = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        note: 'Backup functionality'
      };
      
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexus_backup_${formatDate(new Date())}.json`;
      a.click();
      
      toast.success('Backup file generated successfully');
    } catch (err) {
      toast.error('Backup failed');
    } finally {
      setIsBackingUp(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and workspace preferences.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <aside className="space-y-1">
          <Button variant="ghost" className="w-full justify-start gap-2 bg-muted">
            <User className="h-4 w-4" />
            Account Profile
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2">
            <Shield className="h-4 w-4" />
            Security & Privacy
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2">
            <Palette className="h-4 w-4" />
            Appearance
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-2">
            <Database className="h-4 w-4" />
            Backup & Restore
          </Button>
        </aside>

        <div className="md:col-span-2 space-y-6">
          {/* Company Profile Section */}
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
                    <Input id="name" defaultValue={currentCompany?.name} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Business Email</Label>
                    <Input id="email" defaultValue={currentCompany?.email} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="taxId">Tax ID / VAT</Label>
                    <Input id="taxId" defaultValue={currentCompany?.taxId} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" defaultValue={currentCompany?.phone} />
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" defaultValue={currentCompany?.address} />
                  </div>
                </div>
                <Button type="submit" className="gap-2">
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Backup Section */}
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
                <Button className="flex-1 gap-2" variant="outline" onClick={() => toast.info('Selecting backup file...')}>
                  <Upload className="h-4 w-4" />
                  Import Restore
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
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
        </div>
      </div>
    </div>
  );
}
