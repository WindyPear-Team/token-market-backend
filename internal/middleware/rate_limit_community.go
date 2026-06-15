//go:build !premium

package middleware

import "github.com/gin-gonic/gin"

type RateLimiter struct{}

func NewRateLimiter() *RateLimiter {
	return &RateLimiter{}
}

func (limiter *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
	}
}
