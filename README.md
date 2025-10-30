# MrScraper Shop

This project is a challenge implementation to build a simple microservice application using NestJS (Product Service), Golang (Order Service) and Express.js (BFF Service). The application demonstrates event-driven communication using RabbitMQ, caching using Redis, basic CRUD operations, and is designed to handle high load on the order creation endpoint.

## Key Features

* **Microservices:** `product-service` (NestJS), `order-service` (Go), and `bff-service` (Express.js) in separate codebases.
* **Komunikasi Event-Driven:** Using RabbitMQ for asynchronous communication of stock reduction.
* **Caching:** Using Redis to cache product and order data.
* **Database:** Using PostgreSQL.
* **Containerization:** The entire stack runs using Docker and Docker Compose.
* **Load Testing:** Designed and tested to handle high loads on the `POST /orders` endpoint.

## Architecture

1.  **`bff-service` (Express.js):**
    * Single entry point for all requests from clients.
    * Generates `X-Request-ID` for each request.
    * Perform basic validation.
    * Forward requests to `product-service` or `order-service` via internal HTTP.
    * Passing the `X-Request-ID` to the microservice behind it.
    * Handle errors from microservices and provide consistent responses.

2.  **`product-service` (NestJS):**
    * Manages product data.
    * Provides a `GET /products/:id` endpoint with Redis caching.
    * Publishes `product_created` event.
    * Listens to `order created` events to collect stock and buffer reduction data.
    * Sending stock reduction task in `stock update_queue`.
    * Listens to `stock_update_queue` to process stock reduction tasks.

3.  **`order-service` (Go):**
    * Manages order data.
    * Validates product existence by calling `product-service` via HTTP, leveraging the Redis cache in `product-service`.
    * Creates orders and publishes `order_created` events to RabbitMQ asynchronously.
    * Provides a `GET /orders/product/:productid` endpoint with Redis caching.

4.  **RabbitMQ:** Message broker for inter-service communication.

5.  **Redis:** Cache storage.

6.  **PostgreSQL:** Database.

## Prerequisite

Before starting, make sure you have installed:

* **Docker:** [https://www.docker.com/get-started](https://www.docker.com/get-started)
* **Git:** To clone a repository.
* **Postman (Optional):** To using API Requests.

## Running Applications Locally

### Initial Preparation (Only Once or After `down -v`)

1.  **Clone Repository:**
    ```bash
    git clone https://github.com/gentahape/mrscraper-shop.git
    cd mrscraper-shop
    ```

2.  **Run Docker Compose:**
    ```bash
    docker compose up --build
    ```
    *Wait until all services are running and the log shows the application is ready.*

## API Usage and Example Requests

All API interactions are done through the **BFF Service** at `http://localhost:8000`.

### Using Postman:

1.  **Open Postman.**

2.  **Import Collection:** Import the file `MrScraper Shop.postman_collection.json` from the root folder of this project.

3.  **Import Environment:** Import the file `MrScraper Shop.postman_environment.json` from the root folder of this project.

4.  **Run Request:** You can run the collection directly without having to select a request because the request sequence is already in order, from creating a product to creating an order. The collection also includes validation of the expected response, from the status code to the response format.

### Using `curl`:

1.  **Create New Product:**
    ```bash
    curl -X POST http://localhost:8000/products \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Keychain",
      "price": 1000,
      "qty": 100000 
    }'
    ```
    *Note the `id` of the product produced*

2.  **Get Product By ID:**
    ```bash
    curl http://localhost:8000/products/1 
    ```
    *The second call to this endpoint will use the cache.*

3.  **Create New Order (Asynchronous):**
    ```bash
    curl -X POST http://localhost:8000/orders \
    -H "Content-Type: application/json" \
    -d '{
      "productId": 1, 
      "quantity": 2
    }'
    ```
    *The response will be 202 Accepted quickly. The storage and stock reduction process occurs in the background.*

4.  **Get Orders By Product ID:**
    ```bash
    curl http://localhost:8080/orders/product/1
    ```

## Load Testing

This application is designed to run with multiple instances of `product-service` and `bff-service` to handle the load. It aims to test the `POST /orders` endpoint via BFF at **1000 requests/second**.

1.  **Adjust `docker-compose.yml`:
    * Open the `docker-compose.yml` file.
    * Make sure the `container_name:` section inside the `product-service` and `container_name:` & `ports:` sections inside the `bff-service` are commented out or removed.
        ```yaml
        product-service:
            # ...
            #  container_name: product-service # comment this line when to do load testing
            # ...
        bff-service:
            # ...
            # container_name: bff-service # comment this line when to do load testing
            # ports: # comment this line when to do load testing
            #   - "8000:8000" # comment this line when to do load testing
            # ...
        ```

2.  **Make Sure the Application Runs in a Scaled:**
    ```bash
    docker compose up --build --scale product-service=5 --scale bff-service=5 
    ```

3.  **Create Initial Product:**

    ```bash
    docker compose exec bff-service curl -X POST http://localhost:8000/products \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Keychain",
      "price": 1000,
      "qty": 100000 
    }'
    ```

4.  **Run k6 Test via Docker:**
    * Open a **new** terminal in the *root* of the project.
    * Run the following command:
        ```bash
        docker run --rm -v $(pwd):/scripts --network mrscraper-shop_mrscrapershop-net grafana/k6:latest run /scripts/load-testing.js
        ```
5.  **Result Analysis:** Pay attention to the k6 metric:
    * `checks_succeeded`: Target **~100%**.
    * `http_req_failed`: Target **0%**.
    * `http_reqs`: Target **~1000/s**.

**Expected Results:**
A successful load test will demonstrate the system's ability to handle approximately 1000 requests per second (`http_reqs`) consistently throughout the test. The success rate (`checks_succeeded`) should be close to 100%, with the failure rate (`http_req_failed`) close to 0%. The response latency (`http_req_duration`) for `POST /orders` (which returns `202 Accepted`) is expected to be low, indicating that the endpoint is quickly accepting requests even though the actual processing is occurring in the background. If actual results are lower, analyzing service logs and k6 metrics can help identify bottlenecks.