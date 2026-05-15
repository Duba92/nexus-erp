import React, { useState } from 'react';
import { db, type Company } from '@/src/lib/db';
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

 export default function Companies() {
  const { t } = useTranslation();
  const { currentUser } = useAuthStore();
  const companies = useLiveQuery(() => db.companies.toArray());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
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
    const formData = new FormData(e.currentTarget);
    
    try {
      const companyId = await db.companies.add({
        name: formData.get('name') as string,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string,
        address: formData.get('address') as string,
        taxId: formData.get('taxId') as string,
        createdAt: new Date(),
      });

      // Create a default admin for this company
      await db.users.add({
        companyId: companyId as number,
        fullName: `${formData.get('name')} Admin`,
        email: formData.get('adminEmail') as string,
        passwordHash: (formData.get('adminPassword') as string) || 'password123',
        role: 'COMPANY_ADMIN',
        createdAt: new Date(),
      });

      toast.success('Company and Admin account created');
      setIsCreateOpen(false);
    } catch (err) {
      toast.error('Failed to create company');
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this company? All associated data will be lost.')) {
      await db.companies.delete(id);
      // Clean up linked data in a real app
      toast.success('Company deleted');
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
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleCreateCompany}>
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
                <div className="grid gap-2">
                  <Label htmlFor="adminEmail" className="text-primary font-bold">Owner Login Email</Label>
                  <Input id="adminEmail" name="adminEmail" type="email" placeholder="admin@example.com" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="adminPassword">Owner Initial Password</Label>
                  <Input id="adminPassword" name="adminPassword" type="password" defaultValue="password123" required />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">{t('add_company')}</Button>
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
                      <Button variant="ghost" size="icon">
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
    </div>
  );
}
