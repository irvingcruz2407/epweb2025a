
'use client';

import * as React from 'react';
import { Smartphone, Send, BusFront, ReceiptText, User, Home as HomeIcon, KeyRound, Lock, LayoutDashboard, Briefcase } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import ServiceCard from '@/components/services/ServiceCard';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import type { User as UserType, Service } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { TransactionForm } from '@/components/services/TransactionForm';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const servicePermissionMap = {
  phone: 'recargas',
  remittance: 'remesas',
  transport: 'transporte',
  payment: 'pagos',
} as const;


const services: Service[] = [
  {
    id: 'phone',
    title: 'Recargas Telefónicas',
    description: 'Recarga saldo para cualquier operador.',
    icon: Smartphone,
  },
  {
    id: 'remittance',
    title: 'Remesas',
    description: 'Envía y recibe dinero de forma segura.',
    icon: Send,
  },
  {
    id: 'transport',
    title: 'Tarjeta de Transporte',
    description: 'Recarga tu tarjeta para el transporte público.',
    icon: BusFront,
  },
  {
    id: 'payment',
    title: 'Pago de Servicios',
    description: 'Paga tus facturas de luz, agua, etc.',
    icon: ReceiptText,
  },
];

const DateTimeDisplay = () => {
  const [currentDateTime, setCurrentDateTime] = React.useState<Date | null>(null);

  React.useEffect(() => {
    // This code runs only on the client, after the component has mounted.
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    // Set the initial date time on mount
    setCurrentDateTime(new Date()); 
    return () => clearInterval(timer);
  }, []);
  
  if (!currentDateTime) {
    return (
       <div className="text-center text-foreground mb-8 h-[76px]">
        {/* Placeholder to avoid layout shift */}
      </div>
    )
  }

  const formattedDate = format(currentDateTime, "eeee, d 'de' MMMM 'de' yyyy", { locale: es });
  const formattedTime = format(currentDateTime, 'hh:mm:ss a');

  return (
    <div className="text-center text-foreground mb-8">
      <p className="text-xl md:text-2xl capitalize font-light">{formattedDate}</p>
      <p className="text-4xl md:text-5xl font-bold font-mono tracking-wider">{formattedTime}</p>
    </div>
  );
};

export default function HomePage() {
  const [selectedService, setSelectedService] = React.useState<Service | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const [isClient, setIsClient] = React.useState(false);
  const [user, setUser] = React.useState<UserType | null>(null);
  const [isLogoutAlertOpen, setIsLogoutAlertOpen] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.replace('/login');
    } else {
      setUser(JSON.parse(storedUser));
    }
  }, [router]);


  const handleServiceClick = (service: Service) => {
     if (!user || !user.permissions) return;
    
    const permissionKey = servicePermissionMap[service.id];
    const hasPermission = user.permissions[permissionKey];

    if (!hasPermission) {
      toast({
        variant: 'destructive',
        title: 'Acceso Denegado',
        description: 'No tienes permiso para acceder a este servicio.',
        icon: <Lock className="h-5 w-5" />,
      });
      return;
    }

    if (service.id === 'phone') {
      router.push(`/recargas?title=${encodeURIComponent(service.title)}`);
    } else if (service.id === 'transport') {
      router.push(`/recargas-transporte?title=${encodeURIComponent(service.title)}`);
    }
    else {
      setSelectedService(service);
      setIsSheetOpen(true);
    }
  };

  const handleSheetClose = () => {
    setIsSheetOpen(false);
    setTimeout(() => {
      setSelectedService(null);
    }, 300);
  };
  
  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };
  
  if (!isClient || !user) {
    return null; // Don't render anything on the server or if redirecting
  }

  const canViewDashboard = user.role === 'ADMINISTRADOR' || user.role === 'SUPERVISOR' || user.permissions.recargas;


  return (
    <div className="flex flex-col items-center min-h-screen w-full bg-background p-4 sm:p-6 md:p-8">
       <header className="flex flex-col items-center text-center w-full max-w-5xl mx-auto">
        <div className="flex items-center justify-center gap-4 mb-2">
            <Image src="/Estaciondepagologo.png" alt="Estacion de Pago Logo" width={60} height={60} priority />
            <h1 
              className="text-4xl md:text-5xl font-bold text-primary tracking-tight cursor-pointer"
              onDoubleClick={() => setIsLogoutAlertOpen(true)}
            >
              Estacion de Pago
            </h1>
        </div>
        <p className="text-lg text-primary">
          Innovando la experiencia de usuario
        </p>
      </header>
      <main className="flex-grow w-full max-w-5xl mx-auto mt-8">
        <DateTimeDisplay />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {user.permissions && services.map((service) => {
            const permissionKey = servicePermissionMap[service.id];
            const isEnabled = user.permissions[permissionKey];
            return (
              <div key={service.id} className={!isEnabled ? 'opacity-50 cursor-not-allowed' : ''}>
                <ServiceCard
                  service={service}
                  onClick={() => handleServiceClick(service)}
                  isDisabled={!isEnabled}
                />
              </div>
            );
          })}
        </div>
      </main>

      {user && canViewDashboard && (
          <div className="w-full max-w-5xl mx-auto mt-16 text-center">
            <Button
              asChild
              className="w-full h-auto bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-4 px-6 border-b-4 border-slate-300 hover:border-slate-400 rounded-lg shadow-md active:translate-y-0.5 active:border-b-2 transition-all duration-150 ease-in-out"
            >
                <Link href="/dashboard">
                    <div className="flex flex-wrap justify-center md:flex-row md:items-center md:justify-between gap-x-8 gap-y-2 text-center md:text-left w-full">
                       <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">{user.role}</p>
                          <p className="font-bold text-sm">{user.correlativeCode} - {user.username}</p>
                        </div>
                      </div>
                       <div className="flex items-center gap-3">
                        <HomeIcon className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">Dirección</p>
                          <p className="font-bold text-sm">{user.address}</p>
                        </div>
                      </div>
                       <div className="flex items-center gap-3">
                        <Briefcase className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">Grupo</p>
                          <p className="font-mono text-sm">{user.groupCode}</p>
                        </div>
                      </div>
                       <div className="flex items-center gap-3">
                        <KeyRound className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">Código Único</p>
                          <p className="font-mono text-sm">{user.id.split('-')[0]}</p>
                        </div>
                      </div>
                       <div className="flex items-center gap-2 text-primary font-bold">
                         <LayoutDashboard className="mr-2 h-5 w-5" />
                          <span>Ir al Resumen Administrativo</span>
                      </div>
                    </div>
                </Link>
            </Button>
          </div>
        )}

      <footer className="w-full max-w-5xl mx-auto mt-16 text-center text-muted-foreground text-sm pb-4">
        <p>&copy; {new Date().getFullYear()} Estacion de Pago. Todos los derechos reservados.</p>
      </footer>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent
          className="w-full sm:max-w-md p-0"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {selectedService && selectedService.id !== 'phone' && (
            <TransactionForm
              service={selectedService}
              onSuccess={handleSheetClose}
              user={user}
            />
          )}
        </SheetContent>
      </Sheet>

       <AlertDialog open={isLogoutAlertOpen} onOpenChange={setIsLogoutAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción cerrará tu sesión actual. Tendrás que volver a iniciar sesión para continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>Cerrar Sesión</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
