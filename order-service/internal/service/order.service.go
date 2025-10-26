package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"order-service/internal/model"
	"order-service/internal/repository"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/streadway/amqp"
)

var ctx = context.Background()

type OrderService interface {
	CreateOrder(req model.CreateOrderRequest) error
	GetOrdersByProductID(productID string) ([]model.Order, error)
}

type orderService struct {
	repo              repository.OrderRepository
	rdb               *redis.Client
	amqpChan          *amqp.Channel
	httpClient        *http.Client
	productServiceURL string
}

func NewOrderService(repo repository.OrderRepository, rdb *redis.Client, amqpChan *amqp.Channel, productSvcURL string) OrderService {
	return &orderService{
		repo:              repo,
		rdb:               rdb,
		amqpChan:          amqpChan,
		httpClient:        &http.Client{Timeout: time.Second * 10},
		productServiceURL: productSvcURL,
	}
}

func (s *orderService) CreateOrder(req model.CreateOrderRequest) error {
	url := fmt.Sprintf("%s/products/%d", s.productServiceURL, req.ProductId)

	httpReq, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	httpRes, err := s.httpClient.Do(httpReq)
	if err != nil {
		log.Printf("error calling product-service: %v", err)
		return errors.New("failed to reach product service")
	}
	defer httpRes.Body.Close()

	if httpRes.StatusCode != http.StatusOK {
		return errors.New("product not found")
	}

	var product model.ProductResponse
	if err := json.NewDecoder(httpRes.Body).Decode(&product); err != nil {
		return errors.New("failed to decode product response")
	}

	if product.Qty < req.Quantity {
		return errors.New("stock product not enough")
	}

	go s.processOrderInBackground(req, product)

	return nil
}

func (s *orderService) processOrderInBackground(req model.CreateOrderRequest, product model.ProductResponse) {

	totalPrice := product.Price * float64(req.Quantity)
	newOrder := &model.Order{
		ProductId:  req.ProductId,
		TotalPrice: totalPrice,
		Status:     "SUCCESS",
		CreatedAt:  time.Now(),
	}

	if err := s.repo.CreateOrder(newOrder); err != nil {
		return
	}

	eventPayload := map[string]interface{}{
		"pattern": "order_created",
		"data": map[string]interface{}{
			"productId": newOrder.ProductId,
			"qty":       req.Quantity,
		},
	}

	eventData, _ := json.Marshal(eventPayload)
	err := s.amqpChan.Publish(
		"orders_exchange",
		"order_created",
		false,
		false,
		amqp.Publishing{
			ContentType: "application/json",
			Body:        eventData,
		},
	)
	if err != nil {
		log.Printf("failed to publish order_created event: %v", err)
	}
}

func (s *orderService) GetOrdersByProductID(productID string) ([]model.Order, error) {
	cacheKey := fmt.Sprintf("orders_pid_%s", productID)

	val, err := s.rdb.Get(ctx, cacheKey).Result()
	if err == nil {
		var orders []model.Order
		json.Unmarshal([]byte(val), &orders)
		return orders, nil
	}

	orders, err := s.repo.GetOrdersByProductID(productID)
	if err != nil {
		return nil, err
	}

	data, _ := json.Marshal(orders)
	s.rdb.Set(ctx, cacheKey, data, time.Minute*10)

	return orders, nil
}
