'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Hand, Phone, Package, Tv, Plane, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { User } from '@/lib/types';
import productosClaro from '@/app/recargas/productosClaro.json';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';
import { Suspense } from 'react';

interface Producto {
    Descripcion: string;
    Valor: number;
    IdProducto: number;
    CategoriaProducto: number;
}

const FooterButton = ({ icon: Icon, label, subLabel, isActive, onClick }: { icon: React.ElementType, label: string, subLabel?: string, isActive?: boolean, onClick?: () => void }) => (
    <Button
        variant="ghost"
        className={cn(
            "flex-1 flex flex-col items-center h-auto text-xs font-semibold text-gray-700 space-y-1",
            isActive && "bg-red-100 rounded-md"
        )}
        onClick={onClick}
    >
        <Icon className="h-6 w-6 text-red-600" />
        <div className="flex flex-col text-center">
            <span>{label}</span>
            {subLabel && <span className="text-xs">{subLabel}</span>}
        </div>
    </Button>
);


function ProductosClaroComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const phoneNumber = searchParams.get('phone') || '';
  const operator = searchParams.get('operator') || 'Claro';
  
  const [selectedCategory, setSelectedCategory] = React.useState<number>(1);
  const [user, setUser] = React.useState<User | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [timeLeft, setTimeLeft] = React.useState(60);
  const [progress, setProgress] = React.useState(100);

  React.useEffect(() => {
    if (timeLeft <= 0) {
      router.push('/');
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1);
      setProgress(prev => (prev > 0 ? prev - (100 / 60) : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, router]);


  React.useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      router.push('/login');
    }
  }, [router]);

  const handleProductSelect = (producto: Producto) => {
    const transactionId = `${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

    const params = new URLSearchParams({
        phone: phoneNumber,
        operator: operator,
        amount: String(producto.Valor),
        productDescription: producto.Descripcion,
        transactionId: transactionId,
        idProducto: String(producto.IdProducto)
    });
    router.push(`/confirmacion?${params.toString()}`);
  };

  const productosFiltrados = React.useMemo(() => {
    console.log(productosClaro);
    return productosClaro.ListaProductos.filter(
      (p: Producto) => p.CategoriaProducto === selectedCategory
    );
  }, [selectedCategory]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-200">
      <header className="bg-red-600 text-white shadow-lg w-full">
        <div className="container mx-auto px-4 py-2 flex justify-between items-center">
          <div className="flex items-center gap-4">
             <div className="bg-white p-1 rounded-md">
                 <Image src="/logoclaro.png" alt="Claro Logo" width={60} height={20} />
             </div>
             <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-red-700">
               <ArrowLeft className="h-6 w-6" />
             </Button>
          </div>
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-wider">(502) {phoneNumber}</h2>
          </div>
           <div className="relative h-14 w-14">
              <Progress value={progress} className="absolute inset-0 h-full w-full rounded-full" style={{ background: 'conic-gradient(white calc(var(--value, 0) * 1%), hsl(var(--secondary)) 0)' }} />
              <div className="absolute inset-1.5 flex items-center justify-center bg-red-600 rounded-full">
                <span className="text-xl font-bold text-white">{timeLeft}</span>
              </div>
            </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4">
        {isLoading ? (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {productosFiltrados.map((producto) => (
                  <button
                    key={producto.IdProducto}
                    className="bg-white rounded-lg shadow-md overflow-hidden transform transition-transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
                    onClick={() => handleProductSelect(producto)}
                  >
                    <div className="bg-red-600 text-white p-2 text-xs font-semibold text-center h-12 flex items-center justify-center">
                        {producto.Descripcion}
                    </div>
                    <div className="p-4 text-center">
                        <span className="text-3xl font-bold text-gray-800">
                            Qtz {producto.Valor.toFixed(2)}
                        </span>
                    </div>
                  </button>
                ))}
            </div>
        )}
      </main>

      <footer className="bg-blue-900/10 border-t-4 border-blue-600 w-full mt-4">
        <div className="container mx-auto px-4 py-2 flex justify-around items-start">
            <FooterButton icon={Hand} label="SALIR DEL MODULO" subLabel="DE RECARGAS" onClick={() => router.push('/')} />
            <FooterButton icon={Phone} label="RECARGAS DE" subLabel="MINUTOS" isActive={selectedCategory === 1} onClick={() => setSelectedCategory(1)} />
            <FooterButton icon={Package} label="PAQUETES" subLabel="INTEGRADOS" isActive={selectedCategory === 16} onClick={() => setSelectedCategory(16)} />
            <FooterButton icon={Tv} label="SUPER" subLabel="PAQUETES" isActive={selectedCategory === 17} onClick={() => setSelectedCategory(17)} />
            <FooterButton icon={Plane} label="PLANES CON MINUTOS" subLabel="A USA" isActive={selectedCategory === 15} onClick={() => setSelectedCategory(15)} />
        </div>
      </footer>

    </div>
  );
}

export default function ProductosClaroPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ProductosClaroComponent />
        </Suspense>
    )
}