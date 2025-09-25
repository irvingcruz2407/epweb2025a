const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs/promises');
const path = require('path');
const https = require('https');
const axios = require('axios');
const myapis = require('./config/myapis.json');

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

// --- Logic from auth.ts ---

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

async function findUserByUsername(username) {
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

// --- Logic from recharge.ts ---

const rechargeSchema = z.object({
  idProducto: z.string(),
  valorProducto: z.string(),
  numeroFactura: z.string(),
  telefono: z.string(),
  operator: z.string(),
});

async function getRechargeTemplate(operator) {
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

async function sendRechargeRequest(operator, payload) {
    const operatorConfig = myapis.operators[operator];
    if (!operatorConfig) {
        return { success: false, error: `Configuración para operador '${operator}' no encontrada.` };
    }
    const url = operatorConfig.url;

    const agentOptions = {
        rejectUnauthorized: true,
    };

    if ('ignoreSsl' in operatorConfig && operatorConfig.ignoreSsl === true) {
        agentOptions.rejectUnauthorized = false;
    }

    const axiosConfig = {
        headers: {
            'Content-Type': 'application/json',
        },
        timeout: 30000,
    };

    if (operator === 'tigo') {
        agentOptions.rejectUnauthorized = false;
        agentOptions.secureProtocol = 'TLSv1_method';
        agentOptions.ciphers = 'AES128-SHA:AES256-SHA:DES-CBC3-SHA';

        const [username, password] = operatorConfig.credentials.split(':', 2);
        axiosConfig.auth = { username, password };
        axiosConfig.headers['Connection'] = 'close';
    }

    axiosConfig.httpsAgent = new https.Agent(agentOptions);

    const sendRequest = async () => {
        try {
            const response = await axios.post(url, payload, axiosConfig);
            if (response.data === '') return { success: true, data: 'OK' };
            return response.data;
        } catch (error) {
            if (error.response) {
                console.error(`API request failed with status ${error.response.status}:`, error.response.data);
                throw new Error(`API request failed with status ${error.response.status}: ${JSON.stringify(error.response.data)}`);
            } else if (error.request) {
                console.error('API request made but no response received:', error.request);
                throw new Error('No response received from API.');
            } else {
                console.error('Error setting up API request:', error.message);
                throw new Error(`Error setting up API request: ${error.message}`);
            }
        }
    };

    try {
        const data = await retry(sendRequest, 3, 2000);
        return { success: true, data: data };
    } catch (error) {
        const transactionId = payload?.Transaccion?.IdTransaccion || payload?.numeroFactura;
        const errorData = {
            error: error.message,
            stack: error.stack,
            request: {
                url: url,
                payload: payload,
            },
        };

        if (transactionId) {
            const errorFileName = `E${transactionId}.json`;
            const comprobantesDir = path.join(process.cwd(), 'data', 'comprobantes');
            await fs.mkdir(comprobantesDir, { recursive: true });
            await fs.writeFile(path.join(comprobantesDir, errorFileName), JSON.stringify(errorData, null, 2));
        }

        console.error('API request failed after retries:', JSON.stringify(errorData, null, 2));
        return { success: false, error: `No se pudo enviar la recarga después de varios intentos: ${error.message}` };
    }
}

async function retry(fn, retries, delay) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// --- Logic from transactions.ts ---

const transactionSchema = z.object({
  userId: z.string(),
  type: z.string(),
  timestamp: z.string().datetime(),
  amount: z.number(),
  details: z.any(),
});

async function getAllTransactions() {
    const transactionsDir = path.join(process.cwd(), 'data', 'transactions');
    try {
        await fs.mkdir(transactionsDir, { recursive: true });
        const files = await fs.readdir(transactionsDir);
        const allTransactions = await Promise.all(files.map(async (file) => {
            const filePath = path.join(transactionsDir, file);
            const fileContent = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(fileContent);
        }));
        return allTransactions.flat().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (e) {
      console.error("Could not read transactions directory", e);
      return [];
    }
}


// --- API Routes ---

app.get('/', (req, res) => {
  res.send('Backend server is running!');
});

app.post('/signup', async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Datos inválidos.', details: parsed.error });
    }

    try {
        const existingUser = await findUserByUsername(parsed.data.username);
        let userToSave;
        let isUpdate = false;
        let userId;

        if (existingUser && existingUser.id) {
            isUpdate = true;
            userId = existingUser.id;
            userToSave = { ...existingUser, ...parsed.data };
        } else {
            userId = uuidv4();
            const correlativeCode = await getNextCorrelativeCode();
            userToSave = { id: userId, correlativeCode, ...parsed.data };
        }
        
        await fs.mkdir(vendorsDir, { recursive: true });
        const userFilePath = path.join(vendorsDir, `${userId}.json`);
        await fs.writeFile(userFilePath, JSON.stringify(userToSave, null, 2));

        const { password, ...userWithoutPassword } = userToSave;
        res.status(200).json({ success: true, user: userWithoutPassword, isUpdate });
    } catch (error) {
        console.error('Failed to write user to file system:', error);
        res.status(500).json({ success: false, error: 'No se pudo crear o actualizar la cuenta.' });
    }
});

app.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Datos de inicio de sesión inválidos.' });
    }
    
    const { username, password: inputPassword } = parsed.data;
    const user = await findUserByUsername(username);

    if (!user) {
        return res.status(404).json({ success: false, error: 'Usuario no encontrado.' });
    }

    if (user.password !== inputPassword) {
        return res.status(401).json({ success: false, error: 'Contraseña incorrecta.' });
    }

    const { password, ...userWithoutPassword } = user;
    res.status(200).json({ success: true, user: userWithoutPassword });
});

