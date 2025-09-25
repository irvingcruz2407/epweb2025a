
'use server';

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';

const transactionSchema = z.object({
  userId: z.string(),
  type: z.string(),
  timestamp: z.string().datetime(),
  amount: z.number(),
  details: z.any(),
});

type TransactionInput = Omit<z.infer<typeof transactionSchema>, 'id'>;

export async function saveTransaction(data: TransactionInput) {
  const transactionId = uuidv4();
  const transactionToSave = {
    id: transactionId,
    ...data,
  };

  try {
    const userTransactionsDir = path.join(process.cwd(), 'data', 'transactions');
    await fs.mkdir(userTransactionsDir, { recursive: true });
    const userTransactionsFile = path.join(userTransactionsDir, `${data.userId}.json`);

    let userTransactions: any[] = [];
    try {
      const fileContent = await fs.readFile(userTransactionsFile, 'utf-8');
      userTransactions = JSON.parse(fileContent);
    } catch (error) {
      // File might not exist, it's fine.
    }
    userTransactions.push(transactionToSave);
    await fs.writeFile(userTransactionsFile, JSON.stringify(userTransactions, null, 2));
    
    return { success: true, transaction: transactionToSave };
  } catch (error) {
    console.error('Failed to write transaction:', error);
    return { success: false, error: 'No se pudo guardar la transacción.' };
  }
}

async function getAllVendors() {
    const vendorsDir = path.join(process.cwd(), 'data', 'vendors');
    try {
        const files = await fs.readdir(vendorsDir);
        const vendors = await Promise.all(files.map(async (file) => {
            const filePath = path.join(vendorsDir, file);
            const fileContent = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(fileContent);
        }));
        return vendors;
    } catch (e) {
        console.error("Could not read vendors directory", e);
        return [];
    }
}

async function getAllTransactions() {
    const transactionsDir = path.join(process.cwd(), 'data', 'transactions');
    try {
        await fs.mkdir(transactionsDir, { recursive: true });
        const files = await fs.readdir(transactionsDir);
        const allTransactions = await Promise.all(files.map(async (file) => {
            const filePath = path.join(transactionsDir, file);
            const fileContent = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(fileContent) as any[];
        }));
        return allTransactions.flat().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (e) {
      console.error("Could not read transactions directory", e);
      return [];
    }
}

export async function getTransactionsForUser(user: { id: string, role: string, groupCode: string }) {
     try {
        const allTransactions = await getAllTransactions();
        const allVendors = await getAllVendors();

        if (user.role === 'VENDEDOR') {
            const userTransactions = allTransactions.filter(t => t.userId === user.id);
            return { success: true, transactions: userTransactions };
        }

        if (user.role === 'SUPERVISOR') {
            const vendorsInGroup = allVendors.filter(v => v.groupCode === user.groupCode);
            const vendorIdsInGroup = new Set(vendorsInGroup.map(v => v.id));
            const transactionsInGroup = allTransactions.filter(t => vendorIdsInGroup.has(t.userId));
            return { success: true, transactions: transactionsInGroup };
        }

        if (user.role === 'ADMINISTRADOR') {
            return { success: true, transactions: allTransactions };
        }

        return { success: true, transactions: [] };
    } catch (error) {
        console.error('Error fetching transactions:', error);
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido.';
        return { success: false, transactions: [], error: `No se pudieron obtener las transacciones: ${errorMessage}` };
    }
}
