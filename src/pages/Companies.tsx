import React, { useState } from 'react';
import { db, type Company } from '@/src/lib/db';
import { useAuthStore } from '@/src/store/useAuthStore';
import { normalizePhone, firestore, createSecondaryAuthUser } from '@/src/lib/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table';
import { Button } from '@/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Plus, Search, Building2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/src/lib/i18n';
import { Separator } from '@/src/components/ui/separator';
import { ScrollArea } from '@/src/components/ui/scroll-area';

 export default function Companies() {
  const { t } = useTranslation();
  const { currentUser } = useAuthStore();
  const companies = useLiveQuery(() => db.companies.toArray());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [search, setSearch] = useState('');

  if (currentUser?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <Building2 className="h-12 w-12 text-muted-foreground/20" />
        <p className="text-muted-foreground font-medium">Access Denied. This module is restricted to Super Admins.</p>
      </div>
    );
  }

  const filteredCompanies = companies?.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateCompany = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formElement = e.currentTarget;
    const formData = new FormData(formElement);
    const selectedModules = (formData.getAll('modules') as string[]) || [];
    
    try {
      const adminPhone = formData.get('adminPhone') as string;
      const normalizedAdminPhone = normalizePhone(adminPhone);
      const adminPassword = (formData.get('adminPassword') as string) || 'password123';

      // 1. Create Firebase Auth account for the Admin
      let firebaseUid = '';
      let authErrorMsg = '';

      if (navigator.onLine) {
        // Pre-emptive lookup: if their document already exists in Firestore under this phone number, reuse their UID.
        try {
          const { collection: fsCol, query: fsQ, where: fsW, getDocs: fsDocs } = await import('firebase/firestore');
          const q = fsQ(fsCol(firestore, 'users'), fsW('phone', '==', normalizedAdminPhone));
          const snap = await fsDocs(q);
          if (!snap.empty) {
            firebaseUid = snap.docs[0].id;
            console.log('Pre-emptive check: Company Admin exists in Firestore. Reusing UID:', firebaseUid);
          }
        } catch (dbErr) {
          console.warn('Pre-emptive Firestore lookup failed for admin:', dbErr);
        }

        if (!firebaseUid) {
          try {
            firebaseUid = await createSecondaryAuthUser(normalizedAdminPhone, adminPassword);
          } catch (authError: any) {
            console.warn('Firebase account creation failed', authError);
            authErrorMsg = authError?.message || '';
          }
        }
      } else {
        authErrorMsg = 'Offline Mode';
      }

      const companyId = crypto.randomUUID();

      const adminObj = {
        id: firebaseUid || crypto.randomUUID(), // Use Firebase UID if available
        companyId: companyId,
        fullName: `${formData.get('name')} Admin`,
        phone: normalizedAdminPhone,
        email: `${normalizedAdminPhone}@hullee.app`,
        passwordHash: adminPassword,
        role: 'COMPANY_ADMIN' as const,
        permissions: selectedModules,
        createdAt: new Date(),
      };

      const companyObj = {
        id: companyId,
        name: formData.get('name') as string,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string,
        address: formData.get('address') as string,
        taxId: formData.get('taxId') as string,
        allowedModules: selectedModules,
        createdAt: new Date(),
      };

      await db.companies.add(companyObj);

      // 2. Create a default admin for this company
      await db.users.add(adminObj);

      // 3. Sync to Firestore
      let syncedOnline = false;
      if (navigator.onLine) {
        try {
          await setDoc(doc(firestore, 'companies', companyId.toString()), {
            ...companyObj,
            id: companyId,
            createdAt: serverTimestamp(),
          });

          const targetUid = firebaseUid || adminObj.id;
          await setDoc(doc(firestore, 'users', targetUid), {
            ...adminObj,
            id: targetUid,
            firebaseUid: targetUid,
            createdAt: serverTimestamp(),
          });
          syncedOnline = true;
        } catch (syncError) {
          console.error('Firestore sync failed', syncError);
        }
      }

      toast.success(
        `Registration completed successfully!\nAdmin Phone ${normalizedAdminPhone} can now log in using the password: ${adminPassword}`,
        { duration: 10000 }
      );
      formElement.reset();
      setIsCreateOpen(false);
    } catch (err) {
      console.error('Failed to create company:', err);
      toast.error('Registration failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleUpdateCompany = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCompany) return;
    const formData = new FormData(e.currentTarget);
    const selectedModules = (formData.getAll('modules') as string[]) || [];
    
    try {
      await db.companies.update(editingCompany.id!, {
        name: formData.get('name') as string,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string,
        address: formData.get('address') as string,
        taxId: formData.get('taxId') as string,
        allowedModules: selectedModules,
      });

      toast.success('Company updated successfully');
      setIsEditOpen(false);
      setEditingCompany(null);
    } catch (err) {
      toast.error('Failed to update company');
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this company? All associated data will be lost.')) {
      try {
        await db.companies.delete(id);
        await deleteDoc(doc(firestore, 'companies', id));
        toast.success('Company deleted successfully from local database and Cloud Firestore');
      } catch (error) {
        console.error('Failed to sync delete company:', error);
        toast.success('Company deleted locally');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('companies')}</h1>
          <p className="text-muted-foreground">{t('system_overview')}</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />
            {t('add_company')}
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] max-h-[95vh] overflow-y-auto">
            <form onSubmit={handleCreateCompany} className="space-y-6">
              <DialogHeader>
                <DialogTitle>{t('add_company')}</DialogTitle>
                <DialogDescription>
                  Create a new company workspace. A default admin account will be generated.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">{t('name')}</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">{t('email')}</Label>
                  <Input id="email" name="email" type="email" placeholder="company@example.com" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">{t('phone')}</Label>
                  <Input id="phone" name="phone" placeholder="+251 ..." />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" name="address" placeholder="Addis Ababa, ..." />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="taxId">Tax ID / VAT</Label>
                  <Input id="taxId" name="taxId" placeholder="12345..." />
                </div>
                <Separator className="my-2" />
                <Label className="text-primary font-black uppercase text-xs tracking-widest">Modules Access</Label>
                <div className="grid grid-cols-2 gap-2">
                  {['pos', 'inventory', 'hr', 'loans', 'expenses'].map(mod => (
                    <div key={mod} className="flex items-center gap-2">
                      <input type="checkbox" name="modules" value={mod} id={`mod-${mod}`} defaultChecked className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                      <label htmlFor={`mod-${mod}`} className="text-sm capitalize">{mod}</label>
                    </div>
                  ))}
                </div>
                <Separator className="my-2" />
                <div className="grid gap-2">
                  <Label htmlFor="adminPhone" className="text-primary font-bold text-sm">Owner Login Phone</Label>
                  <Input id="adminPhone" name="adminPhone" placeholder="+251..." required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="adminPassword">Owner Initial Password</Label>
                  <Input id="adminPassword" name="adminPassword" type="password" defaultValue="password123" required />
                </div>
              </div>
              <DialogFooter className="pt-4 border-t sticky bottom-0 bg-background pb-2">
                <Button type="submit" className="w-full h-11 font-bold">{t('add_company')}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={t('search')} 
                className="pl-10" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('companies')}</TableHead>
                <TableHead>{t('email')}</TableHead>
                <TableHead>{t('phone')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies && filteredCompanies.length > 0 ? (
                filteredCompanies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-primary">
                          <Building2 className="h-4 w-4" />
                        </div>
                        {company.name}
                      </div>
                    </TableCell>
                    <TableCell>{company.email}</TableCell>
                    <TableCell>{company.phone || '-'}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                        {t('status')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          setEditingCompany(company);
                          setIsEditOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(company.id!)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    {t('no_recent_activity')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[95vh] overflow-y-auto">
          {editingCompany && (
            <form onSubmit={handleUpdateCompany} className="space-y-6">
              <DialogHeader>
                <DialogTitle>Edit Company</DialogTitle>
                <DialogDescription>
                  Update company details and module access.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">{t('name')}</Label>
                  <Input id="edit-name" name="name" defaultValue={editingCompany.name} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-email">{t('email')}</Label>
                  <Input id="edit-email" name="email" type="email" defaultValue={editingCompany.email} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-phone">{t('phone')}</Label>
                  <Input id="edit-phone" name="phone" defaultValue={editingCompany.phone} placeholder="+251 ..." />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-address">Address</Label>
                  <Input id="edit-address" name="address" defaultValue={editingCompany.address} placeholder="Addis Ababa, ..." />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-taxId">Tax ID / VAT</Label>
                  <Input id="edit-taxId" name="taxId" defaultValue={editingCompany.taxId} placeholder="12345..." />
                </div>
                <Separator className="my-2" />
                <Label className="text-primary font-black uppercase text-xs tracking-widest">Modules Access</Label>
                <div className="grid grid-cols-2 gap-2">
                  {['pos', 'inventory', 'hr', 'loans', 'expenses'].map(mod => (
                    <div key={mod} className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        name="modules" 
                        value={mod} 
                        id={`edit-mod-${mod}`} 
                        defaultChecked={editingCompany.allowedModules?.includes(mod)} 
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" 
                      />
                      <label htmlFor={`edit-mod-${mod}`} className="text-sm capitalize">{mod}</label>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter className="pt-4 border-t sticky bottom-0 bg-background pb-2">
                <Button type="submit" className="w-full h-11 font-bold">Update Company</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
