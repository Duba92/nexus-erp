import { useAuthStore } from '@/src/store/useAuthStore';
import { db } from '@/src/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  ShoppingCart,
  CircleDollarSign,
  ArrowUpRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/src/components/ui/badge';
import { cn } from '@/src/lib/utils';

import { useTranslation } from '@/src/lib/i18n';

export default function Dashboard() {
  const { currentUser, currentCompany } = useAuthStore();
  const { t, formatCurrency } = useTranslation();

  const salesCount = useLiveQuery(() => 
    currentCompany ? db.sales.where('companyId').equals(currentCompany.id!).count() : db.sales.count()
  );
  
  const productCount = useLiveQuery(() => 
    currentCompany ? db.products.where('companyId').equals(currentCompany.id!).count() : db.products.count()
  );

  const employeeCount = useLiveQuery(() => 
    currentCompany ? db.users.where('companyId').equals(currentCompany.id!).count() : db.users.count()
  );

  const totalRevenue = useLiveQuery(async () => {
    const transactions = currentCompany 
      ? await db.transactions.where('companyId').equals(currentCompany.id!).toArray()
      : await db.transactions.toArray();
    
    return transactions.reduce((acc, curr) => acc + (curr.type === 'INCOME' ? curr.amount : -curr.amount), 0);
  });

  const recentTransactions = useLiveQuery(() => 
    currentCompany 
      ? db.transactions.where('companyId').equals(currentCompany.id!).reverse().limit(5).toArray()
      : db.transactions.reverse().limit(5).toArray()
  );

  const chartData = useLiveQuery(async () => {
    if (!currentCompany) return [];
    
    // Get last 7 days of income
    const now = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const nextD = new Date(d);
      nextD.setDate(d.getDate() + 1);
      
      const dayTransactions = await db.transactions
        .where('companyId').equals(currentCompany.id!)
        .and(t => t.date >= d && t.date < nextD && t.type === 'INCOME')
        .toArray();
        
      data.push({
        name: days[d.getDay()],
        revenue: dayTransactions.reduce((acc, t) => acc + t.amount, 0),
      });
    }
    return data;
  }, [currentCompany]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {t('welcome_back')}, {currentUser?.fullName}
        </h1>
        <p className="text-muted-foreground">
          {currentCompany ? `${t('managing')} ${currentCompany.name}` : t('system_overview')}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('total_revenue')}</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-emerald-500 inline-flex items-center">
                +20.1% <ArrowUpRight className="ml-1 h-3 w-3" />
              </span>{' '}
              {t('from_last_month')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('sales')}</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{salesCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-emerald-500 inline-flex items-center">
                +12% <ArrowUpRight className="ml-1 h-3 w-3" />
              </span>{' '}
              {t('from_last_month')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('products')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productCount || 0}</div>
            <p className="text-xs text-muted-foreground">{t('stock_status')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('active_employees')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employeeCount || 0}</div>
            <p className="text-xs text-muted-foreground">{t('active_employees')}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>{t('sales_over_time')}</CardTitle>
            <CardDescription>{t('daily_sales_performance')}</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value} ETB`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>{t('recent_transactions')}</CardTitle>
            <CardDescription>{t('recent_transactions')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTransactions && recentTransactions.length > 0 ? (
                recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-4">
                    <div className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full",
                      tx.type === 'INCOME' ? "bg-emerald-500/10" : "bg-destructive/10"
                    )}>
                      {tx.type === 'INCOME' ? (
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col overflow-hidden">
                      <p className="truncate text-sm font-medium">{tx.category}</p>
                      <p className="text-xs text-muted-foreground">{format(tx.date, 'MMM dd, yyyy')}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "text-sm font-bold",
                        tx.type === 'INCOME' ? "text-emerald-500" : "text-destructive"
                      )}>
                        {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </p>
                      <Badge variant="outline" className="text-[10px] leading-none uppercase">
                        {tx.referenceType || 'OTHER'}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex h-40 flex-col items-center justify-center text-center text-muted-foreground">
                  <p>{t('no_recent_activity')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


