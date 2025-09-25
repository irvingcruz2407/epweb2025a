
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import type { Service, User } from '@/lib/types';
import apiConfig from '@/config/api.json';
import { saveTransaction } from '@/actions/transactions';

const formSchemas = {
  phone: z.object({
    phone: z.string().length(8, 'El número debe tener 8 dígitos.'),
    amount: z.string().min(1, 'El monto es requerido.'),
  }),
  remittance: z.object({
    recipientName: z.string().min(3, 'El nombre es requerido.'),
    recipientId: z.string().min(5, 'La identificación es requerida.'),
    amount: z.string().min(1, 'El monto es requerido.'),
  }),
  transport: z.object({
    cardNumber: z.string().min(10, 'El número de tarjeta es inválido.'),
    amount: z.string().min(1, 'Seleccione un monto.'),
  }),
  payment: z.object({
    serviceProvider: z.string().min(1, 'Seleccione un proveedor.'),
    accountNumber: z.string().min(5, 'El número de cuenta es inválido.'),
    amount: z.string().min(1, 'El monto es requerido.'),
  }),
};

interface TransactionFormProps {
  service: Service;
  onSuccess: () => void;
  user: User | null;
}

export function TransactionForm({ service, onSuccess, user }: TransactionFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  const form = useForm({
    resolver: zodResolver(formSchemas[service.id]),
    defaultValues: {
      phone: '',
      amount: '',
      recipientName: '',
      recipientId: '',
      cardNumber: '',
      serviceProvider: '',
      accountNumber: '',
    },
  });

  const onSubmit = async (values: any) => {
    if (!user) {
        toast({ title: 'Error', description: 'Usuario no autenticado.', variant: 'destructive' });
        return;
    }
    setIsSubmitting(true);
    
    try {
        await saveTransaction({
            userId: user.id,
            type: service.id,
            timestamp: new Date().toISOString(),
            details: values,
            amount: parseFloat(values.amount)
        });

        toast({
            title: "Éxito",
            description: `Transacción de ${service.title} procesada exitosamente.`,
            icon: <CheckCircle className="text-green-500" />,
        });

        form.reset();
        onSuccess();
    } catch (error) {
         toast({
            title: "Error",
            description: "No se pudo guardar la transacción.",
            variant: "destructive",
            icon: <AlertTriangle className="text-red-500" />,
        });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const renderFields = () => {
    switch (service.id) {
      case 'phone':
        return (
          <>
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Número de Teléfono</FormLabel>
                <FormControl><Input placeholder="Ej: 55554444" {...field} type="tel" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Monto (Q)</FormLabel>
                <FormControl><Input placeholder="Ej: 25" {...field} type="number" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </>
        );
      case 'remittance':
        return (
          <>
            <FormField control={form.control} name="recipientName" render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre del Beneficiario</FormLabel>
                <FormControl><Input placeholder="Nombre completo" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="recipientId" render={({ field }) => (
              <FormItem>
                <FormLabel>DPI del Beneficiario</FormLabel>
                <FormControl><Input placeholder="Número de DPI" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Monto (Q)</FormLabel>
                <FormControl><Input placeholder="Ej: 500" {...field} type="number" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </>
        );
      case 'transport':
        return (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Función Movida</AlertTitle>
              <AlertDescription>
                La recarga de transporte ahora tiene su propia página dedicada.
              </AlertDescription>
            </Alert>
        );
      case 'payment':
        return (
          <>
            <FormField control={form.control} name="serviceProvider" render={({ field }) => (
                <FormItem>
                  <FormLabel>Proveedor de Servicio</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Seleccione un servicio" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {apiConfig.providers.servicePayments.map(p => (
                        <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="accountNumber" render={({ field }) => (
              <FormItem>
                <FormLabel>Número de Cuenta / Contrato</FormLabel>
                <FormControl><Input placeholder="Ingrese su número de cuenta" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Monto a Pagar (Q)</FormLabel>
                <FormControl><Input placeholder="Monto exacto de la factura" {...field} type="number" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <SheetHeader className="p-6 bg-secondary">
        <SheetTitle className="font-headline text-2xl">{service.title}</SheetTitle>
        <SheetDescription>{service.description}</SheetDescription>
      </SheetHeader>
      <div className="flex-grow p-6 overflow-y-auto">
        <Form {...form}>
          <form ref={formRef} onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {renderFields()}
          </form>
        </Form>
      </div>
      <div className="p-6 border-t bg-secondary">
        <Button 
          type="submit" 
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-lg py-6" 
          disabled={isSubmitting || service.id === 'transport'}
          onClick={form.handleSubmit(onSubmit)}
        >
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Procesando...</>
          ) : (
            'Realizar Transacción'
          )}
        </Button>
      </div>
    </div>
  );
}
