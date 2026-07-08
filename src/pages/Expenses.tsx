import React, { useState } from 'react';
import { db } from '@/src/lib/db';
import { useAuthStore } from '@/src/store/useAuthStore';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { Plus, Search, Receipt, Trash2, ArrowDownCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/src/lib/firebase';
import { useTranslation } from '@/src/lib/i18n';

export default function Expenses() {
  const { currentCompany } = useAuthStore();
  const { t, formatCurrency } = useTranslation();
  const expenses = useLiveQuery(() => 
    currentCompany ? db.transactions.where('companyId').equals(currentCompany.id!).and(tx => tx.type === 'EXPENSE').reverse().toArray() : []
  , [currentCompany]);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredExpenses = expenses?.filter(e => 
    e.category.toLowerCase().includes(search.toLowerCase()) || 
    e.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!currentCompany) return;

    const formData = new FormData(e.currentTarget);
    const amount = parseFloat(formData.get('amount') as string);
    const category = formData.get('category') as string;
    const description = formData.get('description') as string;
    const date = new Date(formData.get('date') as string);

    if (!amount || !category) {
      toast.error('Amount and Category are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const txId = crypto.randomUUID();
      const txData = {
        id: txId,
        companyId: currentCompany.id!,
        type: 'EXPENSE' as const,
        amount,
        category,
        description,
        date,
        createdAt: new Date(),
      };

      await db.transactions.add(txData);

      const isOffline = !navigator.onLine;

      if (!isOffline) {
        // Sync to Firestore
        try {
          await setDoc(doc(firestore, 'transactions', txId), {
            ...txData,
            createdAt: serverTimestamp(),
          });
        } catch (syncError) {
          console.error('Firestore sync failed', syncError);
        }
        toast.success('Expense added successfully.');
      } else {
        toast.success('saving...');
      }

      setIsAddOpen(false);
    } catch (err) {
      toast.error('Failed to add expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this expense record?')) {
      await db.transactions.delete(id);
      
      const isOffline = !navigator.onLine;
      if (!isOffline) {
        toast.success('Record deleted');
      } else {
        toast.success('saving...');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground">Manage business expenditures and costs.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleAddExpense}>
              <DialogHeader>
                <DialogTitle>Record Expense</DialogTitle>
                <DialogDescription>
                  Enter expenditure details to track your business costs.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <Select name="category" defaultValue="General">
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Rent">Rent</SelectItem>
                      <SelectItem value="Utilities">Utilities</SelectItem>
                      <SelectItem value="Salary">Salary</SelectItem>
                      <SelectItem value="Purchase">Purchase</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="General">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="amount">Amount (ETB)</Label>
                  <Input id="amount" name="amount" type="number" step="0.01" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" name="date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input id="description" name="description" placeholder="e.g., Monthly electricity bill" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Saving...
                    </span>
                  ) : 'Save Expense'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses (Current View)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(filteredExpenses?.reduce((acc, e) => acc + e.amount, 0) || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Monthly Burn Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(expenses?.filter(e => {
                const d = new Date(e.date);
                const now = new Date();
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              }).reduce((acc, e) => acc + e.amount, 0) || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by category or description..." 
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
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses && filteredExpenses.length > 0 ? (
                <>
                  {filteredExpenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <ArrowDownCircle className="h-4 w-4 text-destructive" />
                          {e.category}
                        </div>
                      </TableCell>
                      <TableCell>{e.description || '-'}</TableCell>
                      <TableCell className="text-xs">{format(new Date(e.date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell className="text-right font-bold text-destructive">
                        -{formatCurrency(e.amount)}
                      </TableCell>
                      <TableCell className="text-right">
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
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={3}>TOTAL EXPENDITURE</TableCell>
                    <TableCell className="text-right text-destructive">
                      -{formatCurrency(filteredExpenses.reduce((acc, e) => acc + e.amount, 0))}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </>
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No expense records found.
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
