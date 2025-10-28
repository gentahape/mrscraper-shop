# MrScraper Shop

This project is a challenge implementation to build a simple microservice application using NestJS (Product Service) and Golang (Order Service). The application demonstrates event-driven communication using RabbitMQ, caching using Redis, basic CRUD operations, and is designed to handle high load on the order creation endpoint.

## Key Features

* **Microservices:** `product-service` (NestJS) and `order-service` (Go) in separate codebases..
* **Event-Driven Communication:** Using RabbitMQ for asynchronous communication (when orders are created and when product stock is reduced).
* **Caching:** Using Redis to cache frequently accessed product and order data.
* **Database:** Using PostgreSQL.
* **Containerization:** The entire stack runs using Docker and Docker Compose.
* **Load Testing:** Designed and tested to handle high loads on the `POST /orders` endpoint.

## Architecture

1.  **`product-service` (NestJS):**
    * Manages product data.
    * Provides a `GET /products/:id` endpoint with Redis caching.
    * Publishes a `product_created` event when a new product is created.
    * Listens to the `order_created` event from RabbitMQ to reduce stock using an internal worker.
    * Listens to the `stock_update_queue` queue to process stock reduction tasks from its own batch worker.
2.  **`order-service` (Go):**
    * Manages order data.
    * Validates product existence by calling `product-service` via HTTP, leveraging the Redis cache in `product-service`.
    * Creates orders and publishes `order_created` events to RabbitMQ asynchronously.
    * Provides a `GET /orders/product/:productid` endpoint with Redis caching.
3.  **RabbitMQ:** Message broker for inter-service communication.
4.  **Redis:** Cache storage.
5.  **PostgreSQL:** Primary database.

## Prerequisite

Before starting, make sure you have installed:

