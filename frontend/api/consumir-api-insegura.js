// pages/api/consumir-api-insegura.js
 
import axios from 'axios';
 
export default async function handler(req, res) {
  try {
    // La URL de tu API con protocolos de seguridad obsoletos
    const apiUrl = 'https://envio.cellus.com.gt:3443';
    // Realiza la solicitud HTTP desde el servidor de Next.js
    // El servidor puede ignorar los problemas de seguridad que el navegador rechaza
    const response = await axios.get(apiUrl, {
      // Puedes pasar configuraciones adicionales si es necesario
      // Por ejemplo, para ignorar certificados SSL no válidos si es el caso
      https: {
        rejectUnauthorized: false
      }
    });
 
    const data = response.data;
 
    // Envía la respuesta al cliente
    res.status(200).json(data);
 
  } catch (error) {
    console.error('Error al consumir la API:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}