package handler

import (
	"encoding/json"
	"net/http"

	"order-service/internal/model"
	"order-service/internal/service"

	"github.com/gorilla/mux"
)

type OrderHandler struct {
	service service.OrderService
}

func NewOrderHandler(s service.OrderService) *OrderHandler {
	return &OrderHandler{
		service: s,
	}
}

func (h *OrderHandler) RegisterRoutes(router *mux.Router) {
	router.HandleFunc("/orders", h.CreateOrder).Methods("POST")
	router.HandleFunc("/orders/product/{productid}", h.GetOrdersByProductID).Methods("GET")
}

func (h *OrderHandler) CreateOrder(w http.ResponseWriter, r *http.Request) {
	var req model.CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	err := h.service.CreateOrder(req)
	if err != nil {
		if err.Error() == "product not found" {
			writeError(w, http.StatusNotFound, err.Error())
		} else if err.Error() == "stock product not enough" {
			writeError(w, http.StatusBadRequest, err.Error())
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	w.WriteHeader(http.StatusAccepted)
}

func (h *OrderHandler) GetOrdersByProductID(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	productID := vars["productid"]

	orders, err := h.service.GetOrdersByProductID(productID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get orders")
	}

	writeJSON(w, http.StatusOK, orders)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
