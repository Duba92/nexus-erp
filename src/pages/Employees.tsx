import React, { useState } from 'react';
import { db, type User, type Department } from '@/src/lib/db';
import { useAuthStore } from '@/src/store/useAuthStore';
import { normalizePhone, firestore, createSecondaryAuthUser } from '@/src/lib/firebase';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '@/src/lib/utils';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { Plus, Search, Users, Pencil, Trash2, Calendar, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/src/components/ui/badge';
import { Avatar, AvatarFallback } from '@/src/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';

import { useTranslation } from '@/src/lib/i18n';

export default function Employees() {
  const { currentUser, currentCompany } = useAuthStore();
  const { t, formatCurrency } = useTranslation();
  
  const employees = useLiveQuery(async () => {
    if (!currentUser) return [];
    if (currentUser.role === 'SUPER_ADMIN') {
      return db.users.toArray();
    }
    return currentCompany ? db.users.where('companyId').equals(currentCompany.id!).toArray() : [];
  }, [currentCompany, currentUser]);

  const departments = useLiveQuery(async () => {
    if (!currentUser) return [];
    if (currentUser.role === 'SUPER_ADMIN') {
      return db.departments.toArray();
    }
    return currentCompany ? db.departments.where('companyId').equals(currentCompany.id!).toArray() : [];
  }, [currentCompany, currentUser]);

  const allCompanies = useLiveQuery(() => db.companies.toArray());

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
  const [isDeptOpen, setIsDeptOpen] = useState(false);
  const [search, setSearch] = useState('');

  const handleAddDept = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentCompany) return;
    const formData = new FormData(e.currentTarget);
    try {
      const deptId = crypto.randomUUID();
      const deptData = {
        id: deptId,
        companyId: currentCompany.id!,
        name: formData.get('name') as string,
        description: formData.get('description') as string,
      };
      await db.departments.add(deptData);
      
      // Sync to Firestore
      try {
        await setDoc(doc(firestore, 'departments', deptId), {
          ...deptData,
          createdAt: serverTimestamp(),
        });
      } catch (syncError) {
        console.error('Firestore sync failed', syncError);
      }

      toast.success('Department created');
      setIsDeptOpen(false);
    } catch (err) {
      toast.error('Failed to create department');
    }
  };

  const filteredEmployees = employees?.filter(e => 
    e.fullName.toLowerCase().includes(search.toLowerCase()) || 
    e.email.toLowerCase().includes(search.toLowerCase())
  );

  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['pos']);

  const handleAddEmployee = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentCompany && currentUser?.role !== 'SUPER_ADMIN') {
      toast.error('Please log in with a company context or assign a company.');
      return;
    }

    const formData = new FormData(e.currentTarget);
    const targetCompanyId = currentUser?.role === 'SUPER_ADMIN'
      ? (formData.get('companyId') as string)
      : currentCompany?.id!;

    if (!targetCompanyId) {
      toast.error('Company assignment is required');
      return;
    }
    
    try {
      const role = formData.get('role') as any || 'EMPLOYEE';
      const phone = formData.get('phone') as string;
      const normalizedPhone = normalizePhone(phone);
      const password = formData.get('password') as string || 'employee123';
      
      // 1. Create Firebase Auth User (Secondary)
      let firebaseUid = '';
      let authErrorMsg = '';
      try {
        firebaseUid = await createSecondaryAuthUser(normalizedPhone, password);
      } catch (authError: any) {
        console.warn('Firebase user creation failed (account might already exist)', authError);
        authErrorMsg = authError?.message || '';
      }

      const employeeId = firebaseUid || crypto.randomUUID();
      const employeeData = {
        id: employeeId,
        companyId: targetCompanyId,
        fullName: formData.get('fullName') as string,
        email: `${normalizedPhone}@hullee.app`,
        passwordHash: password,
        role: role,
        permissions: selectedPermissions,
        phone: normalizedPhone,
        salary: parseFloat(formData.get('salary') as string),
        departmentId: formData.get('departmentId') as string,
        createdAt: new Date(),
      };
      
      // 2. Add to local Dexie
      await db.users.add(employeeData);

      // 3. Sync to Firestore
      let syncedOnline = false;
      try {
        await setDoc(doc(firestore, 'users', employeeId), {
          ...employeeData,
          firebaseUid: employeeId,
          createdAt: serverTimestamp(),
        });
        syncedOnline = true;
      } catch (syncError) {
        console.error('Firestore sync failed', syncError);
      }

      if (syncedOnline) {
        toast.success(`Employee "${employeeData.fullName}" registered successfully both locally and on Cloud Auth.`);
      } else {
        toast.warning(
          authErrorMsg 
            ? `Employee "${employeeData.fullName}" registered locally. Cloud Auth sync pending (Reason: ${authErrorMsg}).` 
            : `Employee "${employeeData.fullName}" registered locally. Cloud Auth sync pending.`
        );
      }
      setSelectedPermissions(['pos']);
      setIsAddOpen(false);
    } catch (err) {
      toast.error('Failed to register employee');
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingEmployee) return;
    if (!currentCompany && currentUser?.role !== 'SUPER_ADMIN') return;

    const formData = new FormData(e.currentTarget);
    
    try {
      const role = formData.get('role') as any || 'EMPLOYEE';
      const phone = formData.get('phone') as string;
      const normalizedPhone = normalizePhone(phone);
      
      const updatedData = {
        fullName: formData.get('fullName') as string,
        email: formData.get('email') as string,
        role: role,
        permissions: selectedPermissions,
        phone: normalizedPhone,
        salary: parseFloat(formData.get('salary') as string),
        departmentId: formData.get('departmentId') as string,
      };

      await db.users.update(editingEmployee.id!, updatedData);

      // Sync to Firestore
      try {
        await setDoc(doc(firestore, 'users', editingEmployee.id!), {
          ...editingEmployee,
          ...updatedData,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (syncError) {
        console.error('Firestore sync failed at update employee', syncError);
      }

      toast.success('Employee updated successfully');
      setIsEditOpen(false);
      setEditingEmployee(null);
      setSelectedPermissions(['pos']);
    } catch (err) {
      toast.error('Failed to update employee');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deactivate this employee account?')) {
      await db.users.delete(id);

      // Sync to Firestore
      try {
        await deleteDoc(doc(firestore, 'users', id));
      } catch (syncError) {
        console.error('Firestore sync failed at delete employee', syncError);
      }

      toast.success('Employee removed');
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('employees')}</h1>
          <p className="text-muted-foreground">{t('system_overview')}</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isDeptOpen} onOpenChange={setIsDeptOpen}>
            <DialogTrigger render={<Button variant="outline" />}>
              <Plus className="mr-2 h-4 w-4" />
              Dept
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleAddDept}>
                <DialogHeader>
                  <DialogTitle>Add Department</DialogTitle>
                  <DialogDescription>
                    Create a new organizational unit.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Dept Name</Label>
                    <Input id="name" name="name" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" name="description" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Create Dept</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger render={<Button />}>
              <Plus className="mr-2 h-4 w-4" />
              {t('register_employee')}
            </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <form onSubmit={handleAddEmployee}>
              <DialogHeader>
                <DialogTitle>{t('register_employee')}</DialogTitle>
                <DialogDescription>
                  Enter personal and professional details for the new staff member.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 sm:grid-cols-2">
                {currentUser?.role === 'SUPER_ADMIN' && (
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="companyId">Company Context</Label>
                    <Select name="companyId">
                      <SelectTrigger>
                        <SelectValue placeholder="Select target company" />
                      </SelectTrigger>
                      <SelectContent>
                        {allCompanies?.map(c => (
                          <SelectItem key={c.id} value={c.id!}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="fullName">{t('name')}</Label>
                  <Input id="fullName" name="fullName" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">{t('email')}</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">{t('phone')}</Label>
                  <Input id="phone" name="phone" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">{t('role')}</Label>
                  <Select name="role" defaultValue="EMPLOYEE">
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                      <SelectItem value="CASHIER">Cashier</SelectItem>
                      <SelectItem value="EMPLOYEE">Staff/Employee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="departmentId">Department</Label>
                  <Select name="departmentId">
                    <SelectTrigger>
                      <SelectValue placeholder="Select dept" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments?.map(d => (
                        <SelectItem key={d.id} value={d.id!}>{d.name}</SelectItem>
                      ))}
                      {!departments?.length && <SelectItem value="0" disabled>No departments defined</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="salary">Base Salary (ETB)</Label>
                  <Input id="salary" name="salary" type="number" defaultValue="0" />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label>Feature Access Permissions</Label>
                  <div className="grid grid-cols-2 gap-2 p-3 border rounded-md">
                    {['inventory', 'pos', 'hr', 'sales'].map((perm) => (
                      <div key={perm} className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          id={`perm-${perm}`}
                          checked={selectedPermissions.includes(perm)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPermissions([...selectedPermissions, perm]);
                            } else {
                              setSelectedPermissions(selectedPermissions.filter(p => p !== perm));
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <Label htmlFor={`perm-${perm}`} className="text-xs capitalize">{perm}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="password">Initial Password</Label>
                  <Input id="password" name="password" type="password" defaultValue="employee123" required />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">{t('register_employee')}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Employee List</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
        </TabsList>
        
        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by name or email..." 
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
                    <TableHead>{t('employees')}</TableHead>
                    {currentUser?.role === 'SUPER_ADMIN' && <TableHead>Company</TableHead>}
                    <TableHead>{t('role')}</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>{t('subtotal')}</TableHead>
                    <TableHead>{t('date')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees && filteredEmployees.length > 0 ? (
                    filteredEmployees.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>{e.fullName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span className="font-medium">{e.fullName}</span>
                              <span className="text-xs text-muted-foreground">{e.email}</span>
                            </div>
                          </div>
                        </TableCell>
                        {currentUser?.role === 'SUPER_ADMIN' && (
                          <TableCell className="text-xs">
                            {allCompanies?.find(c => c.id === e.companyId)?.name || 'N/A'}
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {e.role.toLowerCase().replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {departments?.find(d => d.id === e.departmentId)?.name || 'General'}
                        </TableCell>
                        <TableCell>{formatCurrency(e.salary || 0)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {e.createdAt ? new Intl.DateTimeFormat('en-US').format(e.createdAt) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => {
                              setEditingEmployee(e);
                              setSelectedPermissions(e.permissions || []);
                              setIsEditOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(e.id!)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No employees found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Attendance Log
              </CardTitle>
              <CardDescription>Daily check-in/out records for your team.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                <p>Select a date to view attendance data</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Payroll Summary
              </CardTitle>
              <CardDescription>Monthly salary distribution and expense tracking.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Base Salary</TableHead>
                    <TableHead>Allowances</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead>Net Payable</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees?.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.fullName}</TableCell>
                      <TableCell>${e.salary?.toLocaleString() || '0'}</TableCell>
                      <TableCell>$0.00</TableCell>
                      <TableCell>$0.00</TableCell>
                      <TableCell className="font-bold">${e.salary?.toLocaleString() || '0'}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="text-amber-500 border-amber-200 bg-amber-50">Pending</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filteredEmployees?.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">No data available</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[525px]">
          {editingEmployee && (
            <form onSubmit={handleUpdateEmployee}>
              <DialogHeader>
                <DialogTitle>Edit Employee</DialogTitle>
                <DialogDescription>
                  Update professional details and permissions for this staff member.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="edit-fullName">{t('name')}</Label>
                  <Input id="edit-fullName" name="fullName" defaultValue={editingEmployee.fullName} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-email">{t('email')}</Label>
                  <Input id="edit-email" name="email" type="email" defaultValue={editingEmployee.email} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-phone">{t('phone')}</Label>
                  <Input id="edit-phone" name="phone" defaultValue={editingEmployee.phone} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-role">{t('role')}</Label>
                  <Select name="role" defaultValue={editingEmployee.role}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                      <SelectItem value="CASHIER">Cashier</SelectItem>
                      <SelectItem value="EMPLOYEE">Staff/Employee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-departmentId">Department</Label>
                  <Select name="departmentId" defaultValue={editingEmployee.departmentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select dept" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments?.map(d => (
                        <SelectItem key={d.id} value={d.id!}>{d.name}</SelectItem>
                      ))}
                      {!departments?.length && <SelectItem value="0" disabled>No departments defined</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-salary">Base Salary (ETB)</Label>
                  <Input id="edit-salary" name="salary" type="number" defaultValue={editingEmployee.salary} />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label>Feature Access Permissions</Label>
                  <div className="grid grid-cols-2 gap-2 p-3 border rounded-md">
                    {['inventory', 'pos', 'hr', 'sales'].map((perm) => (
                      <div key={perm} className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          id={`edit-perm-${perm}`}
                          checked={selectedPermissions.includes(perm)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPermissions([...selectedPermissions, perm]);
                            } else {
                              setSelectedPermissions(selectedPermissions.filter(p => p !== perm));
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <Label htmlFor={`edit-perm-${perm}`} className="text-xs capitalize">{perm}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Update Employee</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
