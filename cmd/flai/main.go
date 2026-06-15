package main

import (
	"log"

	"github.com/WindyPear-Team/flai/internal/app"
)

func main() {
	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
