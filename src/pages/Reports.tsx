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
import { FileText, Download, Printer, PieChart, BarChart3, TrendingUp } from 'lucide-react';
import { Badge } from '@/src/components/ui/badge';
import { format } from 'date-fns';
import { cn } from '@/src/lib/utils';

import { useTranslation } from '@/src/lib/i18n';

export default function Reports() {
  const { currentCompany } = useAuthStore();
  const { t, formatCurrency } = useTranslation();
  
  const sales = useLiveQuery(() => 
    currentCompany ? db.sales.where('companyId').equals(currentCompany.id!).reverse().toArray() : []
  , [currentCompany]);

  const saleItems = useLiveQuery(() => 
    currentCompany ? db.saleItems.toArray() : [] // We'll filter in JS if needed or fix schema
  , [currentCompany]);

  const products = useLiveQuery(() => 
    currentCompany ? db.products.where('companyId').equals(currentCompany.id!).toArray() : []
  , [currentCompany]);

  const transactions = useLiveQuery(() => 
    currentCompany ? db.transactions.where('companyId').equals(currentCompany.id!).reverse().toArray() : []
  , [currentCompany]);

  const totalIncome = transactions?.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0) || 0;
  const totalExpenses = transactions?.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0) || 0;
  
  // Real Profit = Total Sales Price - Total Cost of items sold
  // We need to match sale items with products to get cost
  const realProfit = useLiveQuery(async () => {
    if (!currentCompany) return 0;
    const comps = await db.sales.where('companyId').equals(currentCompany.id!).toArray();
    const saleIds = comps.map(s => s.id!);
    const items = await db.saleItems.where('saleId').anyOf(saleIds).toArray();
    const prods = await db.products.where('companyId').equals(currentCompany.id!).toArray();
    const prodMap = new Map(prods.map(p => [p.id, p]));
    
    return items.reduce((acc, item) => {
      const prod = prodMap.get(item.productId);
      if (prod) {
        return acc + (item.totalPrice - (prod.costPrice * item.quantity));
      }
      return acc;
    }, 0);
  }, [currentCompany]);

  const netProfit = totalIncome - totalExpenses;

  const handleExport = (type: string) => {
    alert(`Exporting ${type} report... (Feature available in Pro version)`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('reports_and_analytics')}</h1>
          <p className="text-muted-foreground">{t('system_overview')}</p>
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

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              {t('total_revenue')}
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalIncome)}</div>
            <p className="text-xs text-muted-foreground">{t('income')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Real Profit
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(realProfit || 0)}</div>
            <p className="text-xs text-muted-foreground">Revenue - Item Cost</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              {t('total_expenses')}
              <TrendingUp className="h-4 w-4 text-destructive rotate-180" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">{t('expense')}</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Net Balance
              <PieChart className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              netProfit >= 0 ? "text-emerald-500" : "text-destructive"
            )}>
              {formatCurrency(netProfit)}
            </div>
            <p className="text-xs text-muted-foreground">Income - Expenses</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t('latest_sales')}
            </CardTitle>
            <CardDescription>{t('latest_sales')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inv #</TableHead>
                  <TableHead>{t('date')}</TableHead>
                  <TableHead>{t('method')}</TableHead>
                  <TableHead className="text-right">{t('total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales && sales.length > 0 ? (
                  <>
                    {sales.slice(0, 10).map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium text-xs">#{s.id}</TableCell>
                        <TableCell className="text-xs">{format(s.date, 'MMM dd, HH:mm')}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{s.paymentMethod}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-600">
                          {formatCurrency(s.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={3}>TOTAL REVENUE</TableCell>
                      <TableCell className="text-right text-emerald-600">
                        {formatCurrency(sales.reduce((acc, s) => acc + s.total, 0))}
                      </TableCell>
                    </TableRow>
                  </>
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">{t('no_recent_activity')}</TableCell>
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
              {t('recent_transactions')}
            </CardTitle>
            <CardDescription>{t('expense')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('category')}</TableHead>
                  <TableHead>{t('date')}</TableHead>
                  <TableHead className="text-right">{t('amount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions?.filter(t => t.type === 'EXPENSE').slice(0, 10).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.category}</TableCell>
                    <TableCell className="text-xs">{format(t.date, 'MMM dd')}</TableCell>
                    <TableCell className="text-right text-destructive font-bold">
                      -{formatCurrency(t.amount)}
                    </TableCell>
                  </TableRow>
                ))}
                {transactions?.filter(t => t.type === 'EXPENSE').length ? (
                   <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={2}>TOTAL EXPENSES</TableCell>
                    <TableCell className="text-right text-destructive">
                      -{formatCurrency(transactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0))}
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">{t('no_recent_activity')}</TableCell>
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
