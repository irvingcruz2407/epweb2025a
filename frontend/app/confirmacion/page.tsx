'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Smartphone, Receipt, DollarSign, Wallet, Hash, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

import type { User } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import Image from 'next/image';
import { Suspense } from 'react';

function ConfirmationComponent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    // Data from previous page
    const phone = searchParams.get('phone') || '';
    const operator = searchParams.get('operator') || '';
    const amount = searchParams.get('amount') || '0';
    const productDescription = searchParams.get('productDescription') || '';
    const transactionId = searchParams.get('transactionId') || '';
    const idProducto = searchParams.get('idProducto') || '';

    const [user, setUser] = React.useState<User | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [amountReceived, setAmountReceived] = React.useState('');
    const [pendingBalance, setPendingBalance] = React.useState(parseFloat(amount) * -1);
    
    const [isAlertOpen, setIsAlertOpen] = React.useState(false);
    const [alertTitle, setAlertTitle] = React.useState('');
    const [alertMessage, setAlertMessage] = React.useState('');
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
            router.replace('/login');
        }
        
        if (!transactionId) {
            toast({ title: 'Error', description: 'ID de transacción no encontrado.', variant: 'destructive' });
            router.push('/');
        }
    }, [router, transactionId, toast]);
    
     React.useEffect(() => {
        const rechargeAmount = parseFloat(amount);
        const received = parseFloat(amountReceived) || 0;
        setPendingBalance(received - rechargeAmount);
    }, [amount, amountReceived]);


    const handleConfirm = async () => {
        if (!user) {
             toast({ title: 'Error', description: 'No se pudo verificar el usuario.', variant: 'destructive' });
             return;
        }

        if (pendingBalance < 0) {
            setAlertTitle('Monto Insuficiente');
            setAlertMessage('El monto recibido debe ser suficiente para cubrir la recarga.');
            setIsAlertOpen(true);
            return;
        }

        setIsLoading(true);

        let apiResult;
        try {
            // 1. Prepare the local JSON file
            const prepareResponse = await fetch('http://localhost:3001/recharge/prepare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idProducto: idProducto,
                    valorProducto: amount,
                    numeroFactura: transactionId,
                    telefono: phone,
                    operator: operator,
                }),
            });
            const prepareResult = await prepareResponse.json();
            if (!prepareResponse.ok || !prepareResult.success) {
                throw new Error(prepareResult.error || 'No se pudo guardar el comprobante localmente.');
            }

            // 2. Send the recharge to the API
            const sendResponse = await fetch(' http://10.155.111.252:3001/recharge/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transactionId, operator }),
            });
            apiResult = await sendResponse.json();
            if (!sendResponse.ok || !apiResult.success) {
                throw new Error(apiResult.error || 'La API rechazó la solicitud.');
            }

            // The user has confirmed that a successful API call means the transaction is complete.
            // Bypassing the failing /confirm-transaction call.
            router.push(`/recarga-enviada?transactionId=${transactionId}`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error desconocido.';
            setAlertTitle('Error en la Transacción');
            setAlertMessage(`Message: ${errorMessage}\nAPI Result: ${JSON.stringify(apiResult)}`);
            setIsAlertOpen(true);
        } finally {
            setIsLoading(false);
        }
    };
    
    const renderField = (Icon: React.ElementType, label: string, value: React.ReactNode, isProduct = false) => (
       <div class="flex items-center justify-between py-3 border-b border-gray-200">
            <div class="flex items-center gap-3">
                <Icon class="h-5 w-5 text-primary" />
                <span class="text-sm text-gray-600">{label}</span>
            </div>
             <span class={`font-mono font-bold text-md text-gray-800 text-right ${isProduct ? 'w-1/2' : ''}`}>{value}</span>
        </div>
    );

  return (
    <div class="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 font-sans">
        
        <header class="flex flex-row items-center justify-between w-full max-w-md mb-8">
            <div class="flex-1 flex justify-start">
              <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
                  <ArrowLeft class="h-6 w-6" />
              </Button>
            </div>
            <div class="flex-1 flex flex-col items-center text-center">
                <h1 class="text-3xl font-bold text-primary tracking-wider">
                Confirmación
                </h1>
                <p class="text-sm text-primary">
                Verifica y completa la transacción
                </p>
            </div>
            <div class="flex-1 flex justify-end">
                <div class="relative h-14 w-14">
                    <Progress value={progress} class="absolute inset-0 h-full w-full rounded-full" style={{ background: 'conic-gradient(hsl(var(--primary)) calc(var(--value, 0) * 1%), hsl(var(--secondary)) 0)' }} />
                    <div class="absolute inset-1.5 flex items-center justify-center bg-white rounded-full">
                      <span class="text-xl font-bold text-primary">{timeLeft}</span>
                    </div>
                </div>
            </div>
        </header>


        <Card class="w-full max-w-md shadow-lg rounded-2xl">
            <CardContent class="px-6 pb-6 pt-6 space-y-4">
                 <div class="bg-gray-50 rounded-lg p-4 space-y-2">
                    {renderField(Smartphone, "Móvil a Recargar", (
                      <div class="flex items-center gap-2">
                        {operator.toLowerCase() === 'claro' && <Image src="/logoclaro.png" alt="Claro" width={50} height={15} />}
                        {operator.toLowerCase() === 'tigo' && <Image src="/tigologo.png" alt="Tigo" width={30} height={30} />}
                        {phone}
                      </div>
                    ))}
                    {renderField(Receipt, "Producto", `${idProducto} - ${productDescription}`, true)}
                    {renderField(DollarSign, "Monto a Recargar", `Q${parseFloat(amount).toFixed(2)}`)}
                    
                    <div class="flex items-center justify-between py-3 border-b border-gray-200">
                        <div class="flex items-center gap-3">
                            <Wallet class="h-5 w-5 text-primary" />
                            <label htmlFor="amountReceived" class="text-sm text-gray-600">Monto Recibido</label>
                        </div>
                        <Input
                            id="amountReceived"
                            type="number"
                            placeholder="0"
                            class="font-mono font-bold text-md text-right text-blue-600 w-28 h-9"
                            value={amountReceived}
                            onChange={(e) => {
                                const value = e.target.value;
                                if (/^\d*$/.test(value)) {
                                    setAmountReceived(value);
                                }
                            }}
                            disabled={isLoading}
                        />
                    </div>

                    {renderField(DollarSign, "Saldo Pendiente", `Q${pendingBalance.toFixed(2)}`)}
                    {renderField(Hash, "Codigo ID", transactionId)}
                 </div>

                <div class="mt-6">
                     <Button 
                        class="w-full bg-blue-600 hover:bg-blue-700 h-14 text-lg"
                        onClick={handleConfirm}
                        disabled={isLoading || pendingBalance < 0}
                    >
                        {isLoading ? <Loader2 class="animate-spin" /> : 'Continuar'}
                    </Button>
                </div>
            </CardContent>
        </Card>
        
         <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{alertTitle}</AlertDialogTitle>
                <AlertDialogDescription class="whitespace-pre-wrap">
                  {alertMessage}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => {
                    setIsAlertOpen(false);
                }}>Aceptar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>


    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConfirmationComponent />
    </Suspense>
  );
}