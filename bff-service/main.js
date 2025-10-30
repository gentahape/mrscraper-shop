import express from 'express';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL;
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL;
const PORT = process.env.PORT || 8000;

const app = express();
app.use(express.json());

const keepAliveAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 300,
  maxFreeSockets: 20,
  timeout: 60000,
  freeSocketTimeout: 30000,
});

const apiClient = axios.create({
  httpAgent: keepAliveAgent,
  httpsAgent: keepAliveAgent
})

app.use((req, res, next) => {
  req.requestId = uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
})

app.post('/products', async (req, res, next) => {
  try {
    const response = await apiClient.post(PRODUCT_SERVICE_URL + '/products', req.body, {
      headers: {
        'X-Request-ID': req.requestId
      }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    next(error);
  }
});

app.get('/products/:id', async (req, res, next) => {
  try {
    const response = await apiClient.get(PRODUCT_SERVICE_URL + `/products/${req.params.id}`, {
      headers: {
        'X-Request-ID': req.requestId
      }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    next(error);
  }
});

app.post('/orders', async (req, res, next) => {
  try {
    if (!req.body.productId || !req.body.quantity) {
      return res.status(400).json({ error: 'productId and quantity are required' });
    }

    const response = await apiClient.post(ORDER_SERVICE_URL + '/orders', req.body, {
      headers: {
        'X-Request-ID': req.requestId
      }
    });
    res.status(response.status).send();
  } catch (error) {
    next(error);
  }
});

app.get('/orders/product/:productId', async (req, res, next) => {
  try {
    const response = await apiClient.get(ORDER_SERVICE_URL + `/orders/product/${req.params.productId}`, {
      headers: {
        'X-Request-ID': req.requestId
      }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    next(error);
  }
});

app.use((err, req, res, next) => {
  let statusCode = 500;
  let message = 'Internal Server Error';

  if (err.isAxiosError && err.response) {
    statusCode = err.response.status;
    message = err.response.data?.error || err.response.statusText;
  } else if (err.status) {
    statusCode = err.status;
    message = err.message;
  }

  res.status(statusCode).json({ 
    error: message,
    requestId: req.requestId,
  });
});

app.listen(PORT, () => {
  console.log(`BFF Service listening on port ${PORT}`);
});

