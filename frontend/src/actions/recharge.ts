
'use server';

import { z } from 'zod';
import https from 'https';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import myapis from '@/config/myapis.json';

const rechargeSchema = z.object({
  idProducto: z.string(),
  valorProducto: z.string(),
  numeroFactura: z.string(),
  telefono: z.string(),
  operator: z.string(),
});

type RechargeInput = z.infer<typeof rechargeSchema>;

async function getRechargeTemplate(operator: string) {
    if (operator === 'claro') {
      return {
        idProducto: "",
        valorProducto: "",
        codigoSucursal: "EP1000",
        numeroFactura: "",
        nombreSucursal: "www.estaciondepago.com",
        telefono: "",
        codigoCadena: "1012",
        usuarioAsignado: "estacion.depago",
        clave: "12345_"
      }
    }
    if (operator === 'tigo') {
      return {
        Transaccion: {
          IdTransaccion: "",
          NumEnvia: "31325638",
          Pin: "3256",
          NumRecibe: "",
          IdProducto: ""
        }
      }
    }
    return null;
}

export async function prepareConfirmation(data: RechargeInput) {
    const parsed = rechargeSchema.safeParse(data);

    if (!parsed.success) {
        console.error(parsed.error);
        return { success: false, error: 'Datos de confirmación inválidos.' };
    }

    try {
        const operatorLower = parsed.data.operator.toLowerCase();
        let confirmationData: any;
        const rechargeData = await getRechargeTemplate(operatorLower);

        if (!rechargeData) {
            return { success: false, error: 'Operador no soportado.' };
        }
        
        if (operatorLower === 'claro') {
            rechargeData.idProducto = String(parsed.data.idProducto);
            rechargeData.valorProducto = parsed.data.valorProducto;
            rechargeData.numeroFactura = parsed.data.numeroFactura;
            rechargeData.telefono = parsed.data.telefono;
            confirmationData = rechargeData;
        } else if (operatorLower === 'tigo') {
            rechargeData.Transaccion.IdTransaccion = parsed.data.numeroFactura;
            rechargeData.Transaccion.NumRecibe = parsed.data.telefono;
            rechargeData.Transaccion.IdProducto = String(parsed.data.idProducto);
            confirmationData = rechargeData;
        } else {
            return { success: false, error: 'Operador no soportado.' };
        }
        
        const operatorInitial = parsed.data.operator.charAt(0).toUpperCase();
        const docId = `${operatorInitial}${parsed.data.numeroFactura}`;

        const comprobantesDir = path.join(process.cwd(), 'data', 'comprobantes');
        await fs.mkdir(comprobantesDir, { recursive: true });
        await fs.writeFile(path.join(comprobantesDir, `${docId}.json`), JSON.stringify(confirmationData, null, 2));
        
        return { success: true, receipt: confirmationData };
    } catch (error) {
        console.error('Failed to prepare confirmation:', error);
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido.';
        return { success: false, error: `No se pudo guardar el comprobante: ${errorMessage}` };
    }
}

async function sendRechargeRequest(operator: 'claro' | 'tigo', payload: any): Promise<{ success: boolean; data?: any; error?: string }> {
    const operatorConfig = myapis.operators[operator];
    if (!operatorConfig) {
      return { success: false, error: `Configuración para operador '${operator}' no encontrada.` };
    }
    const url = new URL(operatorConfig.url);

    const httpsAgent = new https.Agent({
        rejectUnauthorized: false,
    });

    const requestBody = JSON.stringify(payload);
    
    const requestConfig = {
        method: 'POST' as const,
        headers: {
            'Content-Type': 'application/json',
            'Host': url.host,
            'Content-Length': Buffer.byteLength(requestBody)
        },
        data: payload,
        timeout: 30000,
        httpsAgent,
    };

    try {
        const response = await axios(url.toString(), requestConfig);
        return { success: true, data: response.data };
    } catch (error: any) {
        const transactionId = payload?.Transaccion?.IdTransaccion || payload?.numeroFactura;
        const errorData = {
            error: error.message,
            stack: error.stack,
            request: {
                url: requestConfig.url,
                headers: requestConfig.headers,
                body: requestConfig.data,
            },
            response: error.response ? {
                status: error.response.status,
                data: error.response.data,
            } : null,
        };

        if (transactionId) {
            const errorFileName = `E${transactionId}.json`;
            const comprobantesDir = path.join(process.cwd(), 'data', 'comprobantes');
            await fs.mkdir(comprobantesDir, { recursive: true });
            await fs.writeFile(path.join(comprobantesDir, errorFileName), JSON.stringify(errorData, null, 2));
        }

        console.error('Axios request failed:', JSON.stringify(errorData, null, 2));
        return { success: false, error: `No se pudo enviar la recarga: ${error.message}` };
    }
}


export async function sendRecharge(transactionId: string, operator: string) {
    const operatorInitial = operator.charAt(0).toUpperCase();
    const docId = `${operatorInitial}${transactionId}`;
    const operatorLower = operator.toLowerCase() as 'claro' | 'tigo';
    
    if (operatorLower !== 'claro' && operatorLower !== 'tigo') {
      return { success: false, error: 'Operador no válido.' };
    }
    
    try {
        const filePath = path.join(process.cwd(), 'data', 'comprobantes', `${docId}.json`);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const rechargePayload = JSON.parse(fileContent);

        const result = await sendRechargeRequest(operatorLower, rechargePayload);

        const comprobantesDir = path.join(process.cwd(), 'data', 'comprobantes');

        if (result.success && result.data) {
             const responseFileName = `R${transactionId}.json`;
             await fs.writeFile(path.join(comprobantesDir, responseFileName), JSON.stringify(result.data, null, 2));
             return { success: true, status: 200 };
        } else {
             return { success: false, error: result.error || 'API returned an error.' };
        }

    } catch (error: any) {
        console.error('Failed to process recharge:', error);
        return { success: false, error: `No se pudo procesar la recarga: ${error.message}` };
    }
}
