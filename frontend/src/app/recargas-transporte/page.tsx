
'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Loader2, Camera, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import jsQR from 'jsqr';
import { saveTransaction } from '@/actions/transactions';
import type { User } from '@/lib/types';


export default function RecargasTransportePage() {
  const [timeLeft, setTimeLeft] = React.useState(120);
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedAmount, setSelectedAmount] = React.useState<string | null>(null);
  const [cardNumber, setCardNumber] = React.useState('');

  const router = useRouter();
  const searchParams = useSearchParams();
  const title = searchParams.get('title') || 'Recarga de Transporte';
  
  const { toast } = useToast();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = React.useState<boolean | null>(null);
  const [isScanning, setIsScanning] = React.useState(false);

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
    if (timeLeft === 0) {
      router.push('/');
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, router]);
  
  const scanQrCode = React.useCallback(() => {
    if (!isScanning) return;

    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          setCardNumber(code.data);
          setIsScanning(false); // Stop scanning once a code is found
          toast({
            title: 'Código QR Detectado',
            description: `Número de tarjeta: ${code.data}`,
          });
          return; // Exit the function
        }
      }
    }
    requestAnimationFrame(scanQrCode);
  }, [isScanning, toast]);


  React.useEffect(() => {
    if(isScanning) {
        requestAnimationFrame(scanQrCode);
    }
  }, [isScanning, scanQrCode]);


  React.useEffect(() => {
    const getCameraPermission = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('Camera API not supported in this browser.');
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Cámara no Soportada',
          description: 'Tu navegador no soporta el acceso a la cámara.',
        });
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        setHasCameraPermission(true);
        setIsScanning(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Acceso a la Cámara Denegado',
          description: 'Por favor, habilita los permisos de la cámara en tu navegador.',
        });
      }
    };

    getCameraPermission();

    return () => {
      setIsScanning(false);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [toast]);

  const handleAmountClick = (amount: string) => {
    setSelectedAmount(amount);
  };
  
  const handleSubmit = async () => {
     if (!selectedAmount) {
       setAlertTitle('Monto no seleccionado');
       setAlertMessage('Por favor, selecciona un monto para recargar.');
       setIsAlertOpen(true);
       return;
    }
    
     if (!cardNumber || !user) {
       setAlertTitle('Tarjeta o usuario no especificado');
       setAlertMessage('Por favor, escanee el código QR de su tarjeta.');
       setIsAlertOpen(true);
       return;
    }
    
    setIsLoading(true);
    try {
        const amount = parseFloat(selectedAmount);
        await saveTransaction({
            userId: user.id,
            type: 'transport',
            timestamp: new Date().toISOString(),
            details: { cardNumber: cardNumber, amount: amount.toFixed(2) },
            amount,
        });
        setAlertTitle('Recarga Exitosa');
        setAlertMessage(`Se ha realizado una recarga de Q${selectedAmount} a la tarjeta ${cardNumber}.`);
    } catch (error) {
        setAlertTitle('Error en la Recarga');
        setAlertMessage('No se pudo guardar la transacción.');
    } finally {
        setIsLoading(false);
        setIsAlertOpen(true);
    }
  };

  const rechargeAmounts = [1, 2, 5, 10, 20, 50, 100, 200];
  const buttonClasses = "h-16 text-xl font-bold border-b-4 active:border-b-2 active:scale-95 transition-all duration-100 ease-in-out";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <Card className="w-full max-w-sm shadow-lg rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <h2 className="text-xl font-bold text-gray-700">{title}</h2>
             <div className="relative h-14 w-14">
              <Progress value={(timeLeft / 120) * 100} className="absolute inset-0 h-full w-full [&>div]:bg-blue-600" />
              <div className="absolute inset-1.5 flex items-center justify-center bg-white rounded-full">
                <span className="text-xl font-bold text-blue-600">{timeLeft}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4 mb-6">
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                {hasCameraPermission === false && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-4">
                      <Camera className="h-12 w-12 mb-4" />
                      <p className="text-center font-semibold">Cámara no disponible</p>
                   </div>
                )}
                 {hasCameraPermission === null && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-4">
                      <Loader2 className="h-12 w-12 animate-spin mb-4" />
                      <p className="text-center font-semibold">Accediendo a la cámara...</p>
                   </div>
                )}
                 {hasCameraPermission === true && !isScanning && cardNumber && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-500/80 text-white p-4">
                        <CheckCircle className="h-12 w-12 mb-4" />
                        <p className="text-center font-semibold">¡Código QR Escaneado!</p>
                    </div>
                 )}
              </div>
              <Input 
                placeholder="Número de tarjeta (escanee el QR)" 
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                disabled={isLoading} 
                readOnly={isScanning}
              />
               {hasCameraPermission === false && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Acceso a Cámara Denegado</AlertTitle>
                    <AlertDescription>
                      Permite el acceso a la cámara en los ajustes de tu navegador para escanear el código QR.
                    </AlertDescription>
                  </Alert>
              )}
            </div>


          <div className="grid grid-cols-4 gap-2 pt-2">
            {rechargeAmounts.map((amount) => (
              <Button
                key={amount}
                type="button"
                variant={selectedAmount === String(amount) ? 'default' : 'outline'}
                className={`${buttonClasses} ${selectedAmount === String(amount) ? 'bg-primary text-primary-foreground border-primary/70' : 'bg-gray-50 hover:bg-gray-200 border-gray-300'}`}
                onClick={() => handleAmountClick(String(amount))}
                disabled={isLoading}
              >
                Q{amount}
              </Button>
            ))}
          </div>

           <Button
              className="w-full mt-6 h-16 bg-blue-600 hover:bg-blue-700 text-xl font-bold active:scale-95 transition-transform duration-100 ease-in-out"
              onClick={handleSubmit}
              disabled={isLoading || !selectedAmount || !cardNumber}
            >
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Realizar Recarga'}
            </Button>
        </CardContent>
      </Card>
      
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {alertMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
                setIsAlertOpen(false)
                 if(alertTitle === 'Recarga Exitosa') {
                    router.push('/')
                }
            }}>Aceptar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
