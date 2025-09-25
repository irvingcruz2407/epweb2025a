
'use strict';
/**
 * @fileOverview Script to update product lists from external APIs.
 *
 * This script fetches product data from a provider's API and updates the
 * corresponding local JSON file. It handles both successful updates and
 * error logging.
 */

import https from 'https';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import myapis from '@/config/myapis.json';

const TIGO_API_CONFIG = myapis.operators.tigo;

const PRODUCTS_TIGO_PATH = path.join(process.cwd(), 'src', 'app', 'recargas', 'productostigo.json');
const ERROR_LOG_PATH = path.join(process.cwd(), 'src/app', 'recargas', 'errorprodcl.json');

async function fetchTigoProducts(): Promise<{ success: boolean; data?: any; error?: string; request?: any, stack?: string }> {
  const url = new URL(TIGO_API_CONFIG.url.replace('ProcesarTransaccion', 'ObtenerProductos'));
  
  const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
  });

  const requestConfig = {
      method: 'POST' as const,
      headers: {
          'Content-Type': 'application/json',
          'Host': url.host
      },
      timeout: 30000,
      httpsAgent,
  };

  try {
      const response = await axios(url.toString(), requestConfig);
      return { success: true, data: response.data };
  } catch (error: any) {
      const errorData = {
          timestamp: new Date().toISOString(),
          error: error.message,
          stack: error.stack,
          request: {
              url: requestConfig.url,
              headers: requestConfig.headers,
          },
          response: error.response ? {
              status: error.response.status,
              data: error.response.data,
          } : null,
      };
      
      await fs.writeFile(ERROR_LOG_PATH, JSON.stringify(errorData, null, 2));
      console.error('Axios request failed in script:', JSON.stringify(errorData, null, 2));
      return { success: false, error: error.message, request: errorData.request, stack: error.stack };
  }
}


async function updateProductsFile() {
  console.log('Fetching products from Tigo API...');
  try {
    const result = await fetchTigoProducts();
    
    if (result.success && result.data && result.data.Result) {
      await fs.writeFile(PRODUCTS_TIGO_PATH, JSON.stringify(result.data, null, 2));
      console.log(`Successfully updated ${PRODUCTS_TIGO_PATH} with ${result.data.Result.length} products.`);
    } else {
        console.error(`Failed to update products. API Error: ${result.error}`);
    }

  } catch (error: any) {
    console.error('An unexpected error occurred in updateProductsFile:', error.message);
  }
}

updateProductsFile();
