'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Hash } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Suspense } from 'react';

function RecargaEnviadaComponent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const transactionId = searchParams.get('transactionId');
    const [timeLeft, setTimeLeft] = React.useState(10);
    const [progress, setProgress] = React.useState(100);

    React.useEffect(() => {
        if (timeLeft <= 0) {
            router.replace('/');
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft(prevTime => prevTime - 1);
            setProgress(prev => (prev > 0 ? prev - (100 / 10) : 0));
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 font-sans">
            <header className="flex flex-col items-center text-center mb-8">
                <h1 className="text-3xl font-bold text-primary tracking-wider mb-2">
                    Estacion de Pago
                </h1>
                <p className="text-lg text-primary">
                    Innovando la experiencia de usuario
                </p>
            </header>

            <Card className="w-full max-w-md shadow-lg rounded-2xl text-center">
                <CardHeader>
                    <div className="mx-auto bg-green-100 text-green-600 p-4 rounded-full mb-4">
                        <CheckCircle className="h-12 w-12" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-gray-800">Recarga Enviada</CardTitle>
                    <CardDescription>¡Tu solicitud ha sido procesada con éxito!</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 px-6 pb-8">
                    <p className="text-gray-600">
                        En breve, recibirás un mensaje de texto (SMS) de tu operador confirmando la recarga.
                    </p>
                    
                    {transactionId && (
                        <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Hash className="h-4 w-4 text-primary" />
                                <span className="text-sm text-gray-600">Código ID</span>
                            </div>
                            <span className="font-mono font-bold text-sm text-gray-800">{transactionId}</span>
                        </div>
                    )}

                    <div className="space-y-2 pt-4">
                        <div className="relative h-14 w-14 mx-auto">
                           <Progress value={progress} className="absolute inset-0 h-full w-full rounded-full" style={{ background: `conic-gradient(hsl(var(--primary)) calc(var(--value, 0) * 1%), hsl(var(--secondary)) 0)` }} />
                           <div className="absolute inset-1.5 flex items-center justify-center bg-white rounded-full">
                               <span className="text-xl font-bold text-primary">{timeLeft}</span>
                           </div>
                        </div>
                        <p className="text-sm text-muted-foreground pt-2">
                            Regresando a la página principal...
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function RecargaEnviadaPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <RecargaEnviadaComponent />
        </Suspense>
    )
}