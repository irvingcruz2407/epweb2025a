
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Phone, Send, BusFront, Building, Users, User as UserIcon, Calendar as CalendarIcon, Printer, FileSpreadsheet, Home as HomeIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { getTransactionsForUser } from '@/actions/transactions';
import { getAllVendors } from '@/actions/auth';
import type { User, Transaction, ServiceType } from '@/lib/types';
import { format, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


const serviceIcons: { [key in ServiceType]: React.ElementType } = {
  phone: Phone,
  remittance: Send,
  transport: BusFront,
  payment: Building,
};


export default function DashboardPage() {
    const router = useRouter();
    const [user, setUser] = React.useState<User | null>(null);
    const [vendors, setVendors] = React.useState<User[]>([]);
    const [allTransactions, setAllTransactions] = React.useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
    
    const [isExportAlertOpen, setIsExportAlertOpen] = React.useState(false);
    const [isPrintAlertOpen, setIsPrintAlertOpen] = React.useState(false);
    const [exportFilename, setExportFilename] = React.useState('');
    const [printFilename, setPrintFilename] = React.useState('');

    React.useEffect(() => {
        if (typeof window !== 'undefined') {
          setDateRange({
            from: startOfMonth(new Date()),
            to: new Date(),
          });
        }
    }, []);

    const getFilename = React.useCallback((extension: 'xlsx' | 'pdf') => {
        if (!dateRange?.from || !dateRange?.to) return '';
        const from = format(dateRange.from, 'ddMMyy');
        const to = format(dateRange.to, 'ddMMyy');
        return `EP${from}a${to}.${extension}`;
    }, [dateRange]);
    
     React.useEffect(() => {
        if (dateRange) {
          setExportFilename(getFilename('xlsx'));
          setPrintFilename(getFilename('pdf'));
        }
    }, [dateRange, getFilename]);

    React.useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const parsedUser: User = JSON.parse(storedUser);
            setUser(parsedUser);
        } else {
            router.replace('/login');
        }
    }, [router]);

    React.useEffect(() => {
        if (user) {
            const fetchDashboardData = async () => {
                setIsLoading(true);
                
                const transactionsResult = await getTransactionsForUser(user);
                if (transactionsResult.success) {
                    setAllTransactions(transactionsResult.transactions || []);
                }

                if (user.role === 'ADMINISTRADOR' || user.role === 'SUPERVISOR') {
                    const vendorsResult = await getAllVendors();
                    if (vendorsResult.success) {
                       const relevantVendors = user.role === 'ADMINISTRADOR' 
                         ? vendorsResult.vendors 
                         : vendorsResult.vendors.filter(v => v.groupCode === user.groupCode);
                        setVendors(relevantVendors || []);
                    }
                } else if (user.role === 'VENDEDOR') {
                   setVendors([user]);
                }
                
                setIsLoading(false);
            };
            fetchDashboardData();
        }
    }, [user]);

    const filteredTransactions = React.useMemo(() => {
        if (!dateRange?.from) return [];
        
        return allTransactions.filter(tx => {
            const txDate = new Date(tx.timestamp);
            const from = dateRange.from ? new Date(dateRange.from.setHours(0, 0, 0, 0)) : null;
            const to = dateRange.to ? new Date(dateRange.to.setHours(23, 59, 59, 999)) : null;

            if (from && txDate < from) return false;
            if (to && txDate > to) return false;
            return true;
        });
    }, [allTransactions, dateRange]);

    const calculateTotalForVendor = (transactions: Transaction[]) => {
        return transactions.reduce((sum, tx) => sum + tx.amount, 0);
    }
    
    const calculateTotalForGroup = (vendorGroup: Record<string, User & { transactions: Transaction[] }>) => {
       return Object.values(vendorGroup).reduce((total, vendor) => total + calculateTotalForVendor(vendor.transactions), 0);
    }

    const groupedVendors = React.useMemo(() => {
      if (!user || user.role === 'VENDEDOR') return {};
  
      const userMap = new Map(vendors.map(v => [v.id, v]));
  
      const groups = filteredTransactions.reduce((acc, tx) => {
          const vendor = userMap.get(tx.userId);
          if (!vendor) return acc;
          
          const groupCode = vendor.groupCode || 'Sin Grupo';
          
          if (!acc[groupCode]) {
              acc[groupCode] = {};
          }
          if (!acc[groupCode][tx.userId]) {
               acc[groupCode][tx.userId] = { ...vendor, transactions: [] };
          }
          acc[groupCode][tx.userId].transactions.push(tx);
          return acc;
      }, {} as Record<string, Record<string, User & { transactions: Transaction[] }>>);
      
      if (user.role === 'ADMINISTRADOR' || user.role === 'SUPERVISOR') {
          vendors.forEach(vendor => {
              if (user.role === 'VENDEDOR' && vendor.id !== user.id) return;
              const groupCode = vendor.groupCode || 'Sin Grupo';
              if (!groups[groupCode]) {
                  groups[groupCode] = {};
              }
              if (!groups[groupCode][vendor.id]) {
                  groups[groupCode][vendor.id] = {
                      ...vendor,
                      transactions: []
                  };
              }
          });
      }
      
      return Object.fromEntries(
        Object.entries(groups)
          .filter(([_, vendorGroup]) => calculateTotalForGroup(vendorGroup) > 0)
      );

    }, [filteredTransactions, vendors, user]);
    
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(amount);
    }
    
    const formatDate = (dateString: string) => {
        return format(new Date(dateString), "d MMM yyyy, hh:mm a", { locale: es });
    }

    const handlePrintClick = () => {
        setIsPrintAlertOpen(true);
    };

    const confirmPrint = () => {
        const originalTitle = document.title;
        document.title = printFilename;
        window.print();
        document.title = originalTitle;
    };
    
    const handleExportClick = () => {
        setIsExportAlertOpen(true);
    };


    const confirmExport = () => {
        if (!user) return;
        const dataToExport = filteredTransactions.map(tx => {
            const vendor = vendors.find(v => v.id === tx.userId);
            return {
                'ID Transacción': tx.id,
                'Fecha': formatDate(tx.timestamp),
                'Tipo': tx.type,
                'Vendedor ID': tx.userId,
                'Vendedor': vendor?.username || 'N/A',
                'Grupo': vendor?.groupCode || 'N/A',
                'Monto (Q)': tx.amount,
                'Detalles': JSON.stringify(tx.details),
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Transacciones');
        XLSX.writeFile(workbook, exportFilename);
    };


    if (isLoading || !user || !dateRange) {
        return <div className="flex justify-center items-center min-h-screen">Cargando...</div>;
    }
    
    const renderTransactionRow = (tx: Transaction) => {
        const Icon = serviceIcons[tx.type as ServiceType] || Building;
        let description = '';

        if (tx.type === 'phone') {
          description = `${tx.details.productDescription} - ${tx.details.phone}`;
        } else if (tx.type === 'remittance') {
          description = `A: ${tx.details.recipientName}`;
        } else if (tx.type === 'transport') {
          description = `Tarjeta: ${tx.details.cardNumber}`;
        } else if (tx.type === 'payment') {
          description = `${tx.details.serviceProvider}`;
        } else {
          description = tx.details.productDescription || `Recarga ${tx.details.operator}`;
        }

        return (
            <TableRow key={tx.id}>
                <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <div>
                            <p className="capitalize">{description}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(tx.timestamp)}</p>
                        </div>
                    </div>
                </TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(tx.amount)}</TableCell>
            </TableRow>
        )
    }

    const renderVendorDetails = (transactions: Transaction[]) => {
        const groupedByType = transactions.reduce((acc, tx) => {
            const type = tx.type;
            if (!acc[type]) {
                acc[type] = [];
            }
            acc[type].push(tx);
            return acc;
        }, {} as Record<string, Transaction[]>);

        const phoneTxs = groupedByType['phone'] || [];
        const otherTxs = Object.entries(groupedByType).filter(([key]) => key !== 'phone').flatMap(([, value]) => value);
        
        const phoneByOperator = phoneTxs.reduce((acc, tx) => {
             const operator = tx.details.operator?.toLowerCase() || 'otro';
             if (!acc[operator]) acc[operator] = [];
             acc[operator].push(tx);
             return acc;
        }, {} as Record<string, Transaction[]>);

        return (
             <Tabs defaultValue="all" className="w-full">
                <TabsList>
                    <TabsTrigger value="all">Todas</TabsTrigger>
                    <TabsTrigger value="phone">Recargas</TabsTrigger>
                    <TabsTrigger value="other">Otros Servicios</TabsTrigger>
                </TabsList>
                <TabsContent value="all">
                     <Table>
                        <TableBody>{transactions.length > 0 ? transactions.map(renderTransactionRow) : <TableRow><TableCell colSpan={2} className="text-center">No hay transacciones.</TableCell></TableRow>}</TableBody>
                    </Table>
                </TabsContent>
                <TabsContent value="phone">
                     <Tabs defaultValue="claro" className="w-full">
                         <TabsList className="grid w-full grid-cols-3">
                             <TabsTrigger value="claro">Claro</TabsTrigger>
                             <TabsTrigger value="tigo">Tigo</TabsTrigger>
                             <TabsTrigger value="otro">Otro</TabsTrigger>
                         </TabsList>
                         <TabsContent value="claro">
                            <Table><TableBody>{(phoneByOperator['claro'] || []).length > 0 ? (phoneByOperator['claro'] || []).map(renderTransactionRow) : <TableRow><TableCell colSpan={2} className="text-center">No hay recargas Claro.</TableCell></TableRow>}</TableBody></Table>
                         </TabsContent>
                          <TabsContent value="tigo">
                            <Table><TableBody>{(phoneByOperator['tigo'] || []).length > 0 ? (phoneByOperator['tigo'] || []).map(renderTransactionRow) : <TableRow><TableCell colSpan={2} className="text-center">No hay recargas Tigo.</TableCell></TableRow>}</TableBody></Table>
                         </TabsContent>
                          <TabsContent value="otro">
                            <Table><TableBody>{(phoneByOperator['otro'] || []).length > 0 ? (phoneByOperator['otro'] || []).map(renderTransactionRow) : <TableRow><TableCell colSpan={2} className="text-center">No hay otras recargas.</TableCell></TableRow>}</TableBody></Table>
                         </TabsContent>
                     </Tabs>
                </TabsContent>
                <TabsContent value="other">
                    <Table>
                        <TableBody>{otherTxs.length > 0 ? otherTxs.map(renderTransactionRow) : <TableRow><TableCell colSpan={2} className="text-center">No hay otros servicios.</TableCell></TableRow>}</TableBody>
                    </Table>
                </TabsContent>
            </Tabs>
        )
    };
    
    const renderAdminSupervisorDashboard = () => (
        <div className="space-y-8">
            {Object.entries(groupedVendors).map(([groupCode, vendorsInGroup]) => (
                 <Card key={groupCode}>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Users className="h-6 w-6 text-primary" />
                            <CardTitle>Grupo: {groupCode}</CardTitle>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground">Total del Grupo</p>
                            <p className="text-2xl font-bold">{formatCurrency(calculateTotalForGroup(vendorsInGroup))}</p>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="single" collapsible className="w-full">
                             {Object.values(vendorsInGroup)
                                .filter(vendor => vendor.transactions.length > 0)
                                .map(vendor => (
                                 <AccordionItem value={vendor.id} key={vendor.id}>
                                    <AccordionTrigger>
                                        <div className="flex justify-between w-full items-center pr-4">
                                            <div className='flex items-center gap-2'>
                                                <UserIcon className="h-4 w-4 text-muted-foreground" />
                                                <span>{vendor.correlativeCode} - {vendor.username}</span>
                                            </div>
                                            <span className="font-semibold">{formatCurrency(calculateTotalForVendor(vendor.transactions))}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        {renderVendorDetails(vendor.transactions)}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </CardContent>
                </Card>
            ))}
        </div>
    );

    const renderVendedorDashboard = () => (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                    <UserIcon className="h-6 w-6 text-primary" />
                    <CardTitle>Mis Transacciones</CardTitle>
                </div>
                <div className="text-right">
                    <p className="text-sm text-muted-foreground">Total de Ventas</p>
                    <p className="text-2xl font-bold">{formatCurrency(calculateTotalForVendor(filteredTransactions))}</p>
                </div>
            </CardHeader>
            <CardContent>
                {renderVendorDetails(filteredTransactions)}
            </CardContent>
        </Card>
    );

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 print:bg-white">
            <header className="bg-white shadow-sm sticky top-0 z-10 print:hidden">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <Button variant="outline" size="icon" onClick={() => router.push('/')}>
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-800">Resumen Administrativo</h1>
                                {user && (
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <span>{user.username} ({user.role})</span>
                                    <span>-</span>
                                    <span className="flex items-center gap-1"><HomeIcon className="h-4 w-4" /> {user.address}</span>
                                    <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> {user.phone}</span>
                                </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                             <Button variant="outline" size="sm" onClick={handlePrintClick}>
                                <Printer className="mr-2 h-4 w-4" />
                                Imprimir
                            </Button>
                             <Button variant="outline" size="sm" onClick={handleExportClick}>
                                <FileSpreadsheet className="mr-2 h-4 w-4" />
                                Exportar
                            </Button>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                    id="date"
                                    variant={"outline"}
                                    className={cn(
                                        "w-[260px] justify-start text-left font-normal",
                                        !dateRange && "text-muted-foreground"
                                    )}
                                    >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                        dateRange.to ? (
                                        <>
                                            {format(dateRange.from, "LLL dd, y")} -{" "}
                                            {format(dateRange.to, "LLL dd, y")}
                                        </>
                                        ) : (
                                        format(dateRange.from, "LLL dd, y")
                                        )
                                    ) : (
                                        <span>Seleccione un rango</span>
                                    )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                    <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange}
                                    onSelect={setDateRange}
                                    numberOfMonths={2}
                                    locale={es}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </div>
            </header>
            <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
                 {user && user.role === 'VENDEDOR' ? renderVendedorDashboard() : renderAdminSupervisorDashboard()}
            </main>
            
             <AlertDialog open={isExportAlertOpen} onOpenChange={setIsExportAlertOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Exportación</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se generará un archivo de Excel con el nombre: <br />
                      <strong className="font-mono">{exportFilename}</strong>
                      <br /><br />
                      ¿Deseas continuar?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setIsExportAlertOpen(false)}>Salir</AlertDialogCancel>
                    <AlertDialogAction onClick={() => {
                        confirmExport();
                        setIsExportAlertOpen(false);
                    }}>Continuar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
             <AlertDialog open={isPrintAlertOpen} onOpenChange={setIsPrintAlertOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Impresión</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se preparará la vista para imprimir con el nombre de archivo: <br />
                      <strong className="font-mono">{printFilename}</strong>
                      <br /><br />
                      ¿Deseas continuar?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setIsPrintAlertOpen(false)}>Salir</AlertDialogCancel>
                    <AlertDialogAction onClick={() => {
                        confirmPrint();
                        setIsPrintAlertOpen(false);
                    }}>Continuar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
}
