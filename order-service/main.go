package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Hello World1!")
	})

	port := ":8080"

	log.Printf("Order Service starting on port %s", port)

	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatalf("Could not start Order Service server: %s\n", err)
	}
}
