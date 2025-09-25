
'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Smartphone, Receipt, DollarSign, Wallet, Hash, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { prepareConfirmation, sendRecharge } from '@/actions/recharge';
import { confirmTransaction } from '@/actions/confirm';
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


export default function ConfirmationPage() {
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

        const confirmationData = {
            id: transactionId,
            userId: user.id,
            timestamp: new Date().toISOString(),
            type: 'phone-confirmation' as const,
            details: {
                phone,
                operator,
                productDescription,
                rechargeAmount: parseFloat(amount),
                amountReceived: parseFloat(amountReceived || '0'),
                pendingBalance: pendingBalance,
            }
        };

        // 1. Prepare the local JSON file
        const prepareResult = await prepareConfirmation({
            idProducto: idProducto,
            valorProducto: amount,
            numeroFactura: transactionId,
            telefono: phone,
            operator: operator,
        });
        
        if (!prepareResult.success) {
            setIsLoading(false);
            setAlertTitle('Error Preparando Recarga');
            setAlertMessage(prepareResult.error || 'No se pudo guardar el comprobante localmente.');
            setIsAlertOpen(true);
            return;
        }

        // 2. Send the recharge to the API
        const apiResult = await sendRecharge(transactionId, operator);
        if (!apiResult.success) {
            setIsLoading(false);
            setAlertTitle('Error en la Transacción');
            setAlertMessage(apiResult.error || 'La API rechazó la solicitud.');
            setIsAlertOpen(true);
            return;
        }

        // 3. Confirm and save the transaction if approved
        const finalConfirmResult = await confirmTransaction(confirmationData);
        if (finalConfirmResult.success) {
             router.push(`/recarga-enviada?transactionId=${transactionId}`);
        } else {
            setAlertTitle('Transacción No Aprobada');
            setAlertMessage(finalConfirmResult.error || 'La recarga no fue aprobada por el operador.');
            setIsAlertOpen(true);
        }
        
        setIsLoading(false);
    };
    
    const renderField = (Icon: React.ElementType, label: string, value: React.ReactNode, isProduct = false) => (
       <div className="flex items-center justify-between py-3 border-b border-gray-200">
            <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-sm text-gray-600">{label}</span>
            </div>
             <span className={`font-mono font-bold text-md text-gray-800 text-right ${isProduct ? 'w-1/2' : ''}`}>{value}</span>
        </div>
    );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 font-sans">
        
        <header className="flex flex-row items-center justify-between w-full max-w-md mb-8">
            <div className="flex-1 flex justify-start">
              <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
                  <ArrowLeft className="h-6 w-6" />
              </Button>
            </div>
            <div className="flex-1 flex flex-col items-center text-center">
                <h1 className="text-3xl font-bold text-primary tracking-wider">
                Confirmación
                </h1>
                <p className="text-sm text-primary">
                Verifica y completa la transacción
                </p>
            </div>
            <div className="flex-1 flex justify-end">
                <div className="relative h-14 w-14">
                    <Progress value={progress} className="absolute inset-0 h-full w-full rounded-full" style={{ background: 'conic-gradient(hsl(var(--primary)) calc(var(--value, 0) * 1%), hsl(var(--secondary)) 0)' }} />
                    <div className="absolute inset-1.5 flex items-center justify-center bg-white rounded-full">
                      <span className="text-xl font-bold text-primary">{timeLeft}</span>
                    </div>
                </div>
            </div>
        </header>


        <Card className="w-full max-w-md shadow-lg rounded-2xl">
            <CardContent className="px-6 pb-6 pt-6 space-y-4">
                 <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    {renderField(Smartphone, "Móvil a Recargar", (
                      <div className="flex items-center gap-2">
                        {operator.toLowerCase() === 'claro' && <Image src="/logoclaro.png" alt="Claro" width={50} height={15} />}
                        {operator.toLowerCase() === 'tigo' && <Image src="/tigologo.png" alt="Tigo" width={30} height={30} />}
                        {phone}
                      </div>
                    ))}
                    {renderField(Receipt, "Producto", `${idProducto} - ${productDescription}`, true)}
                    {renderField(DollarSign, "Monto a Recargar", `Q${parseFloat(amount).toFixed(2)}`)}
                    
                    <div className="flex items-center justify-between py-3 border-b border-gray-200">
                        <div className="flex items-center gap-3">
                            <Wallet className="h-5 w-5 text-primary" />
                            <label htmlFor="amountReceived" className="text-sm text-gray-600">Monto Recibido</label>
                        </div>
                        <Input
                            id="amountReceived"
                            type="number"
                            placeholder="0"
                            className="font-mono font-bold text-md text-right text-blue-600 w-28 h-9"
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

                <div className="mt-6">
                     <Button 
                        className="w-full bg-blue-600 hover:bg-blue-700 h-14 text-lg"
                        onClick={handleConfirm}
                        disabled={isLoading || pendingBalance < 0}
                    >
                        {isLoading ? <Loader2 className="animate-spin" /> : 'Continuar'}
                    </Button>
                </div>
            </CardContent>
        </Card>
        
         <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{alertTitle}</AlertDialogTitle>
                <AlertDialogDescription className="whitespace-pre-wrap">
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

    