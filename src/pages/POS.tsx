import React, { useState } from 'react';
import { db, type Product, type SaleItem } from '@/src/lib/db';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '@/src/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { 
  Plus, 
  Minus, 
  Search, 
  ShoppingCart, 
  Trash2, 
  CreditCard, 
  Banknote, 
  Smartphone,
  CheckCircle2,
  XCircle,
  Package
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/src/components/ui/badge';
import { ScrollArea } from '@/src/components/ui/scroll-area';
import { Separator } from '@/src/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';

interface CartItem extends Product {
  cartQuantity: number;
}

import { useTranslation } from '@/src/lib/i18n';

export default function POS() {
  const { currentCompany, currentUser } = useAuthStore();
  const { t, formatCurrency } = useTranslation();
  const products = useLiveQuery(() => 
    currentCompany ? db.products.where('companyId').equals(currentCompany.id!).toArray() : []
  , [currentCompany]);

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK' | 'MOBILE'>('CASH');

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product: Product) => {
    if (product.quantity <= 0) {
      toast.error('Product out of stock');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.cartQuantity >= product.quantity) {
          toast.error('Cannot add more than available stock');
          return prev;
        }
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, cartQuantity: item.cartQuantity + 1 } 
            : item
        );
      }
      return [...prev, { ...product, cartQuantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.cartQuantity + delta);
        if (newQty > item.quantity) {
          toast.error('Exceeds available stock');
          return item;
        }
        return { ...item, cartQuantity: newQty };
      }
      return item;
    }).filter(item => item.cartQuantity > 0));
  };

  const updatePrice = (id: string, price: number) => {
    setCart(prev => prev.map(item => 
      item.id === id ? { ...item, sellingPrice: price } : item
    ));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.sellingPrice * item.cartQuantity), 0);
  const total = subtotal; // Remove tax as per request

  const handleCheckout = async () => {
    if (!currentCompany || !currentUser) return;

    const saleId = crypto.randomUUID();

    try {
      await db.transaction('rw', [db.sales, db.saleItems, db.products, db.transactions], async () => {
        // 1. Create Sale
        await db.sales.add({
          id: saleId,
          companyId: currentCompany.id!,
          userId: currentUser.id!,
          date: new Date(),
          total,
          tax: 0,
          discount: 0,
          paymentMethod,
          createdAt: new Date(),
        });

        // 2. Create Sale Items and update Product stock
        for (const item of cart) {
          await db.saleItems.add({
            id: crypto.randomUUID(),
            saleId,
            productId: item.id!,
            quantity: item.cartQuantity,
            unitPrice: item.sellingPrice,
            totalPrice: item.sellingPrice * item.cartQuantity,
          });

          await db.products.update(item.id!, {
            quantity: item.quantity - item.cartQuantity
          });
        }

        // 3. Record Accounting Transaction
        await db.transactions.add({
          id: crypto.randomUUID(),
          companyId: currentCompany.id!,
          type: 'INCOME',
          category: 'Sales Revenue',
          amount: total,
          description: `Sale #${saleId.slice(0, 8)}`,
          date: new Date(),
          referenceId: saleId,
          referenceType: 'SALE'
        });
      });

      toast.success('Checkout successful!');
      setCart([]);
      setIsCheckoutOpen(false);
    } catch (err) {
      toast.error('Transaction failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 h-full overflow-hidden">
      {/* Product Selection Area */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-[400px] md:min-h-0">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder={t('search')} 
              className="pl-10 h-10 shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-2 gap-3 pb-40 md:pb-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredProducts?.map((product) => (
              <Card 
                key={product.id} 
                className="group cursor-pointer overflow-hidden transition-all hover:ring-2 hover:ring-primary h-fit"
                onClick={() => addToCart(product)}
              >
                <div className="aspect-square bg-muted/50 flex items-center justify-center relative">
                  <Package className="h-8 w-8 text-muted-foreground/30" />
                  <div className="absolute top-1 right-1">
                    <Badge variant={product.quantity <= 0 ? "destructive" : "secondary"} className="text-[10px] px-1 h-5">
                      {product.quantity <= 0 ? "OOS" : `${product.quantity}`}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-2">
                  <h3 className="font-bold text-xs truncate" title={product.name}>{product.name}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm font-bold text-primary">{formatCurrency(product.sellingPrice)}</span>
                    <Plus className="h-3 w-3 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Cart Area */}
      <Card className="w-full md:w-[350px] lg:w-[400px] flex flex-col h-full bg-card/50 shadow-lg border-primary/10 shrink-0 md:relative fixed inset-x-0 bottom-16 md:bottom-0 z-40 md:z-0 md:translate-y-0 transition-transform duration-300 md:rounded-xl rounded-t-2xl shadow-2xl md:shadow-lg h-[40vh] md:h-full">
        <CardHeader className="py-2 px-4 border-b flex-row items-center justify-between md:py-3" onClick={() => {
          if (window.innerWidth < 768) {
            // This is a simple way to toggle the mobile height if needed, but for now let's make it a sensible fixed height
          }
        }}>
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            <CardTitle className="text-base">Cart</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">{cart.length} items</Badge>
            <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={(e) => {
              e.stopPropagation();
              // Logic to minimize/maximize could go here
            }}>
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full px-4">
            <div className="py-2 space-y-3 pb-24 md:pb-4">
              {cart.length > 0 ? (
                cart.map((item) => (
                  <div key={item.id} className="flex gap-2 items-center">
                    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[10px] truncate leading-tight">{item.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Input 
                          type="number" 
                          className="h-5 w-14 text-[9px] px-1 bg-background" 
                          value={item.sellingPrice}
                          onChange={(e) => updatePrice(item.id!, parseFloat(e.target.value) || 0)}
                        />
                        <div className="flex items-center gap-1 scale-75 origin-left">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-5 w-5 rounded-full border"
                            onClick={(e) => { e.stopPropagation(); updateQuantity(item.id!, -1); }}
                          >
                            <Minus className="h-2 w-2" />
                          </Button>
                          <span className="text-xs font-bold w-4 text-center">{item.cartQuantity}</span>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-5 w-5 rounded-full border"
                            onClick={(e) => { e.stopPropagation(); updateQuantity(item.id!, 1); }}
                          >
                            <Plus className="h-2 w-2" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold">{formatCurrency(item.sellingPrice * item.cartQuantity)}</span>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-4 w-4 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); removeFromCart(item.id!); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-center">
                  <ShoppingCart className="h-6 w-6 mb-2 opacity-10" />
                  <p className="text-[10px]">No items in cart</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>

        <CardFooter className="flex-col gap-2 p-3 border-t bg-primary/5 sticky bottom-0 z-10 w-full mt-auto">
          <div className="w-full space-y-0.5">
            <div className="flex justify-between font-bold">
              <span className="text-muted-foreground uppercase text-[9px] self-center">Total</span>
              <span className="text-primary font-black text-base">{formatCurrency(total)}</span>
            </div>
          </div>
          <Button 
            className="w-full h-10 text-base font-black shadow-lg shadow-primary/20" 
            disabled={cart.length === 0}
            onClick={() => setIsCheckoutOpen(true)}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            CHECKOUT
          </Button>
        </CardFooter>
      </Card>

      {/* Checkout Dialog */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Complete Sale</DialogTitle>
            <DialogDescription>
              Select payment method to finish the transaction.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            <div className="flex flex-col items-center justify-center text-center p-6 bg-muted rounded-xl">
              <span className="text-sm text-muted-foreground mb-1 uppercase tracking-widest">{t('total')}</span>
              <span className="text-4xl font-black text-primary">{formatCurrency(total)}</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Button 
                variant={paymentMethod === 'CASH' ? 'default' : 'outline'}
                className="flex-col h-20 gap-2"
                onClick={() => setPaymentMethod('CASH')}
              >
                <Banknote className="h-5 w-5" />
                <span>Cash</span>
              </Button>
              <Button 
                variant={paymentMethod === 'BANK' ? 'default' : 'outline'}
                className="flex-col h-20 gap-2"
                onClick={() => setPaymentMethod('BANK')}
              >
                <CreditCard className="h-5 w-5" />
                <span>Bank</span>
              </Button>
              <Button 
                variant={paymentMethod === 'MOBILE' ? 'default' : 'outline'}
                className="flex-col h-20 gap-2"
                onClick={() => setPaymentMethod('MOBILE')}
              >
                <Smartphone className="h-5 w-5" />
                <span>Mobile</span>
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="flex-1" onClick={() => setIsCheckoutOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleCheckout}>Pay Now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
