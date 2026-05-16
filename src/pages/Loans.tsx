import React, { useState } from 'react';
import { db, type Loan } from '@/src/lib/db';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useLiveQuery } from 'dexie-react-hooks';
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
import { 
  Plus, 
  Search, 
  HandCoins, 
  CheckCircle2, 
  Clock,
  User as UserIcon,
  Phone,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/src/components/ui/badge';
import { cn } from '@/src/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { ScrollArea } from '@/src/components/ui/scroll-area';
import { useTranslation } from '@/src/lib/i18n';

export default function Loans() {
  const { currentCompany } = useAuthStore();
  const { t, formatCurrency } = useTranslation();
  const loans = useLiveQuery(() => 
    currentCompany ? db.loans.where('companyId').equals(currentCompany.id!).reverse().toArray() : []
  , [currentCompany]);

  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    borrowerName: '',
    phone: '',
    amount: '',
    type: 'GIVEN' as 'GIVEN' | 'TAKEN',
    status: 'PENDING' as 'PENDING' | 'PARTIAL' | 'PAID',
    description: '',
    dueDate: ''
  });

  const filteredLoans = loans?.filter(l => 
    l.borrowerName.toLowerCase().includes(search.toLowerCase()) || 
    l.phone?.includes(search)
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany) return;

    try {
      const amount = parseFloat(formData.amount);
      await db.loans.add({
        companyId: currentCompany.id!,
        borrowerName: formData.borrowerName,
        phone: formData.phone,
        amount,
        remainingAmount: formData.status === 'PAID' ? 0 : amount,
        type: formData.type,
        status: formData.status,
        description: formData.description,
        dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
        createdAt: new Date(),
      });
      toast.success('Loan recorded successfully');
      setIsCreateOpen(false);
      setFormData({
        borrowerName: '',
        phone: '',
        amount: '',
        type: 'GIVEN',
        status: 'PENDING',
        description: '',
        dueDate: ''
      });
    } catch (err) {
      toast.error('Failed to record loan');
    }
  };

  const updateStatus = async (id: number, status: 'PENDING' | 'PARTIAL' | 'PAID') => {
    try {
      const loan = await db.loans.get(id);
      if (!loan) return;
      
      await db.loans.update(id, { 
        status, 
        remainingAmount: status === 'PAID' ? 0 : loan.remainingAmount 
      });
      toast.success('Loan status updated');
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const deleteLoan = async (id: number) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      await db.loans.delete(id);
      toast.success('Loan record deleted');
    } catch (err) {
      toast.error('Failed to delete record');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Loans</h1>
          <p className="text-muted-foreground">Manage credits given to customers and debts taken from others.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Record New Loan
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-emerald-50/50 border-emerald-100">
          <CardHeader className="pb-2">
            <CardDescription className="text-emerald-600 font-medium">Total Given</CardDescription>
            <CardTitle className="text-2xl text-emerald-700">
              {formatCurrency(loans?.filter(l => l.type === 'GIVEN').reduce((acc, l) => acc + l.amount, 0) || 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-rose-50/50 border-rose-100">
          <CardHeader className="pb-2">
            <CardDescription className="text-rose-600 font-medium">Total Taken</CardDescription>
            <CardTitle className="text-2xl text-rose-700">
              {formatCurrency(loans?.filter(l => l.type === 'TAKEN').reduce((acc, l) => acc + l.amount, 0) || 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-orange-50/50 border-orange-100">
          <CardHeader className="pb-2">
            <CardDescription className="text-orange-600 font-medium">Pending Recovery</CardDescription>
            <CardTitle className="text-2xl text-orange-700">
              {formatCurrency(loans?.filter(l => l.type === 'GIVEN' && l.status !== 'PAID').reduce((acc, l) => acc + l.remainingAmount, 0) || 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-blue-50/50 border-blue-100">
          <CardHeader className="pb-2">
            <CardDescription className="text-blue-600 font-medium">Total Records</CardDescription>
            <CardTitle className="text-2xl text-blue-700">{loans?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>Loan History</CardTitle>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search borrower or phone..." 
                className="pl-10" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {filteredLoans?.map((loan) => (
                <div key={loan.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-xl gap-4 hover:bg-muted/30 transition-colors">
                  <div className="flex gap-4">
                    <div className={cn(
                      "h-12 w-12 rounded-full flex items-center justify-center shrink-0",
                      loan.type === 'GIVEN' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                    )}>
                      <HandCoins className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold flex items-center gap-2">
                        {loan.borrowerName}
                        <Badge variant={loan.type === 'GIVEN' ? 'secondary' : 'destructive'} className="text-[10px]">
                          {loan.type === 'GIVEN' ? 'CUSTOMER OWE ME' : 'I OWE THEM'}
                        </Badge>
                      </h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {loan.phone || 'N/A'}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Due: {loan.dueDate ? new Date(loan.dueDate).toLocaleDateString() : 'N/A'}</span>
                      </div>
                      {loan.description && <p className="text-xs mt-2 italic">"{loan.description}"</p>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6">
                    <div className="text-right">
                      <p className="text-lg font-black">{formatCurrency(loan.amount)}</p>
                      <Badge className={cn(
                        "mt-1",
                        loan.status === 'PAID' ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" :
                        loan.status === 'PARTIAL' ? "bg-orange-100 text-orange-700 hover:bg-orange-100" :
                        "bg-rose-100 text-rose-700 hover:bg-rose-100"
                      )}>
                        {loan.status}
                      </Badge>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        title="Mark as Paid"
                        onClick={() => updateStatus(loan.id!, 'PAID')}
                        disabled={loan.status === 'PAID'}
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => deleteLoan(loan.id!)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredLoans?.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <HandCoins className="h-12 w-12 mb-4 opacity-10" />
                  <p>No loan records found.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Record Loan</DialogTitle>
            <DialogDescription>
              Enter the details of the credit or debt.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="borrowerName">Name (Person/Company)</Label>
                <Input 
                  id="borrowerName" 
                  value={formData.borrowerName}
                  onChange={(e) => setFormData({ ...formData, borrowerName: e.target.value })}
                  required 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input 
                  id="phone" 
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+251..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="amount">Amount</Label>
                <Input 
                  id="amount" 
                  type="number" 
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type">Loan Type</Label>
                <Select value={formData.type} onValueChange={(val: any) => setFormData({ ...formData, type: val })}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GIVEN">CUSTOMER OWE ME (Credit Given)</SelectItem>
                    <SelectItem value="TAKEN">I OWE THEM (Debt Taken)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Initial Status</Label>
                <Select value={formData.status} onValueChange={(val: any) => setFormData({ ...formData, status: val })}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="PARTIAL">Partial Payment</SelectItem>
                    <SelectItem value="PAID">Already Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input 
                  id="dueDate" 
                  type="date" 
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="description">Notes / Description</Label>
                <Input 
                  id="description" 
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button type="submit">Save Record</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
