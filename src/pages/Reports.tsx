import { db } from '@/src/lib/db';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useLiveQuery } from 'dexie-react-hooks';
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
import { FileText, Download, Printer, PieChart, BarChart3, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function Reports() {
  const { currentCompany } = useAuthStore();
  
  const sales = useLiveQuery(() => 
    currentCompany ? db.sales.where('companyId').equals(currentCompany.id!).reverse().toArray() : []
  , [currentCompany]);

  const transactions = useLiveQuery(() => 
    currentCompany ? db.transactions.where('companyId').equals(currentCompany.id!).reverse().toArray() : []
  , [currentCompany]);

  const totalSales = sales?.reduce((acc, s) => acc + s.total, 0) || 0;
  const totalIncome = transactions?.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0) || 0;
  const totalExpenses = transactions?.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0) || 0;
  const netProfit = totalIncome - totalExpenses;

  const handleExport = (type: string) => {
    alert(`Exporting ${type} report... (Feature available in Pro version)`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">Insights into your business performance.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport('PDF')}>
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
          <Button variant="outline" onClick={() => handleExport('Excel')}>
            <Download className="mr-2 h-4 w-4" />
            Excel
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Total Revenue
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalIncome.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total money coming in</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Total Expenses
              <TrendingUp className="h-4 w-4 text-destructive rotate-180" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">${totalExpenses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total operational costs</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Net Profit
              <PieChart className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              netProfit >= 0 ? "text-emerald-500" : "text-destructive"
            )}>
              ${netProfit.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Bottom line performance</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Latest Sales
            </CardTitle>
            <CardDescription>Recent invoices generated from POS.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inv #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales && sales.length > 0 ? (
                  sales.slice(0, 5).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium text-xs">#{s.id}</TableCell>
                      <TableCell className="text-xs">{format(s.date, 'MMM dd, HH:mm')}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{s.paymentMethod}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">
                        ${s.total.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">No sales recorded yet</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Recent Expenses
            </CardTitle>
            <CardDescription>Operating costs and purchase orders.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions?.filter(t => t.type === 'EXPENSE').slice(0, 5).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.category}</TableCell>
                    <TableCell className="text-xs">{format(t.date, 'MMM dd')}</TableCell>
                    <TableCell className="text-right text-destructive font-bold">
                      -${t.amount.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                {!transactions?.filter(t => t.type === 'EXPENSE').length && (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">No expenses recorded</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
