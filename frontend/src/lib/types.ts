
import type { LucideIcon } from 'lucide-react';

export const serviceTypes = {
  phone: 'Phone Recharge',
  remittance: 'Remittances',
  transport: 'Transport Card',
  payment: 'Service Payments',
} as const;

export type ServiceType = keyof typeof serviceTypes;

export type Service = {
  id: ServiceType;
  title: string;
  description: string;
  icon: LucideIcon;
};

export interface User {
  id: string;
  username: string;
  address: string;
  phone: string;
  deviceId: string;
  role: 'ADMINISTRADOR' | 'SUPERVISOR' | 'VENDEDOR';
  correlativeCode: number;
  groupCode: string;
  permissions: {
    recargas: boolean;
    remesas: boolean;
    transporte: boolean;
    pagos: boolean;
  };
}

export interface Transaction {
  id: string;
  userId: string;
  type: ServiceType | 'phone-confirmation' | 'phone-query';
  timestamp: string;
  amount: number;
  details: any;
}
