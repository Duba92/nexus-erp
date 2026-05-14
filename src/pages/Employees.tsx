import React, { useState } from 'react';
import { db, type User, type Department } from '@/src/lib/db';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Users, Pencil, Trash2, Calendar, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Employees() {
  const { currentCompany } = useAuthStore();
  const employees = useLiveQuery(() => 
    currentCompany ? db.users.where('companyId').equals(currentCompany.id!).toArray() : []
  , [currentCompany]);

  const departments = useLiveQuery(() => 
    currentCompany ? db.departments.where('companyId').equals(currentCompany.id!).toArray() : []
  , [currentCompany]);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredEmployees = employees?.filter(e => 
    e.fullName.toLowerCase().includes(search.toLowerCase()) || 
    e.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddEmployee = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentCompany) return;

    const formData = new FormData(e.currentTarget);
    
    try {
      await db.users.add({
        companyId: currentCompany.id!,
        fullName: formData.get('fullName') as string,
        email: formData.get('email') as string,
        passwordHash: 'employee123',
        role: formData.get('role') as any || 'EMPLOYEE',
        phone: formData.get('phone') as string,
        salary: parseFloat(formData.get('salary') as string),
        departmentId: parseInt(formData.get('departmentId') as string),
        createdAt: new Date(),
      });

      toast.success('Employee registered successfully');
      setIsAddOpen(false);
    } catch (err) {
      toast.error('Failed to register employee');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Deactivate this employee account?')) {
      await db.users.delete(id);
      toast.success('Employee removed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">HR Management</h1>
          <p className="text-muted-foreground">Manage your team, departments, and payroll.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />
            Register Employee
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <form onSubmit={handleAddEmployee}>
              <DialogHeader>
                <DialogTitle>Register New Employee</DialogTitle>
                <DialogDescription>
                  Enter personal and professional details for the new staff member.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" name="fullName" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Work Email</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" name="phone" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">Role</Label>
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
                        <SelectItem key={d.id} value={d.id!.toString()}>{d.name}</SelectItem>
                      ))}
                      {!departments?.length && <SelectItem value="0" disabled>No departments defined</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="salary">Base Salary ($)</Label>
                  <Input id="salary" name="salary" type="number" defaultValue="0" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Register Employee</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
                    <TableHead>Employee</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Salary</TableHead>
                    <TableHead>Join Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
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
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {e.role.toLowerCase().replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {departments?.find(d => d.id === e.departmentId)?.name || 'General'}
                        </TableCell>
                        <TableCell>${e.salary?.toLocaleString() || '0'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {e.createdAt ? new Intl.DateTimeFormat('en-US').format(e.createdAt) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon">
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
    </div>
  );
}
