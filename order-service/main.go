package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"order-service/internal/handler"
	"order-service/internal/model"
	"order-service/internal/repository"
	"order-service/internal/service"

	"github.com/gorilla/mux"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/streadway/amqp"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var ctx = context.Background()

func main() {
	dbURL := os.Getenv("DATABASE_HOST")
	redisURL := os.Getenv("REDIS_HOST")
	rabbitURL := os.Getenv("RABBITMQ_HOST")
	productSvcURL := os.Getenv("PRODUCT_SERVICE_URL")

	dbGorm, err := gorm.Open(postgres.Open(dbURL), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}
	dbGorm.AutoMigrate(&model.Order{})

	db, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		log.Fatalf("failed to parse database URL: %v", err)
	}

	db.MaxConns = 150
	db.MinConns = 10

	dbPool, err := pgxpool.NewWithConfig(ctx, db)
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}
	defer dbPool.Close()

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("failed to parse Redis URL: %v", err)
	}
	rdb := redis.NewClient(opt)

	conn, err := amqp.Dial(rabbitURL)
	if err != nil {
		log.Fatalf("failed to connect RabbitMQ: %v", err)
	}
	defer conn.Close()

	amqpChan, err := conn.Channel()
	if err != nil {
		log.Fatalf("failed to open RabbitMQ channel: %v", err)
	}
	defer amqpChan.Close()

	orderRepo := repository.NewOrderRepository(dbPool)
	orderService := service.NewOrderService(orderRepo, rdb, amqpChan, productSvcURL)
	orderHandler := handler.NewOrderHandler(orderService)

	router := mux.NewRouter()
	orderHandler.RegisterRoutes(router)

	router.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Hello World!"))
	})

	port := ":8080"
	log.Printf("order service listening on port %s", port)
	if err := http.ListenAndServe(port, router); err != nil {
		log.Fatalf("could not start server: %s\n", err)
	}
}
