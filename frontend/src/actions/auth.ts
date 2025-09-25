
'use server';

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

const vendorsDir = path.join(process.cwd(), 'data', 'vendors');
const transactionsDir = path.join(process.cwd(), 'data', 'transactions');


const signupSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  address: z.string().min(5),
  phone: z.string().min(8, 'El número de teléfono debe tener al menos 8 dígitos.'),
  deviceId: z.string().uuid(),
  role: z.enum(['ADMINISTRADOR', 'SUPERVISOR', 'VENDEDOR']),
  groupCode: z.string().min(1, 'El código de grupo es requerido.'),
  permissions: z.object({
    recargas: z.boolean(),
    remesas: z.boolean(),
    transporte: z.boolean(),
    pagos: z.boolean(),
  }),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

type SignupInput = z.infer<typeof signupSchema>;

async function _getAllVendors() {
    try {
        await fs.mkdir(vendorsDir, { recursive: true });
        const files = await fs.readdir(vendorsDir);
        const vendors = await Promise.all(files.map(async (file) => {
            const filePath = path.join(vendorsDir, file);
            const fileContent = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(fileContent);
        }));
        return vendors;
    } catch (error) {
        console.error("Failed to read vendors directory:", error);
        return [];
    }
}

export async function getAllVendors() {
    const vendors = await _getAllVendors();
    return { success: true, vendors };
}


async function findUserByUsername(username: string) {
    const vendors = await _getAllVendors();
    return vendors.find(vendor => vendor.username === username) || null;
}

async function getNextCorrelativeCode() {
    const vendors = await _getAllVendors();
    if (vendors.length === 0) {
        return 1;
    }
    const maxCode = Math.max(...vendors.map(v => v.correlativeCode || 0));
    return maxCode + 1;
}

export async function signupUser(data: SignupInput) {
  const parsed = signupSchema.safeParse(data);

  if (!parsed.success) {
    console.error(parsed.error);
    return { success: false, error: 'Datos inválidos.' };
  }

  const existingUser = await findUserByUsername(parsed.data.username);
  
  let userToSave;
  let isUpdate = false;
  let userId;

  if (existingUser && existingUser.id) {
    isUpdate = true;
    userId = existingUser.id;
    userToSave = {
      ...existingUser,
      ...parsed.data, 
    };
  } else {
    userId = uuidv4();
    const correlativeCode = await getNextCorrelativeCode();
    userToSave = {
      id: userId,
      correlativeCode,
      ...parsed.data,
    };
  }
  
  try {
    await fs.mkdir(vendorsDir, { recursive: true });
    const userFilePath = path.join(vendorsDir, `${userId}.json`);
    await fs.writeFile(userFilePath, JSON.stringify(userToSave, null, 2));

    const { password, ...userWithoutPassword } = userToSave;
    return { success: true, user: userWithoutPassword, isUpdate };
  } catch (error) {
    console.error('Failed to write user to file system:', error);
    return { success: false, error: 'No se pudo crear o actualizar la cuenta.' };
  }
}

export async function loginUser(data: z.infer<typeof loginSchema>) {
   const parsed = loginSchema.safeParse(data);

  if (!parsed.success) {
    return { success: false, error: 'Datos de inicio de sesión inválidos.' };
  }
  
  const { username, password: inputPassword } = parsed.data;

  const user = await findUserByUsername(username);

  if (!user) {
    return { success: false, error: 'Usuario no encontrado.' };
  }

  if (user.password !== inputPassword) {
    return { success: false, error: 'Contraseña incorrecta.' };
  }

  const { password, ...userWithoutPassword } = user;
  return { success: true, user: userWithoutPassword };
}

export async function getVendorsByGroup(groupCode: string) {
    const allVendors = await _getAllVendors();
    const groupVendors = allVendors.filter(v => v.groupCode === groupCode && v.role === 'VENDEDOR');
    return { success: true, vendors: groupVendors };
}
