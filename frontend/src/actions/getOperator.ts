'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';

const phoneSchema = z.string().length(8, 'El número de teléfono debe tener 8 dígitos.');
const recargasDir = path.join(process.cwd(), 'src', 'app', 'recargas');

export async function getOperator(phoneNumber: string): Promise<{ success: boolean; data?: any; error?: string }> {
  const parsedPhone = phoneSchema.safeParse(phoneNumber);

  if (!parsedPhone.success) {
    const errorMessage = parsedPhone.error.errors[0]?.message || 'Número de teléfono inválido.';
    return { success: false, error: errorMessage };
  }
  
  const consultaFilePath = path.join(recargasDir, 'consulta.json');
  const consultaPayload = { telefono: parsedPhone.data };

  try {
    await fs.writeFile(consultaFilePath, JSON.stringify(consultaPayload, null, 2));
  } catch (error) {
    console.error("Failed to write consulta.json:", error);
    // Continue anyway, as this is for debugging
  }


  try {
    const response = await fetch('https://estacionpago.ehub.com.gt/recargas.svc/ObtieneOperadorTelefono', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(consultaPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error: ${response.status} - ${errorText}`);
      return { success: false, error: `Error de la API: ${response.status}` };
    }

    const apiResponseData = await response.json();
    
    const respuestaFilePath = path.join(recargasDir, 'respuesta.json');
    try {
        await fs.writeFile(respuestaFilePath, JSON.stringify(apiResponseData, null, 2));
    } catch (error) {
        console.error("Failed to write respuesta.json:", error);
        // Continue anyway
    }

    return { success: true, data: apiResponseData };

  } catch (error) {
    console.error("Fetch error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido.';
    return { success: false, error: `No se pudo procesar la solicitud: ${errorMessage}` };
  }
}