* **Docker:** [https://www.docker.com/get-started](https://www.docker.com/get-started)
* **Git:** To clone a repository.

## Running Applications Locally

This repository can be run in two main modes:

### Mode 1: Manual Development and Testing (Single Instance)

This mode runs one instance of each service, maps the `product-service` port to `localhost:3000` and `order-service` to `localhost:8080` for easy access from Postman/browser.

1.  **Clone Repository:**
    ```bash
    git clone https://github.com/gentahape/mrscraper-shop.git
    cd mrscraper-shop
    ```
2.  **Adjust Environment**
    * Copy the `.env.example` files in the `product-service` and `order-service` folders to their respective root folders.
    * Adjust and match the contents of the `.env` files in both folders based on the contents of `docker-compose.yml`.
      - Example `.env` file in `product-service` :
        ```ini
          DB_HOST=db
          DB_PORT=5432
          DB_USERNAME=mrscrapershop
          DB_PASSWORD=mrscrapershop123
          DB_DATABASE=mrscrapershop_db

          REDIS_HOST=redis://redis:6379
          RABBITMQ_HOST=amqp://guest:guest@rabbitmq:5672
        ```
      - Example `.env` file in `order-service` :
        ```ini
          DATABASE_HOST=postgres://mrscrapershop:mrscrapershop123@db:5432/mrscrapershop_db?sslmode=disable
          REDIS_HOST=redis://redis:6379
          RABBITMQ_HOST=amqp://guest:guest@rabbitmq:5672
          PRODUCT_SERVICE_URL=http://product-service:3000
        ``` 
3.  **Run Docker Compose:**
    ```bash
    docker compose up --build
    ```
    *Wait until all services are running and the log shows the application is ready.*

### Mode 2: High Load Simulation (Scaled)

This mode runs multiple instances of `product-service` as per load testing requirements and does not map container_name and port `3000` to `localhost`.

1.  **Clone Repository:**
    ```bash
    git clone https://github.com/gentahape/mrscraper-shop.git
    cd mrscraper-shop
    ```
2.  **Adjust `docker-compose.yml`:**
    * Open the `docker-compose.yml` file.
    * Make sure the `container_name:` and `ports:` sections inside the `product-service` service are commented out or removed.
        ```yaml
        product-service:
          # ...
          #  container_name: product-service # comment this line when to do load testing
          #  ports: # comment this line when to do load testing
          #    - "3000:3000" # comment this line when to do load testing
          # ...
        ```
3.  **Adjust Environment**
    * Copy the `.env.example` files in the `product-service` and `order-service` folders to their respective root folders.
    * Adjust and match the contents of the `.env` files in both folders based on the contents of `docker-compose.yml`.
      - Example `.env` file in `product-service` :
        ```ini
          DB_HOST=db
          DB_PORT=5432
          DB_USERNAME=mrscrapershop
          DB_PASSWORD=mrscrapershop123
          DB_DATABASE=mrscrapershop_db

          REDIS_HOST=redis://redis:6379
          RABBITMQ_HOST=amqp://guest:guest@rabbitmq:5672
        ```
      - Example `.env` file in `order-service` :
        ```ini
          DATABASE_HOST=postgres://mrscrapershop:mrscrapershop123@db:5432/mrscrapershop_db?sslmode=disable
          REDIS_HOST=redis://redis:6379
          RABBITMQ_HOST=amqp://guest:guest@rabbitmq:5672
          PRODUCT_SERVICE_URL=http://product-service:3000
        ``` 
4.  **Run Docker Compose with `--scale`:**
    ```bash
    docker compose up --build --scale product-service=5
    ```
    *This will run 5 instances of `product-service`.*

## API Usage and Example Requests

### Manual Testing (Use Mode 1)

This mode allows you to interact directly with the API using tools like Postman. Make sure you run the application in Mode 1 to access the product-service port. You can also use curl to interact with the API.

* **Base URL Product Service:** `http://localhost:3000`
* **Base URL Order Service:** `http://localhost:8080`

#### Using Postman

1.  **Open Postman:** Make sure you have Postman installed (https://www.postman.com/downloads/).

2.  **Import Collection:** Import the file `MrScraper Shop.postman_collection.json` from the root folder of this project.

3.  **Import Environment:** Import the file `MrScraper Shop.postman_environment.json` from the root folder of this project.

4.  **Run Request:** You can run the collection directly without having to select a request because the request sequence is already in order, from creating a product to creating an order. The collection also includes validation of the expected response, from the status code to the response format.

#### Using `curl`

1.  **Create New Product:**
    ```bash
    curl -X POST http://localhost:3000/products \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Keychain",
      "price": 10000,
      "qty": 100000 
    }'
    ```
    *Note the `id` of the product produced*

2.  **Get Product by ID:**
    ```bash
    curl http://localhost:3000/products/1 
    ```
    *The second call to this endpoint will use the cache.*

3.  **Create New Order (Asynchronous):**
    ```bash
    curl -X POST http://localhost:8080/orders \
    -H "Content-Type: application/json" \
    -d '{
      "productId": 1, 
      "quantity": 2
    }'
    ```
    *The response will be `202 Accepted` quickly. The storage and stock reduction process occurs in the background.*

4.  **Wait a few seconds** for the event to be processed and stock to decrease.

5.  **Check Product Stock Again:**
    ```bash
    curl http://localhost:3000/products/1
    ```

6.  **Get Orders by Product ID:**
    ```bash
    curl http://localhost:8080/orders/product/1
    ```

### Creating a Product While Mode 2 (Scaled) is Active

Testing the `POST /orders` endpoint at **1000 requests/second**.

1.  **Make Sure the Application is Running in Mode 2 (Scaled):**
    ```bash
    docker compose up --build --scale product-service=5 
    ```

2.  **Create Initial Product (If Not Existing/Database Deleted):**
    ```bash
    docker compose exec order-service curl -X POST http://product-service:3000/products \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Sticker",
      "price": 1000,
      "qty": 100000 
    }'
    ```
    *This sends a request from within the `order-service` container to `product-service`. Note the product `id` for the k6 script.*

3.  **Prepare k6 Script:**
    * Make sure the `load-testing.js` file is in the *root* of the project.
    * Configure the script properly:
        * `rate: 1000`
        * `url`: Make sure the target URL of `order-service` is correct. Since we are running k6 in a separate Docker container connected to the same network, the URL is `http://order-service:8080/orders`. **(Change this in your script if you previously used `127.0.0.1` or `host.docker.internal`)**

4.  **Run k6 Test via Docker:**
    * Open a new terminal in the *root* of the project.
    * Run the following command:
        ```bash
        docker run --rm -v $(pwd):/scripts --network mrscraper-shop_mrscrapershop-net grafana/k6:latest run /scripts/load-testing.js
        ```

4.  **Result Analysis:** Note the key metrics from the k6 output to evaluate performance:

    * `checks_succeeded`: Percentage of successful assertions. The ideal target is 100%, indicating all responses are valid.

    * `http_req_failed`: Percentage of requests that failed due to network or server errors, the target is 0%.

    * `http_reqs`: Actual system throughput (requests per second), the target is closer to 1000/s.

    * `http_req_duration`: The time it took the server to respond.

5. **Expected Results:** A successful load test will demonstrate the system's ability to handle approximately 1,000 requests per second (`http_reqs`) consistently throughout the test. The success rate (`checks_succeeded`) should be close to 100%, with the failure rate (`http_req_failed`) close to 0%. The response latency (`http_req_duration`) for `POST /orders` (which returns `202 Accepted`) is expected to be low, indicating that the endpoint is quickly accepting requests even though the actual processing is occurring in the background. If actual results are lower, analyzing service logs and k6 metrics can help identify bottlenecks.