app.get('/vendors', async (req, res) => {
    const vendors = await _getAllVendors();
    res.status(200).json({ success: true, vendors });
});

app.get('/vendors/:groupCode', async (req, res) => {
    const { groupCode } = req.params;
    const allVendors = await _getAllVendors();
    const groupVendors = allVendors.filter(v => v.groupCode === groupCode && v.role === 'VENDEDOR');
    res.status(200).json({ success: true, vendors: groupVendors });
});

app.post('/recharge/prepare', async (req, res) => {
    const parsed = rechargeSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Datos de confirmación inválidos.' });
    }

    try {
        const operatorLower = parsed.data.operator.toLowerCase();
        let confirmationData;
        const rechargeData = await getRechargeTemplate(operatorLower);

        if (!rechargeData) {
            return res.status(400).json({ success: false, error: 'Operador no soportado.' });
        }
        
        if (operatorLower === 'claro') {
            rechargeData.idProducto = String(parsed.data.idProducto);
            rechargeData.valorProducto = parsed.data.valorProducto;
            rechargeData.numeroFactura = parsed.data.numeroFactura;
            rechargeData.telefono = parsed.data.telefono;
            confirmationData = rechargeData;
        } else if (operatorLower === 'tigo') {
            const transaccion = rechargeData.Transaccion;
            transaccion.IdTransaccion = parsed.data.numeroFactura;
            transaccion.NumRecibe = parsed.data.telefono;
            transaccion.IdProducto = String(parsed.data.idProducto);
            confirmationData = rechargeData;
        } else {
            return res.status(400).json({ success: false, error: 'Operador no soportado.' });
        }
        
        const operatorInitial = parsed.data.operator.charAt(0).toUpperCase();
        const docId = `${operatorInitial}${parsed.data.numeroFactura}`;

        const comprobantesDir = path.join(process.cwd(), 'data', 'comprobantes');
        await fs.mkdir(comprobantesDir, { recursive: true });
        await fs.writeFile(path.join(comprobantesDir, `${docId}.json`), JSON.stringify(confirmationData, null, 2));
        
        res.status(200).json({ success: true, receipt: confirmationData });
    } catch (error) {
        console.error('Failed to prepare confirmation:', error);
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido.';
        res.status(500).json({ success: false, error: `No se pudo guardar el comprobante: ${errorMessage}` });
    }
});

app.post('/recharge/send', async (req, res) => {
    const { transactionId, operator } = req.body;
    const operatorInitial = operator.charAt(0).toUpperCase();
    const docId = `${operatorInitial}${transactionId}`;
    const operatorLower = operator.toLowerCase();
    
    if (operatorLower !== 'claro' && operatorLower !== 'tigo') {
      return res.status(400).json({ success: false, error: 'Operador no válido.' });
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
             res.status(200).json({ success: true, status: 200 });
        } else {
             res.status(500).json({ success: false, error: result.error || 'API returned an error.' });
        }

    } catch (error) {
        console.error('Failed to process recharge:', error);
        res.status(500).json({ success: false, error: `No se pudo procesar la recarga: ${error.message}` });
    }
});

const phoneSchema = z.string().length(8, 'El número de teléfono debe tener 8 dígitos.');

app.post('/get-operator', async (req, res) => {
  const { phoneNumber } = req.body;
  const parsedPhone = phoneSchema.safeParse(phoneNumber);

  if (!parsedPhone.success) {
    const errorMessage = parsedPhone.error.errors[0]?.message || 'Número de teléfono inválido.';
    return res.status(400).json({ success: false, error: errorMessage });
  }

  const consultaPayload = { telefono: parsedPhone.data };

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
      return res.status(response.status).json({ success: false, error: `Error de la API: ${response.status}` });
    }

    const apiResponseData = await response.json();
    res.status(200).json({ success: true, data: apiResponseData });

  } catch (error) {
    console.error("Fetch error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido.';
    res.status(500).json({ success: false, error: `No se pudo procesar la solicitud: ${errorMessage}` });
  }
});

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

