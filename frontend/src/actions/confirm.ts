
'use server';

import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';

const confirmationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  timestamp: z.string().datetime(),
  type: z.literal('phone-confirmation'),
  details: z.object({
    phone: z.string(),
    operator: z.string(),
    productDescription: z.string(),
    rechargeAmount: z.number(),
    amountReceived: z.number(),
    pendingBalance: z.number(),
  }),
});

type ConfirmationInput = z.infer<typeof confirmationSchema>;

async function getApiResponse(transactionId: string): Promise<any | null> {
    const filePath = path.join(process.cwd(), 'data', 'comprobantes', `R${transactionId}.json`);
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error) {
        console.error(`Could not find API response for ${transactionId} at ${filePath}`, error);
        return null;
    }
}

export async function confirmTransaction(data: ConfirmationInput) {
  const parsed = confirmationSchema.safeParse(data);

  if (!parsed.success) {
    console.error(parsed.error);
    return { success: false, error: 'Datos de confirmación inválidos.' };
  }
  
  const receiptToSave = parsed.data;
  
  const comprobantesDir = path.join(process.cwd(), 'data', 'comprobantes');
  await fs.mkdir(comprobantesDir, { recursive: true });
  await fs.writeFile(path.join(comprobantesDir, `C${receiptToSave.id}.json`), JSON.stringify(receiptToSave, null, 2));


  const apiResponse = await getApiResponse(receiptToSave.id);

  if (!apiResponse || apiResponse.Resultado !== true) {
      const errorMessage = `La recarga no fue aprobada por el operador. Mensaje: ${apiResponse?.Mensaje || 'N/A'}`;
      console.log(errorMessage);
      return { success: false, error: errorMessage, approved: false };
  }

  const { id: transactionId, userId, timestamp, details } = receiptToSave;
  const generalTransaction = {
    id: transactionId,
    userId,
    type: 'phone' as const,
    timestamp,
    amount: details.rechargeAmount,
    details: {
      phone: details.phone,
      operator: details.operator,
      amount: details.rechargeAmount.toFixed(2),
      productDescription: details.productDescription,
    }
  };
  
  try {
    const userTransactionsDir = path.join(process.cwd(), 'data', 'transactions');
    await fs.mkdir(userTransactionsDir, { recursive: true });
    const userTransactionsFile = path.join(userTransactionsDir, `${userId}.json`);

    let userTransactions: any[] = [];
    try {
      const fileContent = await fs.readFile(userTransactionsFile, 'utf-8');
      userTransactions = JSON.parse(fileContent);
    } catch (error) {
      // File doesn't exist, will be created
    }

    userTransactions.push(generalTransaction);
    await fs.writeFile(userTransactionsFile, JSON.stringify(userTransactions, null, 2));

    return { success: true, receipt: receiptToSave, approved: true };
  } catch (error) {
    console.error('Failed to write transaction:', error);
    return { success: false, error: 'No se pudo guardar la transacción.' };
  }
}
