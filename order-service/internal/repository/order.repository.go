package repository

import (
	"context"
	"log"

	"order-service/internal/model"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ctx = context.Background()

type DBExecutor interface {
	Exec(ctx context.Context, query string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, query string, args ...any) (pgx.Rows, error)
}

type PgxPoolIface interface {
	Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row
	Exec(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error)
}

type OrderRepository interface {
	CreateOrder(order *model.Order) error
	GetOrdersByProductID(productID string) ([]model.Order, error)
}

type orderRepository struct {
	db DBExecutor
}

func NewOrderRepository(pool *pgxpool.Pool) OrderRepository {
	return &orderRepository{pool}
}

func (r *orderRepository) CreateOrder(order *model.Order) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO orders (product_id, total_price, status, created_at) VALUES ($1, $2, $3, $4)`,
		order.ProductId, order.TotalPrice, order.Status, order.CreatedAt,
	)
	if err != nil {
		log.Printf("failed to insert order: %v", err)
	}
	return err
}

func (r *orderRepository) GetOrdersByProductID(productID string) ([]model.Order, error) {
	// Gunakan Query untuk SELECT
	rows, err := r.db.Query(ctx,
		`SELECT id, product_id, total_price, status, created_at FROM orders WHERE product_id = $1 ORDER BY id DESC`,
		productID,
	)
	if err != nil {
		log.Printf("failed to query orders: %v", err)
		return nil, err
	}
	defer rows.Close()

	orders := make([]model.Order, 0)

	for rows.Next() {
		var o model.Order
		if err := rows.Scan(&o.ID, &o.ProductId, &o.TotalPrice, &o.Status, &o.CreatedAt); err != nil {
			log.Printf("failed to scan order: %v", err)
			return nil, err
		}
		orders = append(orders, o)
	}

	if err := rows.Err(); err != nil {
		log.Printf("failed to get orders: %v", err)
		return nil, err
	}

	return orders, nil
}
