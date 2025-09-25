'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { User } from '@/lib/types';

import { Suspense } from 'react';

function RecargasComponent() {
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [timeLeft, setTimeLeft] = React.useState(60);
  const [progress, setProgress] = React.useState(100);
  const [isLoading, setIsLoading] = React.useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const title = searchParams.get('title') || 'Recarga Telefónica';
  
  const [isAlertOpen, setIsAlertOpen] = React.useState(false);
  const [alertTitle, setAlertTitle] = React.useState('');
  const [alertMessage, setAlertMessage] = React.useState('');
  
  const [user, setUser] = React.useState<User | null>(null);

  React.useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      router.push('/login');
    }
  }, [router]);


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

  const handleKeyPress = (key: string) => {
    if (phoneNumber.length < 8) {
      setPhoneNumber(phoneNumber + key);
    }
  };

  const handleClear = () => {
    setPhoneNumber('');
  };

  const handleSubmit = async () => {
    if (phoneNumber.length !== 8 || !user) {
      return;
    }
    setIsLoading(true);
    
    try {
      const response = await fetch('http://10.155.111.252:3000/get-operator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'No se pudo obtener el operador.');
      }

      if (result.success && result.data !== undefined) {
          const operatorCode = JSON.stringify(result.data).replace(/"/g, '').trim();
          const params = new URLSearchParams({ phone: phoneNumber });

          if (operatorCode === '1') { // CLARO
              router.push(`/productos-claro?${params.toString()}`);
          } else if (operatorCode === '3') { // TIGO
              router.push(`/productos-tigo?${params.toString()}`);
          } else {
              setAlertTitle('Operador Desconocido');
              setAlertMessage(`El código de operador "${operatorCode}" no fue reconocido.`);
              setIsAlertOpen(true);
          }
      } else {
          setAlertTitle('Error en la Consulta');
          setAlertMessage(result.error || 'No se pudo obtener el operador.');
          setIsAlertOpen(true);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error desconocido.';
      setAlertTitle('Error en la Consulta');
      setAlertMessage(errorMessage);
      setIsAlertOpen(true);
    } finally {
      setIsLoading(false);
    }
  };
  
  const renderPhoneNumber = () => {
    return (
      <div className="text-3xl tracking-[0.3em] font-mono">
        {phoneNumber}
      </div>
    );
  };
  
  const keypadButtons = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
  ];

  const buttonClasses = "h-16 text-2xl font-semibold bg-gray-50 hover:bg-gray-200 border-b-4 border-gray-300 active:border-b-2 active:scale-95 transition-all duration-100 ease-in-out";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-sm shadow-lg rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <div className="flex items-center gap-2">
                <Image src="/Estaciondepagologo.png" alt="Estacion de Pago Logo" width={40} height={40} />
                <h2 className="text-xl font-bold text-primary">{title}</h2>
            </div>
            <div className="relative h-14 w-14">
              <Progress value={progress} className="absolute inset-0 h-full w-full rounded-full" style={{ background: 'conic-gradient(hsl(var(--primary)) calc(var(--value, 0) * 1%), hsl(var(--secondary)) 0)' }} />
              <div className="absolute inset-1.5 flex items-center justify-center bg-white rounded-full">
                <span className="text-xl font-bold text-primary">{timeLeft}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-100 rounded-lg p-4 mb-6 text-center h-20 flex items-center justify-center">
             <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">Número de teléfono</p>
                {renderPhoneNumber()}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {keypadButtons.map((key) => (
              <Button
                key={key}
                variant="outline"
                className={buttonClasses}
                onClick={() => handleKeyPress(key)}
                disabled={isLoading}
              >
                {key}
              </Button>
            ))}
             <Button
                variant="destructive"
                className="h-16 text-xl font-bold active:scale-95 transition-transform duration-100 ease-in-out"
                onClick={handleClear}
                disabled={isLoading}
              >
                C
              </Button>
             <Button
                variant="outline"
                className={buttonClasses}
                onClick={() => handleKeyPress('0')}
                disabled={isLoading}
              >
                0
              </Button>
            <Button
              className="h-16 bg-blue-600 hover:bg-blue-700 active:scale-95 transition-transform duration-100 ease-in-out"
              onClick={handleSubmit}
              disabled={phoneNumber.length !== 8 || isLoading}
            >
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ArrowRight className="h-6 w-6" />}
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

export default function RecargasPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <RecargasComponent />
        </Suspense>
    )
}