async function getApiResponse(transactionId) {
    const filePath = path.join(process.cwd(), 'data', 'comprobantes', `R${transactionId}.json`);
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error) {
        console.error(`Could not find API response for ${transactionId} at ${filePath}`, error);
        return null;
    }
}

app.post('/confirm-transaction', async (req, res) => {
  const parsed = confirmationSchema.safeParse(req.body);

  if (!parsed.success) {
    console.error(parsed.error);
    return res.status(400).json({ success: false, error: 'Datos de confirmación inválidos.' });
  }
  
  const receiptToSave = parsed.data;
  
  const comprobantesDir = path.join(process.cwd(), 'data', 'comprobantes');
  await fs.mkdir(comprobantesDir, { recursive: true });
  await fs.writeFile(path.join(comprobantesDir, `C${receiptToSave.id}.json`), JSON.stringify(receiptToSave, null, 2));


  const apiResponse = await getApiResponse(receiptToSave.id);

  if (!apiResponse || apiResponse.Resultado !== true) {
      const errorMessage = `La recarga no fue aprobada por el operador. Mensaje: ${apiResponse?.Mensaje || 'N/A'}`;
      console.log(errorMessage);
      return res.status(200).json({ success: false, error: errorMessage, approved: false });
  }

  const { id: transactionId, userId, timestamp, details } = receiptToSave;
  const generalTransaction = {
    id: transactionId,
    userId,
    type: 'phone',
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

    let userTransactions = [];
    try {
      const fileContent = await fs.readFile(userTransactionsFile, 'utf-8');
      userTransactions = JSON.parse(fileContent);
    } catch (error) {
      // File doesn't exist, will be created
    }

    userTransactions.push(generalTransaction);
    await fs.writeFile(userTransactionsFile, JSON.stringify(userTransactions, null, 2));

    res.status(200).json({ success: true, receipt: receiptToSave, approved: true });
  } catch (error) {
    console.error('Failed to write transaction:', error);
    res.status(500).json({ success: false, error: 'No se pudo guardar la transacción.' });
  }
});

app.post('/get-transactions-for-user', async (req, res) => {
    const user = req.body;
    try {
        const allTransactions = await getAllTransactions();
        const allVendors = await _getAllVendors();

        if (user.role === 'VENDEDOR') {
            const userTransactions = allTransactions.filter(t => t.userId === user.id);
            return res.status(200).json({ success: true, transactions: userTransactions });
        }

        if (user.role === 'SUPERVISOR') {
            const vendorsInGroup = allVendors.filter(v => v.groupCode === user.groupCode);
            const vendorIdsInGroup = new Set(vendorsInGroup.map(v => v.id));
            const transactionsInGroup = allTransactions.filter(t => vendorIdsInGroup.has(t.userId));
            return res.status(200).json({ success: true, transactions: transactionsInGroup });
        }

        if (user.role === 'ADMINISTRADOR') {
            return res.status(200).json({ success: true, transactions: allTransactions });
        }

        res.status(200).json({ success: true, transactions: [] });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido.';
        res.status(500).json({ success: false, transactions: [], error: `No se pudieron obtener las transacciones: ${errorMessage}` });
    }
});

app.post('/transactions', async (req, res) => {
    const parsed = transactionSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Datos de transacción inválidos.', details: parsed.error });
    }

    const transactionId = uuidv4();
    const transactionToSave = {
        id: transactionId,
        ...parsed.data,
    };

    try {
        const userTransactionsDir = path.join(process.cwd(), 'data', 'transactions');
        await fs.mkdir(userTransactionsDir, { recursive: true });
        const userTransactionsFile = path.join(userTransactionsDir, `${parsed.data.userId}.json`);

        let userTransactions = [];
        try {
            const fileContent = await fs.readFile(userTransactionsFile, 'utf-8');
            userTransactions = JSON.parse(fileContent);
        } catch (error) {
            // File might not exist, it's fine.
        }
        userTransactions.push(transactionToSave);
        await fs.writeFile(userTransactionsFile, JSON.stringify(userTransactions, null, 2));
        
        res.status(201).json({ success: true, transaction: transactionToSave });
    } catch (error) {
        console.error('Failed to write transaction:', error);
        res.status(500).json({ success: false, error: 'No se pudo guardar la transacción.' });
    }
});

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
});