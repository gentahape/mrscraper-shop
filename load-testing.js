import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    create_order_scenario: {
      executor: 'constant-arrival-rate',
      rate: 1000,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 1000,
      maxVUs: 2000,
    },
  },
};

export function setup() {
  const res = http.get('http://product-service:3000/products/1');
  check(res, {
    'Cache warmup call OK': (r) => r.status === 200,
  });
  return { productId: 1 };
}

export default function (data) {
  const url = 'http://order-service:8080/orders';

  const payload = JSON.stringify({
    productId: data.productId,
    quantity: 1,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(url, payload, params);

  check(res, {
    'status is 202 (Accepted)': (r) => r.status === 202,
  });
}
