import React, { useState } from 'react';
import { db, type Product, type SaleItem } from '@/src/lib/db';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CartItem extends Product {
  cartQuantity: number;
}

export default function POS() {
  const { currentCompany, currentUser } = useAuthStore();
  const products = useLiveQuery(() => 
    currentCompany ? db.products.where('companyId').equals(currentCompany.id!).toArray() : []
  , [currentCompany]);

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK' | 'MOBILE'>('CASH');

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.barcode?.includes(search)
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

  const updateQuantity = (id: number, delta: number) => {
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

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.sellingPrice * item.cartQuantity), 0);
  const tax = subtotal * 0.1; // 10% tax mock
  const total = subtotal + tax;

  const handleCheckout = async () => {
    if (!currentCompany || !currentUser) return;

    try {
      await db.transaction('rw', [db.sales, db.saleItems, db.products, db.transactions], async () => {
        // 1. Create Sale
        const saleId = await db.sales.add({
          companyId: currentCompany.id!,
          userId: currentUser.id!,
          date: new Date(),
          total,
          tax,
          discount: 0,
          paymentMethod,
          createdAt: new Date(),
        }) as number;

        // 2. Create Sale Items and update Product stock
        for (const item of cart) {
          await db.saleItems.add({
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
          companyId: currentCompany.id!,
          type: 'INCOME',
          category: 'Sales Revenue',
          amount: total,
          description: `Sale #${saleId}`,
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
    <div className="grid h-[calc(100vh-120px)] gap-4 md:grid-cols-3 lg:grid-cols-4">
      {/* Product Selection Area */}
      <div className="md:col-span-2 lg:col-span-3 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search products or scan barcode..." 
              className="pl-10 h-10 shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-2 gap-4 pb-4 sm:grid-cols-3 lg:grid-cols-4">
            {filteredProducts?.map((product) => (
              <Card 
                key={product.id} 
                className="group cursor-pointer overflow-hidden transition-all hover:ring-2 hover:ring-primary h-fit"
                onClick={() => addToCart(product)}
              >
                <div className="aspect-square bg-muted/50 flex items-center justify-center relative">
                  <Package className="h-10 w-10 text-muted-foreground/30" />
                  <div className="absolute top-2 right-2">
                    <Badge variant={product.quantity <= 0 ? "destructive" : "secondary"}>
                      {product.quantity <= 0 ? "Out of Stock" : `${product.quantity} ${product.unit}`}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-3">
                  <h3 className="font-bold text-sm truncate" title={product.name}>{product.name}</h3>
                  <p className="text-xs text-muted-foreground mb-2">{product.barcode || 'No SKU'}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold">${product.sellingPrice.toFixed(2)}</span>
                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full border">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Cart Area */}
      <Card className="flex flex-col h-full bg-card/50 shadow-lg border-primary/10">
        <CardHeader className="py-4 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Current Cart
            </CardTitle>
            <Badge variant="outline">{cart.length} items</Badge>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-full px-4">
            <div className="py-4 space-y-4">
              {cart.length > 0 ? (
                cart.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="h-12 w-12 rounded bg-muted flex items-center justify-center shrink-0">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">${item.sellingPrice.toFixed(2)} each</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-6 w-6 rounded-full border"
                          onClick={(e) => { e.stopPropagation(); updateQuantity(item.id!, -1); }}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-bold min-w-5 text-center">{item.cartQuantity}</span>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-6 w-6 rounded-full border"
                          onClick={(e) => { e.stopPropagation(); updateQuantity(item.id!, 1); }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-bold">${(item.sellingPrice * item.cartQuantity).toFixed(2)}</span>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); removeFromCart(item.id!); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-center">
                  <ShoppingCart className="h-12 w-12 mb-4 opacity-10" />
                  <p>Your cart is empty.</p>
                  <p className="text-xs">Click on products to add them.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>

        <CardFooter className="flex-col gap-3 p-4 border-t bg-muted/20">
          <div className="w-full space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax (10%)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">${total.toFixed(2)}</span>
            </div>
          </div>
          <Button 
            className="w-full h-12 text-lg font-bold" 
            disabled={cart.length === 0}
            onClick={() => setIsCheckoutOpen(true)}
          >
            Checkout
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
              <span className="text-sm text-muted-foreground mb-1 uppercase tracking-widest">Amount Due</span>
              <span className="text-4xl font-black text-primary">${total.toFixed(2)}</span>
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
